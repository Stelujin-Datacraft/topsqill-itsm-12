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
  { to: '/re/home', label: 'Home', icon: Home },
  { to: '/re/network', label: 'Network', icon: Network },
  { to: '/re/properties', label: 'Properties', icon: Briefcase },
  { to: '/re/leads', label: 'CRM', icon: Inbox },
  { to: '/re/messages', label: 'Messaging', icon: MessageSquare },
  { to: '/re/notifications', label: 'Notifications', icon: Bell },
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
    navigate(term ? `/re/network?q=${encodeURIComponent(term)}` : '/re/network');
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#f4f2ee] text-[#191919] dark:bg-background dark:text-foreground">
      <header className="z-30 shrink-0 border-b border-[#e6e4e1] bg-white dark:border-border dark:bg-card">
        <div className="flex h-[56px] w-full items-center gap-2 px-3 lg:gap-4 lg:px-5">
          <SidebarTrigger className="shrink-0 text-[#666]" />
          <NavLink to="/re/home" className="flex shrink-0 items-center gap-2" aria-label="TopSqill Real Estate home">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              TQ
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight xl:inline">
              TopSqill RE
            </span>
          </NavLink>

          <form onSubmit={onSearch} className="min-w-0 max-w-[280px] flex-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                aria-label="Search professionals and properties"
                className="h-9 w-full rounded-full border-0 bg-[#edf3f8] pl-9 pr-3 text-sm outline-none ring-primary/30 placeholder:text-[#666] focus:ring-2 dark:bg-muted"
              />
            </label>
          </form>

          <nav className="ml-auto hidden h-full items-stretch md:flex">
            {networkNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-[72px] flex-col items-center justify-center gap-0.5 border-b-2 px-2 text-[12px] leading-none transition-colors',
                    isActive
                      ? 'border-[#191919] text-[#191919] dark:border-foreground dark:text-foreground'
                      : 'border-transparent text-[#666] hover:text-[#191919]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-[22px] w-[22px]', isActive && 'text-primary')} strokeWidth={1.75} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMsgOpen(true)}
              className="flex min-w-[72px] flex-col items-center justify-center gap-0.5 border-b-2 border-transparent px-2 text-[12px] leading-none text-[#666] hover:text-[#191919]"
            >
              <MessageSquare className="h-[22px] w-[22px]" strokeWidth={1.75} />
              <span>Chat</span>
            </button>
          </nav>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-[#e6e4e1] px-2 py-1.5 md:hidden">
          {networkNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-white text-[#666]',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1128px] px-3 py-4 sm:px-4 lg:py-6">
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
