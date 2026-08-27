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
