import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { mergeBlogPosts } from '@/content/blog/posts';
import { usePublishedBlogPosts } from '@/hooks/useBlogPosts';
import { loadDeletedSlugs } from '@/lib/blogCms';
import { stripMarketPrefix } from '@/lib/seo';
import { OptimizedImage } from '@/components/OptimizedImage';
import { ArrowRight } from 'lucide-react';

export default function Blog() {
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  const { data: dbPosts, isLoading, isFetching, refetch } = usePublishedBlogPosts();
  const { data: deletedSlugs = [] } = useQuery({
    queryKey: ['blog_deleted_slugs'],
    queryFn: async () => [...(await loadDeletedSlugs())],
    staleTime: 5_000,
    refetchOnMount: 'always',
  });
  const posts = mergeBlogPosts(dbPosts, deletedSlugs);

  return (
    <PublicPageLayout
      eyebrow="Blog"
      title="Insights on forms, workflows & operations"
      description="Practical articles from the TopSqill team — unique metadata, authors, and publish dates on every post."
      contentClassName="max-w-6xl mx-auto"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/55">
        <span>
          {isFetching ? 'Refreshing…' : `${posts.length} article${posts.length === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          className="underline underline-offset-4 hover:text-foreground"
          onClick={() => void refetch()}
        >
          Refresh
        </button>
      </div>

      {isLoading && posts.length === 0 ? (
        <p className="text-sm text-foreground/70">Loading posts…</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {posts.map((post, index) => (
            <li key={`${post.source}-${post.slug}`}>
              <Link
                to={`${base}/blog/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-sm transition-colors hover:border-primary/25 hover:bg-card/70"
              >
                <div className="relative aspect-[16/10] overflow-hidden border-b border-border/60 bg-muted/40">
                  {post.coverImageUrl ? (
                    <OptimizedImage
                      src={post.coverImageUrl}
                      alt=""
                      width={640}
                      height={400}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-3xl font-semibold tabular-nums text-foreground/20">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-foreground/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <time
                      dateTime={post.publishedAt}
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/50"
                    >
                      {post.publishedAt}
                    </time>
                  </div>

                  <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>

                  <p className="text-sm leading-relaxed text-foreground/70 line-clamp-3 flex-1">
                    {post.description}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <p className="text-xs sm:text-sm text-foreground/60 truncate max-w-[60%]">
                      <span className="font-medium text-foreground">{post.authorName}</span>
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary shrink-0">
                      Read
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PublicPageLayout>
  );
}
