import { rawSupabase, SUPABASE_URL } from '@/integrations/supabase/rawClient';
import type { BlogPostInput, BlogPostRecord } from '@/types/blog';

/**
 * Prefer buckets that already exist in production.
 * `blog-media` is last because its migration may not be applied yet.
 */
export const BLOG_BUCKET_CANDIDATES = [
  'report-media',
  'form-attachments',
  'organization-logos',
  'blog-media',
] as const;

export const BLOG_CMS_FILE = 'blog/cms-posts.json';
export const BLOG_COVER_PREFIX = 'blog/covers';

const TABLE_PROBE_KEY = 'topsqill_blog_table_ok';
const BUCKET_CACHE_KEY = 'topsqill_blog_bucket';
const MAX_DATA_URL_BYTES = 1_500_000;

export function isMissingRelationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === '42P01'
    || code === 'PGRST205'
    || msg.includes('does not exist')
    || msg.includes('schema cache')
    || msg.includes("could not find the table 'public.blog_posts'")
    || msg.includes('relation "blog_posts"')
  );
}

export function isMissingBucketError(error: { message?: string; statusCode?: string; error?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.message || ''} ${(error as any).error || ''}`.toLowerCase();
  const status = String((error as any).statusCode || (error as any).status || '');
  return (
    msg.includes('bucket not found')
    || msg.includes('no such bucket')
    || (msg.includes('not found') && msg.includes('bucket'))
    || status === '404'
  );
}

export function formatBlogError(error: unknown, fallback = 'Blog operation failed'): string {
  const err = error as { message?: string; error?: string; code?: string; statusCode?: string } | null;
  const message = String(err?.message || err?.error || fallback);
  if (isMissingRelationError(err)) {
    return 'Blog database table is missing. Posts will be saved to storage instead — retry save. Or apply migration 20260827120000_blog_posts.sql in Supabase.';
  }
  if (isMissingBucketError(err)) {
    return 'Could not upload to Supabase Storage. The cover was not saved — paste an image URL, or create a public bucket (report-media / blog-media) in Supabase.';
  }
  if (/row-level security|rls|permission denied|403|unauthorized|jwt/i.test(message)) {
    return 'Permission denied — sign in as an organization admin and ensure Storage upload policies allow authenticated users.';
  }
  return message;
}

/** Returns true if public.blog_posts is queryable. */
export async function probeBlogTable(): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(TABLE_PROBE_KEY);
    if (cached === '1') return true;
    if (cached === '0') return false;
  } catch {
    /* ignore */
  }

  const { error } = await rawSupabase.from('blog_posts').select('id').limit(1);
  const ok = !error || !isMissingRelationError(error);
  try {
    sessionStorage.setItem(TABLE_PROBE_KEY, ok ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!ok) {
    console.warn('[blog] blog_posts table unavailable:', error?.message);
  }
  return ok;
}

export function invalidateBlogTableProbe() {
  try {
    sessionStorage.removeItem(TABLE_PROBE_KEY);
  } catch {
    /* ignore */
  }
}

function cachedBucket(): string | null {
  try {
    return sessionStorage.getItem(BUCKET_CACHE_KEY);
  } catch {
    return null;
  }
}

function rememberBucket(name: string) {
  try {
    sessionStorage.setItem(BUCKET_CACHE_KEY, name);
  } catch {
    /* ignore */
  }
}

export function clearBlogBucketCache() {
  try {
    sessionStorage.removeItem(BUCKET_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Ordered bucket list with last-known-good first. */
function bucketAttemptOrder(): string[] {
  const cached = cachedBucket();
  const base = [...BLOG_BUCKET_CANDIDATES];
  if (cached && base.includes(cached as any)) {
    return [cached, ...base.filter((b) => b !== cached)];
  }
  return base;
}

export function publicObjectUrl(bucket: string, path: string): string {
  const { data } = rawSupabase.storage.from(bucket).getPublicUrl(path);
  if (data?.publicUrl) return data.publicUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_DATA_URL_BYTES) {
      reject(new Error(`Image is too large for inline fallback (${Math.round(file.size / 1024)}KB). Use a file under ~1.5MB or an image URL.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a cover image. Tries known public buckets; if Storage is unavailable,
 * embeds a data-URL so the post can still be saved.
 */
export async function uploadBlogCover(file: File): Promise<{ url: string; via: 'storage' | 'data-url'; bucket?: string }> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${BLOG_COVER_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const errors: string[] = [];

  for (const bucket of bucketAttemptOrder()) {
    const { error } = await rawSupabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
    if (!error) {
      rememberBucket(bucket);
      return { url: publicObjectUrl(bucket, path), via: 'storage', bucket };
    }
    errors.push(`${bucket}: ${error.message}`);
    console.warn(`[blog] cover upload to ${bucket} failed:`, error.message);
  }

  // Last resort: inline data URL (no bucket required)
  try {
    const url = await fileToDataUrl(file);
    console.warn('[blog] using data-URL cover; Storage uploads failed:', errors.join(' | '));
    return { url, via: 'data-url' };
  } catch (dataErr) {
    throw new Error(
      formatBlogError(
        { message: errors[errors.length - 1] || (dataErr as Error).message },
        'Cover upload failed',
      ),
    );
  }
}

/** Pick a writable bucket for CMS JSON (probe by tiny upload upsert of empty list if needed). */
export async function resolveBlogBucket(): Promise<string> {
  const cached = cachedBucket();
  if (cached) return cached;

  for (const bucket of bucketAttemptOrder()) {
    // Probe with list — missing bucket → 404/bucket not found
    const { error } = await rawSupabase.storage.from(bucket).list('blog', { limit: 1 });
    if (!error || !isMissingBucketError(error as any)) {
      // Permission errors on empty prefix still mean the bucket exists
      rememberBucket(bucket);
      return bucket;
    }
  }
  return bucketAttemptOrder()[0];
}

async function downloadCmsJson(bucket: string): Promise<BlogPostRecord[]> {
  const { data, error } = await rawSupabase.storage.from(bucket).download(BLOG_CMS_FILE);
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404') || (error as any).statusCode === '404') {
      return [];
    }
    throw error;
  }
  const text = await data.text();
  if (!text.trim()) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? (parsed as BlogPostRecord[]) : [];
}

