import postsJson from './posts.json';
import type { DisplayBlogPost } from '@/types/blog';
import { recordToDisplay, type BlogPostRecord } from '@/types/blog';

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  authorName: string;
  authorTitle: string;
  publishedAt: string;
  modifiedAt: string;
  tags: string[];
  body: string[];
};

export const BLOG_POSTS = postsJson as BlogPost[];

/** Repo path for the static seed posts shown on the marketing /blog page. */
export const STATIC_BLOG_POSTS_PATH = 'src/content/blog/posts.json';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert a built-in seed post into a CMS-shaped record for Blog admin editing. */
export function staticToRecord(post: BlogPost): BlogPostRecord {
  const publishedAt = `${post.publishedAt}T12:00:00.000Z`;
  const modifiedAt = `${post.modifiedAt}T12:00:00.000Z`;
  return {
    id: `demo:${post.slug}`,
    slug: post.slug,
    title: post.title,
    description: post.description,
    content_html: (post.body || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('\n'),
    cover_image_url: null,
    author_name: post.authorName || 'TopSqill Team',
    author_title: post.authorTitle || null,
    tags: post.tags || [],
    published: true,
    published_at: publishedAt,
    created_by: null,
    created_at: publishedAt,
    updated_at: modifiedAt,
    origin: 'demo',
  };
}

export function getDemoBlogRecords(): BlogPostRecord[] {
  return BLOG_POSTS.map(staticToRecord);
}

/**
 * Merge CMS rows with demo seeds. CMS wins on slug; demos fill gaps so they
 * appear (and are editable) in Blog admin.
 */
export function mergeAdminBlogPosts(cmsRows: BlogPostRecord[]): BlogPostRecord[] {
  const bySlug = new Map<string, BlogPostRecord>();
  for (const row of cmsRows) {
    bySlug.set(row.slug, { ...row, origin: row.origin || 'cms' });
  }
  for (const demo of getDemoBlogRecords()) {
    if (!bySlug.has(demo.slug)) bySlug.set(demo.slug, demo);
  }
  return [...bySlug.values()].sort((a, b) =>
    String(b.updated_at || b.published_at || '').localeCompare(String(a.updated_at || a.published_at || '')),
  );
}

export function getPost(slug: string | undefined): BlogPost | undefined {
  if (!slug) return undefined;
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function staticToDisplay(post: BlogPost): DisplayBlogPost {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    authorName: post.authorName,
    authorTitle: post.authorTitle,
    publishedAt: post.publishedAt,
    modifiedAt: post.modifiedAt,
    tags: post.tags,
    body: post.body,
    source: 'static',
  };
}

/** DB published posts win on slug collision; static fills the rest. */
export function mergeBlogPosts(
  dbRows: BlogPostRecord[] | undefined | null,
): DisplayBlogPost[] {
  const fromDb = (dbRows || []).map(recordToDisplay);
  const dbSlugs = new Set(fromDb.map((p) => p.slug));
  const fromStatic = BLOG_POSTS
    .filter((p) => !dbSlugs.has(p.slug))
    .map(staticToDisplay);
  return [...fromDb, ...fromStatic].sort((a, b) =>
    String(b.publishedAt).localeCompare(String(a.publishedAt)),
  );
}

export function findMergedPost(
  slug: string | undefined,
  dbRow: BlogPostRecord | null | undefined,
): DisplayBlogPost | undefined {
  if (!slug) return undefined;
  if (dbRow && dbRow.slug === slug) return recordToDisplay(dbRow);
  const staticPost = getPost(slug);
  return staticPost ? staticToDisplay(staticPost) : undefined;
}
