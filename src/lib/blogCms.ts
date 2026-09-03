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
export const BLOG_DELETED_SLUGS_FILE = 'blog/deleted-slugs.json';
export const BLOG_COVER_PREFIX = 'blog/covers';
const LOCAL_CMS_KEY = 'topsqill_blog_cms_posts_v1';
const LOCAL_DELETED_SLUGS_KEY = 'topsqill_blog_deleted_slugs_v1';

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
  // Only treat as available when the relation exists (no error, or non-missing-relation error)
  const missing = isMissingRelationError(error);
  const ok = !missing && (!error || !/could not find the table/i.test(error.message || ''));
  // If error is permission-related, table still exists
  const tableExists = !error || !missing;
  try {
    sessionStorage.setItem(TABLE_PROBE_KEY, tableExists ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!tableExists) {
    console.warn('[blog] blog_posts table unavailable:', error?.message);
  }
  return tableExists;
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

/** Local backup so /blog can show posts even when Storage/table reads fail. */
export function loadLocalCmsPosts(): BlogPostRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BlogPostRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCmsPosts(posts: BlogPostRecord[]) {
  try {
    localStorage.setItem(LOCAL_CMS_KEY, JSON.stringify(posts));
  } catch (err) {
    console.warn('[blog] localStorage save failed:', err);
  }
}

/** Local tombstones so deleted demo/static seeds stay gone on /blog + admin. */
export function loadLocalDeletedSlugs(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_SLUGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((s) => String(s).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function saveLocalDeletedSlugs(slugs: string[]) {
  try {
    const unique = [...new Set(slugs.map((s) => String(s).trim()).filter(Boolean))];
    localStorage.setItem(LOCAL_DELETED_SLUGS_KEY, JSON.stringify(unique));
  } catch (err) {
    console.warn('[blog] localStorage deleted-slugs save failed:', err);
  }
}

async function downloadDeletedSlugsJson(bucket: string): Promise<string[] | null> {
  const { data, error } = await rawSupabase.storage.from(bucket).download(BLOG_DELETED_SLUGS_FILE);
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404') || (error as any).statusCode === '404') {
      return null;
    }
    if (isMissingBucketError(error as any)) return null;
    throw error;
  }
  const text = await data.text();
  if (!text.trim()) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed)
    ? parsed.map((s) => String(s).trim()).filter(Boolean)
    : [];
}

async function uploadDeletedSlugsJson(bucket: string, slugs: string[]): Promise<void> {
  const body = new Blob([JSON.stringify([...new Set(slugs)], null, 2)], { type: 'application/json' });
  const { error } = await rawSupabase.storage.from(bucket).upload(BLOG_DELETED_SLUGS_FILE, body, {
    upsert: true,
    contentType: 'application/json',
  });
  if (error) throw error;
}

export async function loadDeletedSlugs(): Promise<Set<string>> {
  const set = new Set<string>(loadLocalDeletedSlugs());
  for (const bucket of bucketAttemptOrder()) {
    try {
      const remote = await downloadDeletedSlugsJson(bucket);
      if (remote) remote.forEach((s) => set.add(s));
    } catch (err) {
      console.warn(`[blog] read deleted-slugs via ${bucket} failed:`, (err as Error)?.message);
    }
  }
  return set;
}

export async function markSlugDeleted(slug: string): Promise<void> {
  const trimmed = String(slug || '').trim();
  if (!trimmed) return;
  const next = [...(await loadDeletedSlugs()), trimmed];
  saveLocalDeletedSlugs(next);
  let wrote = false;
  for (const bucket of bucketAttemptOrder()) {
    try {
      await uploadDeletedSlugsJson(bucket, next);
      wrote = true;
      rememberBucket(bucket);
      break;
    } catch (err) {
      console.warn(`[blog] write deleted-slugs via ${bucket} failed:`, (err as Error)?.message);
    }
  }
  if (!wrote) {
    console.warn('[blog] deleted-slugs persisted locally only (storage write failed)');
  }
}

export async function unmarkSlugDeleted(slug: string): Promise<void> {
  const trimmed = String(slug || '').trim();
  if (!trimmed) return;
  const next = [...(await loadDeletedSlugs())].filter((s) => s !== trimmed);
  saveLocalDeletedSlugs(next);
  for (const bucket of bucketAttemptOrder()) {
    try {
      await uploadDeletedSlugsJson(bucket, next);
      rememberBucket(bucket);
      break;
    } catch {
      /* optional */
    }
  }
}

