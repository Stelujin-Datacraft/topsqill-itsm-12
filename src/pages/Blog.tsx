import { Link, useLocation } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { BLOG_POSTS } from '@/content/blog/posts';
import { stripMarketPrefix } from '@/lib/seo';

export default function Blog() {
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';

  return (
    <PublicPageLayout
      eyebrow="Blog"
      title="Insights on forms, workflows & operations"
      description="Practical articles from the TopSqill team — unique metadata, authors, and publish dates on every post."
      contentClassName="max-w-3xl mx-auto"
    >
      <ul className="space-y-8">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug} className="border-b border-border/60 pb-8">
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
