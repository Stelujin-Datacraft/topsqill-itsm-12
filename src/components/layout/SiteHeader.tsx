import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';
import { useAuth } from '@/contexts/AuthContext';
import {
  MARKETING_NAV_ITEMS,
  isMarketingNavActive,
  marketingHref,
} from '@/lib/marketingNav';
import { cn } from '@/lib/utils';

type SiteHeaderProps = {
  /** Slightly tighter padding on dense public pages */
  compact?: boolean;
};

export default function SiteHeader({ compact = false }: SiteHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut, isLoading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const displayName = useMemo(() => {
    const fullName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim();
    return fullName || userProfile?.email || user?.email || 'Account';
  }, [userProfile, user]);

  const homeHref = marketingHref('/', location.pathname);

  const items = useMemo(
    () =>
      MARKETING_NAV_ITEMS.map((item) => ({
        ...item,
        href: marketingHref(item.path, location.pathname),
        label: item.labelKey ? t(item.labelKey) : item.fallbackLabel,
        active: isMarketingNavActive(item.path, location.pathname),
      })),
    [location.pathname, t],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate(homeHref, { replace: true });
  };

  const linkClass = (active: boolean) =>
    cn(
      'transition-colors text-left whitespace-nowrap',
      active ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
    );

  return (
    <header className="sticky top-0 z-50 border-b border-primary/15 bg-background/80 backdrop-blur-xl shadow-sm">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'var(--gradient-header)' }} />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary/60 via-accent/40 to-transparent" />
      <div
        className={cn(
          'container relative mx-auto px-4 flex items-center justify-between gap-3',
          compact ? 'py-3' : 'py-3 sm:py-4',
        )}
      >
        <Link to={homeHref} className="flex items-center space-x-3 min-w-0">
          <OptimizedImage
            src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png"
            webpSrc="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.webp"
            alt="TopSqill"
            width={36}
            height={36}
            priority
            className="w-9 h-9 object-contain shrink-0"
          />
          <span className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">
            {t('common.appName')}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-4 xl:gap-5 text-sm font-medium min-w-0 overflow-x-auto">
          {items.map((item) => (
            <Link key={item.path} to={item.href} className={linkClass(item.active)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isLoading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[160px] sm:max-w-[220px] gap-1.5">
                  <span className="truncate">{displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate('/build')}>
                  AI Builder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleSignOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:block">
                <Button variant="outline" size="sm">{t('nav.signIn')}</Button>
              </Link>
              <Link to="/auth?mode=signup" className="hidden sm:block">
                <Button size="sm">{t('nav.signUp')}</Button>
              </Link>
            </>
          )}

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden px-2.5"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,20rem)] p-0 flex flex-col">
              <SheetHeader className="border-b px-5 py-4 text-left">
                <SheetTitle className="text-base font-semibold">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 p-3 overflow-y-auto">
                {items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      item.active ? 'bg-muted text-foreground' : 'text-foreground/90 hover:bg-muted',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              {!isLoading && !user && (
                <div className="mt-auto border-t p-4 flex flex-col gap-2 sm:hidden">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/auth" onClick={() => setMobileNavOpen(false)}>{t('nav.signIn')}</Link>
                  </Button>
                  <Button asChild size="sm" className="w-full">
                    <Link to="/auth?mode=signup" onClick={() => setMobileNavOpen(false)}>{t('nav.signUp')}</Link>
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
