import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicPageLayout from '@/components/layout/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { mergeBlogPosts } from '@/content/blog/posts';
import { usePublishedBlogPosts } from '@/hooks/useBlogPosts';
import { stripMarketPrefix } from '@/lib/seo';
import { OptimizedImage } from '@/components/OptimizedImage';
import { ArrowRight, Mail, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTACT_EMAIL = 'contact@topsqill.com';

function ContactPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`TopSqill blog inquiry — ${name || 'Reader'}`);
    const body = encodeURIComponent(
      [`Name: ${name}`, `Email: ${email}`, '', message || '(no message)'].join('\n'),
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-gradient-to-b from-primary/[0.04] to-background p-5 shadow-sm',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
        Contact
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
        Talk to TopSqill
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">
        Questions about forms, workflows, or a demo? Send a short note — we reply quickly.
      </p>

      <form className={cn('mt-5 space-y-3', compact && 'space-y-2.5')} onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="blog-contact-name" className="text-xs">Name</Label>
          <Input
            id="blog-contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="blog-contact-email" className="text-xs">Work email</Label>
          <Input
            id="blog-contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="blog-contact-message" className="text-xs">Message</Label>
          <Textarea
            id="blog-contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={compact ? 3 : 4}
            placeholder="What are you trying to solve?"
            className="resize-none text-sm"
          />
        </div>
        <Button type="submit" size="sm" className="w-full gap-1.5">
          <Mail className="h-4 w-4" />
          {sent ? 'Opening email…' : 'Send message'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-foreground/55">
        Or visit the{' '}
        <Link to="/contact" className="font-medium text-primary underline underline-offset-4">
          contact page
        </Link>
      </p>
    </div>
  );
}

export default function Blog() {
  const { pathname } = useLocation();
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  const { data: dbPosts, isLoading, isFetching, refetch } = usePublishedBlogPosts();
  const posts = mergeBlogPosts(dbPosts);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const postIds = useMemo(
    () => posts.map((p) => ({ slug: p.slug, title: p.title })),
    [posts],
  );

  useEffect(() => {
    if (posts.length === 0) return;
    setActiveSlug((prev) => prev ?? posts[0].slug);

    const nodes = posts
      .map((p) => document.getElementById(`post-${p.slug}`))
      .filter((el): el is HTMLElement => !!el);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target?.id?.startsWith('post-')) {
          setActiveSlug(top.target.id.slice('post-'.length));
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [posts]);

  const scrollToPost = (slug: string) => {
    setActiveSlug(slug);
    document.getElementById(`post-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PublicPageLayout
      eyebrow="Blog"
      title="Insights on forms, workflows & operations"
      description="Practical articles from the TopSqill team — unique metadata, authors, and publish dates on every post."
      contentClassName="max-w-7xl mx-auto"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/55">
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

      {/* Mobile: index + contact trigger */}
      <div className="mb-6 flex flex-wrap items-center gap-2 lg:hidden">
        {postIds.length > 0 && (
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {postIds.map((item, index) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => scrollToPost(item.slug)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeSlug === item.slug
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
              <ContactPanel compact className="border-0 bg-transparent p-0 shadow-none" />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading && posts.length === 0 ? (
        <p className="text-sm text-foreground/70">Loading posts…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)_17.5rem] xl:grid-cols-[15rem_minmax(0,1fr)_18.5rem] xl:gap-10">
          {/* Left: article index */}
          <aside className="hidden lg:block">
            <nav
              aria-label="Article index"
              className="sticky top-24 rounded-xl border border-border/70 bg-background/80 p-4 backdrop-blur-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
                Index
              </p>
              <ol className="mt-4 space-y-1">
                {postIds.map((item, index) => {
                  const isActive = activeSlug === item.slug;
                  return (
                    <li key={item.slug}>
                      <button
                        type="button"
                        onClick={() => scrollToPost(item.slug)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
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
                          {item.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          {/* Middle: posts */}
          <div>
            <ul className="space-y-5">
              {posts.map((post, index) => (
                <li
                  key={`${post.source}-${post.slug}`}
                  id={`post-${post.slug}`}
                  className="scroll-mt-28 rounded-xl border border-border/70 bg-card/40 p-5 sm:p-6 shadow-sm transition-colors hover:border-primary/25 hover:bg-card/70"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-foreground/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <time
                      dateTime={post.publishedAt}
                      className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/50"
                    >
                      {post.publishedAt}
                    </time>
                  </div>

                  {post.coverImageUrl && (
                    <Link
                      to={`${base}/blog/${post.slug}`}
                      className="mb-4 block overflow-hidden rounded-lg border border-border/60"
                      onClick={() => setActiveSlug(post.slug)}
                    >
                      <OptimizedImage
                        src={post.coverImageUrl}
                        alt=""
                        width={1200}
                        height={630}
                        className="w-full max-h-52 object-cover"
                      />
                    </Link>
                  )}

                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                    <Link
                      to={`${base}/blog/${post.slug}`}
                      className="hover:text-primary transition-colors"
                      onClick={() => setActiveSlug(post.slug)}
                    >
                      {post.title}
                    </Link>
                  </h2>

                  <p className="mt-2 text-[15px] leading-relaxed text-foreground/75">
                    {post.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-foreground/60">
                      <span className="font-medium text-foreground">{post.authorName}</span>
                      {post.modifiedAt !== post.publishedAt && (
                        <>
                          {' · Updated '}
                          <time dateTime={post.modifiedAt}>{post.modifiedAt}</time>
                        </>
                      )}
                    </p>
                    <Link
                      to={`${base}/blog/${post.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
                      onClick={() => setActiveSlug(post.slug)}
                    >
                      Read article
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {/* Mobile contact panel after list */}
            <div className="mt-8 lg:hidden">
              <ContactPanel />
            </div>
          </div>

          {/* Right: contact */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <ContactPanel />
            </div>
          </aside>
        </div>
      )}
    </PublicPageLayout>
  );
}
