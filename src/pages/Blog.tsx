import { Link, useLocation } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { mergeBlogPosts } from '@/content/blog/posts';
import { usePublishedBlogPosts } from '@/hooks/useBlogPosts';
import { stripMarketPrefix } from '@/lib/seo';
import { OptimizedImage } from '@/components/OptimizedImage';

export default function Blog() {
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  const { data: dbPosts, isLoading } = usePublishedBlogPosts();
  const posts = mergeBlogPosts(dbPosts);

  return (
    <PublicPageLayout
      eyebrow="Blog"
      title="Insights on forms, workflows & operations"
      description="Practical articles from the TopSqill team — unique metadata, authors, and publish dates on every post."
      contentClassName="max-w-3xl mx-auto"
    >
      {isLoading && posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading posts…</p>
      ) : (
        <ul className="space-y-8">
          {posts.map((post) => (
            <li key={`${post.source}-${post.slug}`} className="border-b border-border/60 pb-8">
              {post.coverImageUrl && (
                <Link to={`${base}/blog/${post.slug}`} className="block mb-4 overflow-hidden rounded-lg border">
                  <OptimizedImage
                    src={post.coverImageUrl}
                    alt=""
                    width={1200}
                    height={630}
                    className="w-full max-h-56 object-cover"
                  />
                </Link>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                <Link to={`${base}/blog/${post.slug}`} className="hover:text-primary transition-colors">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-muted-foreground leading-relaxed">{post.description}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{post.authorName}</span>
                {' · '}
                <time dateTime={post.publishedAt}>{post.publishedAt}</time>
                {post.modifiedAt !== post.publishedAt && (
                  <>
                    {' · Updated '}
                    <time dateTime={post.modifiedAt}>{post.modifiedAt}</time>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        Explore{' '}
        <Link to={`${base}/solutions`} className="text-primary underline underline-offset-4">solutions</Link>
        {' '}and{' '}
        <Link to={`${base}/pricing`} className="text-primary underline underline-offset-4">pricing</Link>
        .
      </p>
    </PublicPageLayout>
  );
}
