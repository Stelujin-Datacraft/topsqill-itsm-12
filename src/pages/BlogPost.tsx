import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { getPost } from '@/content/blog/posts';
import { stripMarketPrefix } from '@/lib/seo';

export default function BlogPost() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  const post = getPost(slug);

  if (!post) return <Navigate to={`${base}/blog`} replace />;

  return (
    <PublicPageLayout
      eyebrow="Article"
      title={post.title}
      description={post.description}
      meta={`By ${post.authorName} · Published ${post.publishedAt}`}
      contentClassName="max-w-3xl mx-auto"
    >
      <div className="flex flex-wrap gap-2 mb-8">
        {post.tags.map((tag) => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>

      <article className="max-w-none space-y-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{post.authorName}</span>
          {post.authorTitle ? ` · ${post.authorTitle}` : ''}
          {' · '}
          <time dateTime={post.publishedAt}>{post.publishedAt}</time>
          {post.modifiedAt !== post.publishedAt && (
            <>
              {' · Updated '}
              <time dateTime={post.modifiedAt}>{post.modifiedAt}</time>
            </>
          )}
        </p>
        {post.body.map((para) => (
          <p key={para.slice(0, 48)} className="text-[15px] leading-relaxed text-muted-foreground">
            {para}
          </p>
        ))}
      </article>

      <nav className="mt-12 flex flex-wrap gap-4 text-sm" aria-label="Related">
        <Link to={`${base}/blog`} className="text-primary underline underline-offset-4">All posts</Link>
        <Link to={`${base}/solutions`} className="text-primary underline underline-offset-4">Solutions</Link>
        <Link to={`${base}/pricing`} className="text-primary underline underline-offset-4">Pricing</Link>
        <Link to={`${base}/contact`} className="text-primary underline underline-offset-4">Contact</Link>
      </nav>
    </PublicPageLayout>
  );
}
