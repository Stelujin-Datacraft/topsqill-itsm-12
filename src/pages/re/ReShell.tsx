import { NavLink, Outlet } from 'react-router-dom';
import { Building2, LayoutDashboard, Users, Home, Inbox, Cable } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/re', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/re/leads', end: false, label: 'Leads', icon: Inbox },
  { to: '/re/listings', end: false, label: 'Listings', icon: Home },
  { to: '/re/profiles', end: false, label: 'Profiles', icon: Users },
  { to: '/re/sources', end: false, label: 'Sources', icon: Cable },
];

export default function ReShell() {
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
        {tabs.map(({ to, end, label, icon: Icon }) => (
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