export function filterOutDeletedSlugs<T extends { slug: string }>(
  rows: T[],
  deleted: Set<string> | string[],
): T[] {
  const set = deleted instanceof Set ? deleted : new Set(deleted);
  if (set.size === 0) return rows;
  return rows.filter((row) => !set.has(row.slug));
}

function mergePostMaps(...lists: BlogPostRecord[][]): BlogPostRecord[] {
  const byKey = new Map<string, BlogPostRecord>();
  for (const list of lists) {
    for (const row of list) {
      if (!row?.slug) continue;
      const key = row.id || row.slug;
      const prev = byKey.get(key) || byKey.get(row.slug);
      if (!prev) {
        byKey.set(row.slug, row);
        if (row.id) byKey.set(row.id, row);
        continue;
      }
      // Prefer newer updated_at
      const prevTs = Date.parse(prev.updated_at || prev.published_at || '') || 0;
      const nextTs = Date.parse(row.updated_at || row.published_at || '') || 0;
      if (nextTs >= prevTs) {
        byKey.set(row.slug, row);
        if (row.id) byKey.set(row.id, row);
      }
    }
  }
  // Dedupe by slug
  const bySlug = new Map<string, BlogPostRecord>();
  for (const row of byKey.values()) {
    const existing = bySlug.get(row.slug);
    if (!existing) {
      bySlug.set(row.slug, row);
      continue;
    }
    const prevTs = Date.parse(existing.updated_at || existing.published_at || '') || 0;
    const nextTs = Date.parse(row.updated_at || row.published_at || '') || 0;
    if (nextTs >= prevTs) bySlug.set(row.slug, row);
  }
  return [...bySlug.values()].sort((a, b) =>
    String(b.published_at || b.updated_at || '').localeCompare(String(a.published_at || a.updated_at || '')),
  );
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

export async function resolveBlogBucket(): Promise<string> {
  const cached = cachedBucket();
  if (cached) return cached;

  for (const bucket of bucketAttemptOrder()) {
    const { error } = await rawSupabase.storage.from(bucket).list('blog', { limit: 1 });
    if (!error || !isMissingBucketError(error as any)) {
      rememberBucket(bucket);
      return bucket;
    }
  }
  return bucketAttemptOrder()[0];
}

async function downloadCmsJson(bucket: string): Promise<BlogPostRecord[] | null> {
  const { data, error } = await rawSupabase.storage.from(bucket).download(BLOG_CMS_FILE);
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404') || (error as any).statusCode === '404') {
      return null; // missing file — try other buckets
    }
    if (isMissingBucketError(error as any)) return null;
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
    cacheControl: '0',
  });
  if (error) throw error;
  rememberBucket(bucket);
}

/** Load CMS posts from every reachable bucket + localStorage (do not stop on empty). */
export async function listStorageBlogPosts(): Promise<BlogPostRecord[]> {
  const lists: BlogPostRecord[][] = [loadLocalCmsPosts()];
  for (const bucket of bucketAttemptOrder()) {
    try {
      const rows = await downloadCmsJson(bucket);
      if (rows && rows.length > 0) {
        rememberBucket(bucket);
        lists.push(rows);
      } else if (rows) {
        // empty file exists — still a valid bucket
        rememberBucket(bucket);
      }
    } catch (err) {
      console.warn(`[blog] storage list via ${bucket} failed:`, (err as Error)?.message);
    }
  }
  return mergePostMaps(...lists);
}

