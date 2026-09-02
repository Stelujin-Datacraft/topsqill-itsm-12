import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { findMergedPost } from '@/content/blog/posts';
import { usePublishedBlogPost } from '@/hooks/useBlogPosts';
import { stripMarketPrefix } from '@/lib/seo';
import { Seo } from '@/components/Seo';
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd } from '@/lib/structuredData';
import { OptimizedImage } from '@/components/OptimizedImage';
import '@/components/ui/tiptap-styles.css';

export default function BlogPost() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  const { data: dbRow, isLoading } = usePublishedBlogPost(slug);
  const post = findMergedPost(slug, dbRow);

  if (!isLoading && !post) return <Navigate to={`${base}/blog`} replace />;

  if (!post) {
    return (
      <PublicPageLayout title="Loading…" description="Fetching article…" contentClassName="max-w-3xl mx-auto">
        <p className="text-sm text-foreground/70">Loading…</p>
      </PublicPageLayout>
    );
  }

  const articleForSchema = {
    slug: post.slug,
    title: post.title,
    description: post.description,
    authorName: post.authorName,
    authorTitle: post.authorTitle || '',
    publishedAt: post.publishedAt,
    modifiedAt: post.modifiedAt,
    tags: post.tags,
    body: post.body || [],
  };

  return (
    <PublicPageLayout
      eyebrow="Article"
      title={post.title}
      description={post.description}
      meta={`By ${post.authorName} · Published ${post.publishedAt}`}
      contentClassName="max-w-3xl mx-auto"
    >
      <Seo
        title={`${post.title} | TopSqill Blog`}
        description={post.description}
        path={pathname}
        ogType="article"
        publishedTime={post.publishedAt}
        modifiedTime={post.modifiedAt}
        author={post.authorName}
        image={post.coverImageUrl}
        jsonLd={[
          organizationJsonLd(),
          articleJsonLd(articleForSchema),
          breadcrumbJsonLd([
            { name: 'Home', path: base || '/' },
            { name: 'Blog', path: `${base}/blog` },
            { name: post.title, path: pathname },
          ]),
        ]}
      />

      {post.coverImageUrl && (
        <OptimizedImage
          src={post.coverImageUrl}
          alt=""
          width={1200}
          height={630}
          priority
          className="mb-8 w-full max-h-80 rounded-lg border object-cover"
        />
      )}

      <article className="max-w-none space-y-5">
        <p className="text-sm text-foreground/65">
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

        {post.contentHtml ? (
          <div
            className="tiptap prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed text-foreground/85 [&_p]:text-foreground/85 [&_li]:text-foreground/85"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        ) : (
          (post.body || []).map((para) => (
            <p key={para.slice(0, 48)} className="text-[15px] leading-relaxed text-foreground/85">
              {para}
            </p>
          ))
        )}
      </article>

      {post.tags.length > 0 && (
        <div className="mt-10 pt-8 border-t border-border/60">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
            Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-foreground/80">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <nav className="mt-10 flex flex-wrap gap-4 text-sm" aria-label="Related">
        <Link to={`${base}/blog`} className="text-primary underline underline-offset-4">All posts</Link>
        <Link to={`${base}/solutions`} className="text-primary underline underline-offset-4">Solutions</Link>
        <Link to={`${base}/pricing`} className="text-primary underline underline-offset-4">Pricing</Link>
        <Link to={`${base}/contact`} className="text-primary underline underline-offset-4">Contact</Link>
      </nav>
    </PublicPageLayout>
  );
}
