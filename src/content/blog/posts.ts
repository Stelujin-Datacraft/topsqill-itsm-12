import postsJson from './posts.json';

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