/** Public published posts: scan all buckets (empty file ≠ stop) + localStorage. */
export async function listPublishedStorageBlogPosts(): Promise<BlogPostRecord[]> {
  const lists: BlogPostRecord[][] = [];

  for (const bucket of bucketAttemptOrder()) {
    const url = `${publicObjectUrl(bucket, BLOG_CMS_FILE)}?t=${Date.now()}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const parsed = await res.json();
      const rows = Array.isArray(parsed) ? (parsed as BlogPostRecord[]) : [];
      if (rows.length > 0) {
        rememberBucket(bucket);
        lists.push(rows);
      }
    } catch {
      /* try next bucket */
    }
  }

  // Authenticated download path (same browser / admin session)
  try {
    const authed = await listStorageBlogPosts();
    if (authed.length) lists.push(authed);
  } catch {
    /* ignore */
  }

  lists.push(loadLocalCmsPosts());
  return mergePostMaps(...lists).filter((p) => Boolean(p.published));
}

export async function getPublishedStorageBlogPost(slug: string): Promise<BlogPostRecord | null> {
  const rows = await listPublishedStorageBlogPosts();
  return rows.find((p) => p.slug === slug) || null;
}

/**
 * Public landing feed: merge DB table + storage + localStorage.
 * Never rely on a single source — table RLS or empty seed files used to hide posts.
 */
export async function loadAllPublishedBlogPosts(): Promise<BlogPostRecord[]> {
  const lists: BlogPostRecord[][] = [];

  const tableOk = await probeBlogTable();
  if (tableOk) {
    const { data, error } = await rawSupabase
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false });
    if (!error && data?.length) {
      lists.push(data as BlogPostRecord[]);
    } else if (error && isMissingRelationError(error)) {
      invalidateBlogTableProbe();
    } else if (error) {
      console.warn('[blog] published table fetch failed:', error.message);
    }
  }

  try {
    lists.push(await listPublishedStorageBlogPosts());
  } catch (err) {
    console.warn('[blog] storage published fetch failed:', (err as Error)?.message);
  }

  const deleted = await loadDeletedSlugs();
  return filterOutDeletedSlugs(
    mergePostMaps(...lists).filter((p) => Boolean(p.published)),
    deleted,
  );
}

export async function loadPublishedBlogPostBySlug(slug: string): Promise<BlogPostRecord | null> {
  const deleted = await loadDeletedSlugs();
  if (deleted.has(slug)) return null;

  const tableOk = await probeBlogTable();
  if (tableOk) {
    const { data, error } = await rawSupabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (!error && data) return data as BlogPostRecord;
    if (error && isMissingRelationError(error)) invalidateBlogTableProbe();
  }
  return getPublishedStorageBlogPost(slug);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `blog-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function writePostsToStorage(posts: BlogPostRecord[]): Promise<string> {
  let lastError: unknown;
  let writtenBucket: string | null = null;

  for (const bucket of bucketAttemptOrder()) {
    try {
      await uploadCmsJson(bucket, posts);
      writtenBucket = bucket;
      break;
    } catch (err) {
      lastError = err;
      console.warn(`[blog] write via ${bucket} failed:`, (err as Error)?.message);
    }
  }

  // Mirror to a second common bucket when possible so public fetch finds it
  if (writtenBucket) {
    for (const bucket of bucketAttemptOrder()) {
      if (bucket === writtenBucket) continue;
      try {
        await uploadCmsJson(bucket, posts);
      } catch {
        /* optional mirror */
      }
      break;
    }
    return writtenBucket;
  }

  throw new Error(formatBlogError(lastError, 'Could not write blog post to storage'));
}

function upsertLocal(row: BlogPostRecord) {
  const existing = loadLocalCmsPosts().filter((p) => p.id !== row.id && p.slug !== row.slug);
  saveLocalCmsPosts([row, ...existing]);
}

function removeLocal(id: string) {
  saveLocalCmsPosts(loadLocalCmsPosts().filter((p) => p.id !== id));
}

export async function createStorageBlogPost(
  input: BlogPostInput,
  createdBy: string | null | undefined,
): Promise<BlogPostRecord> {
  const existing = await listStorageBlogPosts();
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
  const next = [row, ...existing.filter((p) => p.slug !== row.slug)];
  upsertLocal(row);
  try {
    await unmarkSlugDeleted(row.slug);
  } catch {
    /* ignore */
  }
  try {
    await writePostsToStorage(next);
  } catch (err) {
    // localStorage already has it — public page on this browser still works
    console.warn('[blog] storage write failed after local save:', (err as Error)?.message);
  }
  return row;
}

export async function updateStorageBlogPost(
  id: string,
  input: BlogPostInput,
): Promise<BlogPostRecord> {
  const existing = await listStorageBlogPosts();
  const idx = existing.findIndex((p) => p.id === id);
  const prev = idx >= 0 ? existing[idx] : loadLocalCmsPosts().find((p) => p.id === id);
  if (!prev) throw new Error('Post not found');
  if (existing.some((p) => p.slug === input.slug && p.id !== id)) {
    throw new Error(`A post with slug “${input.slug}” already exists`);
  }
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
  const next = existing.filter((p) => p.id !== id);
  next.unshift(row);
  upsertLocal(row);
  try {
    await writePostsToStorage(next);
  } catch (err) {
    console.warn('[blog] storage write failed after local save:', (err as Error)?.message);
  }
  return row;
}

export async function deleteStorageBlogPost(id: string, slug?: string): Promise<void> {
  const existing = await listStorageBlogPosts();
  const next = existing.filter((p) => {
    if (p.id === id) return false;
    if (slug && p.slug === slug) return false;
    return true;
  });
  removeLocal(id);
  if (slug) {
    saveLocalCmsPosts(loadLocalCmsPosts().filter((p) => p.id !== id && p.slug !== slug));
  }
  try {
    await writePostsToStorage(next);
  } catch (err) {
    // Local already updated — surface warning but don't pretend remote delete succeeded silently
    console.warn('[blog] storage delete mirror failed:', (err as Error)?.message);
    throw new Error(
      formatBlogError(err, 'Removed locally but could not update remote blog storage. Retry delete.'),
    );
  }
}

/**
 * Fully remove a CMS post from table + storage + local, and tombstone the slug
 * so static demo seeds with the same slug do not reappear.
 */
export async function deleteBlogPostEverywhere(id: string, slug?: string): Promise<void> {
  const resolvedSlug = slug
    || (isDemoLikeId(id) ? id.replace(/^demo:/, '') : undefined)
    || (await resolveSlugForId(id));

  // Tombstone first so public/admin merges hide the post even if storage mirror lags
  if (resolvedSlug) {
    await markSlugDeleted(resolvedSlug);
  }

  const tableOk = await probeBlogTable();
  if (tableOk && !isDemoLikeId(id)) {
    const { error } = await rawSupabase.from('blog_posts').delete().eq('id', id);
    if (error && !isMissingRelationError(error)) {
      throw new Error(formatBlogError(error, 'Failed to delete blog post from database'));
    }
    if (error && isMissingRelationError(error)) {
      invalidateBlogTableProbe();
    }
    if (resolvedSlug) {
      const { error: slugErr } = await rawSupabase.from('blog_posts').delete().eq('slug', resolvedSlug);
      if (slugErr && !isMissingRelationError(slugErr)) {
        console.warn('[blog] table delete by slug failed:', slugErr.message);
      }
    }
  }

  if (!isDemoLikeId(id)) {
    try {
      await deleteStorageBlogPost(id, resolvedSlug);
    } catch (err) {
      // Local + tombstone already updated; warn instead of failing the whole delete
      console.warn('[blog] storage delete:', (err as Error)?.message);
    }
  }
}

function isDemoLikeId(id: string): boolean {
  return String(id || '').startsWith('demo:');
}

async function resolveSlugForId(id: string): Promise<string | undefined> {
  if (isDemoLikeId(id)) return id.replace(/^demo:/, '');
  const local = loadLocalCmsPosts().find((p) => p.id === id);
  if (local?.slug) return local.slug;
  try {
    const stored = (await listStorageBlogPosts()).find((p) => p.id === id);
    if (stored?.slug) return stored.slug;
  } catch {
    /* ignore */
  }
  const tableOk = await probeBlogTable();
  if (tableOk) {
    const { data } = await rawSupabase.from('blog_posts').select('slug').eq('id', id).maybeSingle();
    if (data?.slug) return data.slug;
  }
  return undefined;
}

/** Dual-write helper after a successful table insert/update. */
export async function mirrorPostToStorageAndLocal(row: BlogPostRecord): Promise<void> {
  if (row.slug) {
    try {
      await unmarkSlugDeleted(row.slug);
    } catch {
      /* ignore */
    }
  }
  upsertLocal(row);
  try {
    const existing = await listStorageBlogPosts();
    const next = [row, ...existing.filter((p) => p.id !== row.id && p.slug !== row.slug)];
    await writePostsToStorage(next);
  } catch (err) {
    console.warn('[blog] mirror to storage failed:', (err as Error)?.message);
  }
}
