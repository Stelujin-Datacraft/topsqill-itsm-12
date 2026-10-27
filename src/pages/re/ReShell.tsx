import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  Home,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Search,
  Users,
  Cable,
  Network,
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isReNetworkUiEnabled } from '@/lib/re/feature';
import { ReMessagingDrawer } from '@/components/re/ReMessagingDrawer';

const crmTabs = [
  { to: '/re', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/re/leads', end: false, label: 'Leads', icon: Inbox },
  { to: '/re/listings', end: false, label: 'Listings', icon: Home },
  { to: '/re/profiles', end: false, label: 'Profiles', icon: Users },
  { to: '/re/sources', end: false, label: 'Sources', icon: Cable },
];

const networkNav = [
  { to: '/re/home', end: false, label: 'Home', icon: Home },
  { to: '/re/network', end: false, label: 'Network', icon: Network },
  { to: '/re/properties', end: false, label: 'Properties', icon: Briefcase },
  { to: '/re/leads', end: false, label: 'CRM', icon: Inbox },
  { to: '/re/messages', end: false, label: 'Messaging', icon: MessageSquare },
  { to: '/re/notifications', end: false, label: 'Notifications', icon: Bell },
];

function CrmShell() {
  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div className="flex items-start gap-2">
        <SidebarTrigger className="shrink-0 mt-1" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary shrink-0" />
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">
              Real Estate Lead Gen
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Additive module — existing Forms, Workflows, and Access Control are unchanged.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {crmTabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

function NetworkShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/re' || location.pathname === '/re/') {
      navigate('/re/home', { replace: true });
    }
  }, [location.pathname, navigate]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/re/network?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f3f2ef] dark:bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/95 dark:bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 flex items-center gap-3">
          <SidebarTrigger className="shrink-0" />
          <NavLink to="/re/home" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
              TQ
            </div>
            <span className="hidden sm:inline font-semibold text-sm tracking-tight">
              TopSqill RE
            </span>
          </NavLink>

          <form onSubmit={onSearch} className="flex-1 max-w-xs sm:max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="I'm looking for…"
                className="pl-8 h-9 rounded-full bg-muted/60 border-0"
                aria-label="Global search"
              />
            </div>
          </form>

          <nav className="hidden md:flex items-center gap-0.5 ml-auto">
            {networkNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center px-3 py-1 min-w-[64px] text-[11px] border-b-2 transition-colors',
                    isActive
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5 mb-0.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="md:hidden"
            onClick={() => setMsgOpen(true)}
            aria-label="Open messaging"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="hidden md:inline-flex"
            onClick={() => setMsgOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Messages
          </Button>
        </div>

        <nav className="md:hidden flex overflow-x-auto border-t gap-1 px-2 py-1">
          {networkNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4">
          <Outlet />
        </div>
      </div>

      <ReMessagingDrawer open={msgOpen} onOpenChange={setMsgOpen} />
    </div>
  );
}

export default function ReShell() {
  if (isReNetworkUiEnabled()) return <NetworkShell />;
  return <CrmShell />;
}
