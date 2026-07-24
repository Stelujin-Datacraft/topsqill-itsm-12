import React, { useContext } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useDelegation } from '@/contexts/DelegationContext';
import { DelegationSwitcher } from './DelegationSwitcher';
import { LayoutContext } from './ProtectedLayout';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * DashboardLayout component that provides the sidebar and header.
 * If rendered inside ProtectedLayout (via LayoutContext), it will skip
 * rendering the sidebar wrapper and only render the content with header.
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  description,
  actions
}) => {
  const { isImpersonating } = useImpersonation();
  const { isActingOnBehalf } = useDelegation();
  const isInsideLayout = useContext(LayoutContext);
  
  // Content with header - shared between both modes
  const content = (
    <>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 px-4 py-3 sm:py-3.5 shrink-0 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <SidebarTrigger className="shrink-0" />
            <div className="min-w-0 flex-1">
              {title && <h1 className="page-header-title truncate">{title}</h1>}
              {description && <p className="page-header-description line-clamp-2 mt-0.5">{description}</p>}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap [&>*]:shrink-0 overflow-x-auto scrollbar-hide -mx-1 px-1">
              <DelegationSwitcher />
              {actions}
            </div>
          )}
          {!actions && (
            <div className="flex items-center gap-2">
              <DelegationSwitcher />
            </div>
          )}
        </div>
      </header>
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-h-0 flex flex-col app-shell-bg">
        {children}
      </div>
    </>
  );

  // If inside ProtectedLayout, just render content (sidebar already exists)
  if (isInsideLayout) {
    return content;
  }
  
  // Standalone mode - render full layout with sidebar (for pages not yet migrated)
  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full ${isImpersonating || isActingOnBehalf ? 'pt-12' : ''}`}>
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {content}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
