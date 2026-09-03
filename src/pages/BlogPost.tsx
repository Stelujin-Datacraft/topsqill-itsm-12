import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import BlogContactPanel from '@/components/blog/BlogContactPanel';
import { prepareHtmlWithToc, tocFromParagraphs } from '@/components/blog/blogToc';
import { findMergedPost } from '@/content/blog/posts';
import { usePublishedBlogPost } from '@/hooks/useBlogPosts';
import { loadDeletedSlugs } from '@/lib/blogCms';
import { stripMarketPrefix } from '@/lib/seo';
import { Seo } from '@/components/Seo';
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd } from '@/lib/structuredData';
import { OptimizedImage } from '@/components/OptimizedImage';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/components/ui/tiptap-styles.css';

export default function BlogPost() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  const { data: dbRow, isLoading } = usePublishedBlogPost(slug);
  const { data: deletedSlugs = [] } = useQuery({
    queryKey: ['blog_deleted_slugs'],
    queryFn: async () => [...(await loadDeletedSlugs())],
    staleTime: 5_000,
    refetchOnMount: 'always',
  });
  const post = findMergedPost(slug, dbRow, deletedSlugs);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const prepared = useMemo(() => {
    if (!post) return { html: '', toc: [] as ReturnType<typeof tocFromParagraphs>, paragraphs: [] as string[] };
    if (post.contentHtml) {
      const { html, toc } = prepareHtmlWithToc(post.contentHtml);
      return { html, toc, paragraphs: [] as string[] };
    }
    const paragraphs = post.body || [];
    return { html: '', toc: tocFromParagraphs(paragraphs), paragraphs };
  }, [post]);

  useEffect(() => {
    if (prepared.toc.length === 0) return;
    setActiveSection((prev) => prev ?? prepared.toc[0].id);

    const nodes = prepared.toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => !!el);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target?.id) setActiveSection(top.target.id);
      },
      { rootMargin: '-18% 0px -60% 0px', threshold: [0.1, 0.25, 0.5] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [prepared]);

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

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const indexNav = prepared.toc.length > 0 && (
    <nav
      aria-label="Article sections"
      className="rounded-xl border border-border/70 bg-background/80 p-4 backdrop-blur-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
        In this article
      </p>
      <ol className="mt-4 space-y-1">
        {prepared.toc.map((item, index) => {
          const isActive = activeSection === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                  item.level === 3 && 'pl-4',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground/70 hover:bg-muted/70 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground/70',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="line-clamp-2 text-sm leading-snug font-medium">
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  return (
    <PublicPageLayout
      eyebrow="Article"
      title={post.title}
      description={post.description}
      meta={`By ${post.authorName} · Published ${post.publishedAt}`}
      contentClassName="max-w-7xl mx-auto"
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

      {/* Mobile: section chips + contact sheet */}
      <div className="mb-6 flex flex-wrap items-center gap-2 lg:hidden">
        {prepared.toc.length > 0 && (
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {prepared.toc.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeSection === item.id
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/70 bg-background text-foreground/70 hover:border-border hover:text-foreground',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Contact
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100%,22rem)] overflow-y-auto p-0">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>Contact</SheetTitle>
              <SheetDescription>Send a short note about your use case.</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <BlogContactPanel
                compact
                idPrefix="post-contact-sheet"
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)_17.5rem] xl:grid-cols-[15rem_minmax(0,1fr)_18.5rem] xl:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            {indexNav}
            <Link
              to={`${base}/blog`}
              className="block text-sm font-medium text-primary underline underline-offset-4"
            >
              ← All posts
            </Link>
          </div>
        </aside>

        <div>
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

            {prepared.html ? (
              <div
                className="tiptap prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-relaxed text-foreground/85 [&_p]:text-foreground/85 [&_li]:text-foreground/85 [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28"
                dangerouslySetInnerHTML={{ __html: prepared.html }}
              />
            ) : (
              prepared.paragraphs.map((para, index) => (
                <p
                  key={prepared.toc[index]?.id || para.slice(0, 48)}
                  id={prepared.toc[index]?.id}
                  className="scroll-mt-28 text-[15px] leading-relaxed text-foreground/85"
                >
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

          <div className="mt-8 lg:hidden">
            <BlogContactPanel idPrefix="post-contact-mobile" />
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <BlogContactPanel idPrefix="post-contact-desktop" />
          </div>
        </aside>
      </div>
    </PublicPageLayout>
  );
}