async function uploadCmsJson(bucket: string, posts: BlogPostRecord[]): Promise<void> {
  const body = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
  const { error } = await rawSupabase.storage.from(bucket).upload(BLOG_CMS_FILE, body, {
    upsert: true,
    contentType: 'application/json',
  });
  if (error) throw error;
  rememberBucket(bucket);
}

/** Load CMS posts from storage JSON (works without blog_posts table). */
export async function listStorageBlogPosts(): Promise<BlogPostRecord[]> {
  let lastError: unknown;
  for (const bucket of bucketAttemptOrder()) {
    try {
      const rows = await downloadCmsJson(bucket);
      rememberBucket(bucket);
      return rows;
    } catch (err) {
      lastError = err;
      if (isMissingBucketError(err as any)) continue;
      console.warn(`[blog] storage list via ${bucket} failed:`, (err as Error)?.message);
    }
  }
  if (lastError) throw new Error(formatBlogError(lastError, 'Could not load blog posts from storage'));
  return [];
}

/** Public published posts from storage (fetch public URL — no auth required). */
export async function listPublishedStorageBlogPosts(): Promise<BlogPostRecord[]> {
  for (const bucket of bucketAttemptOrder()) {
    const url = publicObjectUrl(bucket, BLOG_CMS_FILE);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const parsed = await res.json();
      const rows = Array.isArray(parsed) ? (parsed as BlogPostRecord[]) : [];
      return rows.filter((p) => p.published);
    } catch {
      /* try next bucket */
    }
  }
  return [];
}

export async function getPublishedStorageBlogPost(slug: string): Promise<BlogPostRecord | null> {
  const rows = await listPublishedStorageBlogPosts();
  return rows.find((p) => p.slug === slug) || null;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `blog-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function withBucketWrite<T>(fn: (bucket: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const bucket of bucketAttemptOrder()) {
    try {
      const result = await fn(bucket);
      rememberBucket(bucket);
      return result;
    } catch (err) {
      lastError = err;
      if (isMissingBucketError(err as any)) continue;
      // Other errors (e.g. conflict) should surface unless every bucket fails
      console.warn(`[blog] write via ${bucket} failed:`, (err as Error)?.message);
    }
  }
  throw new Error(formatBlogError(lastError, 'Could not write blog post to storage'));
}

export async function createStorageBlogPost(
  input: BlogPostInput,
  createdBy: string | null | undefined,
): Promise<BlogPostRecord> {
  return withBucketWrite(async (bucket) => {
    const existing = await downloadCmsJson(bucket).catch(() => [] as BlogPostRecord[]);
    if (existing.some((p) => p.slug === input.slug)) {
      throw new Error(`A post with slug “${input.slug}” already exists`);
    }
    const now = new Date().toISOString();
    const row: BlogPostRecord = {
      id: newId(),
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      content_html: input.content_html || '',
      cover_image_url: input.cover_image_url ?? null,
      author_name: input.author_name || 'TopSqill Team',
      author_title: input.author_title ?? null,
      tags: input.tags || [],
      published: Boolean(input.published),
      published_at: input.published ? (input.published_at || now) : null,
      created_by: createdBy || null,
      created_at: now,
      updated_at: now,
    };
    await uploadCmsJson(bucket, [row, ...existing]);
    return row;
  });
}

export async function updateStorageBlogPost(
  id: string,
  input: BlogPostInput,
): Promise<BlogPostRecord> {
  return withBucketWrite(async (bucket) => {
    const existing = await downloadCmsJson(bucket);
    const idx = existing.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('Post not found');
    if (existing.some((p) => p.slug === input.slug && p.id !== id)) {
      throw new Error(`A post with slug “${input.slug}” already exists`);
    }
    const prev = existing[idx];
    const now = new Date().toISOString();
    const published = Boolean(input.published);
    const row: BlogPostRecord = {
      ...prev,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      content_html: input.content_html || '',
      cover_image_url: input.cover_image_url ?? null,
      author_name: input.author_name || prev.author_name || 'TopSqill Team',
      author_title: input.author_title ?? null,
      tags: input.tags || [],
      published,
      published_at: published
        ? (input.published_at || prev.published_at || now)
        : prev.published_at,
      updated_at: now,
    };
    const next = [...existing];
    next[idx] = row;
    await uploadCmsJson(bucket, next);
    return row;
  });
}

export async function deleteStorageBlogPost(id: string): Promise<void> {
  await withBucketWrite(async (bucket) => {
    const existing = await downloadCmsJson(bucket);
    await uploadCmsJson(bucket, existing.filter((p) => p.id !== id));
  });
}
