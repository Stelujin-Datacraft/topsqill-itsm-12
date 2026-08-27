import { rawSupabase, SUPABASE_URL } from '@/integrations/supabase/rawClient';
import type { BlogPostInput, BlogPostRecord } from '@/types/blog';

/** Prefer dedicated bucket; fall back to existing public media bucket. */
export const BLOG_BUCKET_CANDIDATES = ['blog-media', 'report-media'] as const;
export const BLOG_CMS_FILE = 'blog/cms-posts.json';
export const BLOG_COVER_PREFIX = 'blog/covers';

const TABLE_PROBE_KEY = 'topsqill_blog_table_ok';

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

export function isMissingBucketError(error: { message?: string; statusCode?: string; error?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = `${error.message || ''} ${error.error || ''}`.toLowerCase();
  return msg.includes('bucket not found') || (msg.includes('not found') && msg.includes('bucket'));
}

export function formatBlogError(error: unknown, fallback = 'Blog operation failed'): string {
  const err = error as { message?: string; error?: string; code?: string; statusCode?: string } | null;
  const message = String(err?.message || err?.error || fallback);
  if (isMissingRelationError(err)) {
    return 'Blog database table is missing. Posts will be saved to storage instead — retry save. Or apply migration 20260827120000_blog_posts.sql in Supabase.';
  }
  if (isMissingBucketError(err)) {
    return 'Storage bucket missing. Retrying with report-media. If this persists, create a public bucket named blog-media in Supabase Storage.';
  }
  if (/row-level security|rls|permission denied|403/i.test(message)) {
    return 'Permission denied — blog publishing requires an organization admin account.';
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

async function bucketExists(name: string): Promise<boolean> {
  // list is auth-gated; a zero-byte upsert probe is heavier — use getBucket when available
  const { data, error } = await rawSupabase.storage.getBucket(name);
  if (!error && data) return true;
  // getBucket may be forbidden for non-service users; fall through to listBuckets
  const { data: buckets } = await rawSupabase.storage.listBuckets();
  if (Array.isArray(buckets) && buckets.some((b) => b.name === name || b.id === name)) {
    return true;
  }
  // Last resort: try listing root (empty list ≠ missing bucket)
  const { error: listError } = await rawSupabase.storage.from(name).list('', { limit: 1 });
  if (!listError) return true;
  return !isMissingBucketError(listError as any);
}

/** Pick a writable public bucket for blog assets. */
export async function resolveBlogBucket(): Promise<string> {
  for (const name of BLOG_BUCKET_CANDIDATES) {
    if (await bucketExists(name)) return name;
  }
  // Default: attempt blog-media first (caller may create via Nest ensure)
  return BLOG_BUCKET_CANDIDATES[0];
}

export function publicObjectUrl(bucket: string, path: string): string {
  const { data } = rawSupabase.storage.from(bucket).getPublicUrl(path);
  if (data?.publicUrl) return data.publicUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export async function uploadBlogCover(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${BLOG_COVER_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  let lastError: unknown;

  for (const bucket of BLOG_BUCKET_CANDIDATES) {
    const { error } = await rawSupabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (!error) return publicObjectUrl(bucket, path);
    lastError = error;
    if (!isMissingBucketError(error as any)) {
      // Permission / other errors — still try next bucket
      console.warn(`[blog] cover upload to ${bucket} failed:`, error.message);
    }
  }

  throw new Error(formatBlogError(lastError, 'Cover upload failed'));
}

async function downloadCmsJson(bucket: string): Promise<BlogPostRecord[]> {
  const { data, error } = await rawSupabase.storage.from(bucket).download(BLOG_CMS_FILE);
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404') || (error as any).statusCode === '404') {
      return [];
    }
    // Missing bucket → try next
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
}

/** Load CMS posts from storage JSON (works without blog_posts table). */
export async function listStorageBlogPosts(): Promise<BlogPostRecord[]> {
  let lastError: unknown;
  for (const bucket of BLOG_BUCKET_CANDIDATES) {
    try {
      if (!(await bucketExists(bucket))) continue;
      return await downloadCmsJson(bucket);
    } catch (err) {
      lastError = err;
      console.warn(`[blog] storage list via ${bucket} failed:`, (err as Error)?.message);
    }
  }
  if (lastError) throw new Error(formatBlogError(lastError, 'Could not load blog posts from storage'));
  return [];
}

/** Public published posts from storage (fetch public URL — no auth required). */
export async function listPublishedStorageBlogPosts(): Promise<BlogPostRecord[]> {
  for (const bucket of BLOG_BUCKET_CANDIDATES) {
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

export async function createStorageBlogPost(
  input: BlogPostInput,
  createdBy: string | null | undefined,
): Promise<BlogPostRecord> {
  const bucket = await resolveBlogBucket();
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
}

export async function updateStorageBlogPost(
  id: string,
  input: BlogPostInput,
): Promise<BlogPostRecord> {
  const bucket = await resolveBlogBucket();
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
}

export async function deleteStorageBlogPost(id: string): Promise<void> {
  const bucket = await resolveBlogBucket();
  const existing = await downloadCmsJson(bucket);
  await uploadCmsJson(bucket, existing.filter((p) => p.id !== id));
}
