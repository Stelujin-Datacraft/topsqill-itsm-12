import { OptimizedImage } from '@/components/OptimizedImage';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ArrowLeft, Mail, MapPin, Linkedin, Menu } from 'lucide-react';

const LINKEDIN = 'https://www.linkedin.com/company/topsqill-pvt-ltd/posts/?feedView=all';

const PUBLIC_NAV = [
  { to: '/solutions', label: 'Solutions' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
] as const;

interface PublicPageLayoutProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  meta?: string;
  children: ReactNode;
  /** Constrain main content width. Defaults to a readable measure. */
  contentClassName?: string;
  /** Render children full-bleed without the built-in hero or container. */
  bare?: boolean;
}

export default function PublicPageLayout({
  eyebrow,
  title,
  description,
  meta,
  children,
  contentClassName = 'max-w-3xl mx-auto',
  bare = false,
}: PublicPageLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/15 bg-background/80 backdrop-blur-xl shadow-sm">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--gradient-header)' }} />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary/60 via-accent/40 to-transparent" />
        <div className="container relative mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <OptimizedImage
              src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png"
              webpSrc="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.webp"
              alt="TopSqill"
              width={32}
              height={32}
              priority
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="text-lg font-semibold tracking-tight text-foreground truncate">TopSqill</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-foreground/70 hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="gap-1.5 text-foreground/70">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link to="/auth" className="hidden sm:inline-flex">
              <Button size="sm">Sign in</Button>
            </Link>

            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden px-2.5"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100%,20rem)] p-0">
                <SheetHeader className="border-b px-5 py-4 text-left">
                  <SheetTitle className="text-base font-semibold">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 p-3">
                  {PUBLIC_NAV.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-muted transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    to="/"
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-muted transition-colors"
                  >
                    Home
                  </Link>
                </div>
                <div className="border-t p-4">
                  <Button asChild size="sm" className="w-full">
                    <Link to="/auth" onClick={() => setMobileNavOpen(false)}>Sign in</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Page hero */}
      {!bare && title && (
      <div className="relative border-b border-border/60 bg-gradient-to-b from-primary/[0.06] to-transparent">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className={contentClassName}>
            {eyebrow && (
              <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
                {eyebrow}
              </Badge>
            )}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-4 text-base sm:text-lg text-foreground/75 leading-relaxed">
                {description}
              </p>
            )}
            {meta && (
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-foreground/55">
                {meta}
              </p>
            )}
          </div>
        </div>
      </div>
      )}

      <main className="flex-1">
        {bare ? (
          children
        ) : (
          <div className="container mx-auto px-4 py-12 sm:py-16">
            <div className={contentClassName}>{children}</div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative bg-primary text-brand-deep-foreground">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="container relative mx-auto px-4 py-12">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <OptimizedImage
                  src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png"
                  webpSrc="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.webp"
                  alt="TopSqill"
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                />
                <span className="text-xl font-bold tracking-tight text-brand-deep-foreground">TopSqill</span>
              </div>
              <p className="max-w-md leading-relaxed text-brand-deep-muted">
                Enterprise platform for forms, workflows, reports and governance — one governed system for your operations.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link to="/solutions" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">Solutions</Link>
                <Link to="/pricing" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">Pricing</Link>
                <Link to="/blog" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">Blog</Link>
                <Link to="/about" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">About Us</Link>
                <Link to="/contact" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">Contact</Link>
                <Link to="/in" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">India</Link>
                <Link to="/ae" className="text-brand-deep-muted hover:text-brand-deep-foreground transition-colors">UAE</Link>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-deep-foreground">Contact</h2>
              <ul className="space-y-3 text-sm text-brand-deep-muted">
                <li className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-brand-deep-foreground/80" />
                  <span>
                    B-439, Bhutani Technopark, Sector 127<br />
                    Noida — 201313, India
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-brand-deep-foreground/80" />
                  <a href="mailto:contact@topsqill.com" className="hover:text-brand-deep-foreground transition-colors">
                    contact@topsqill.com
                  </a>
                </li>
                <li>
                  <a
                    href={LINKEDIN}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TopSqill on LinkedIn"
                    className="inline-flex items-center justify-center size-9 rounded-full border border-brand-deep-foreground/25 text-brand-deep-foreground hover:bg-brand-deep-foreground/10 transition-colors"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-brand-deep-foreground/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-brand-deep-muted">
            <p>&copy; {new Date().getFullYear()} TopSqill. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-brand-deep-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-brand-deep-foreground transition-colors">Terms &amp; Conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
