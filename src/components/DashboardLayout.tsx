import React, { useContext } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useImpersonation } from '@/contexts/ImpersonationContext';
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
  const isInsideLayout = useContext(LayoutContext);
  
  // Content with header - shared between both modes
  const content = (
    <>
      <header className="border-b bg-background/95 backdrop-blur p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div>
              {title && <h1 className="text-2xl font-semibold">{title}</h1>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className="flex-1 p-6 px-[10px] mx-0 py-[10px] overflow-auto">
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
      <div className={`min-h-screen flex w-full ${isImpersonating ? 'pt-12' : ''}`}>
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {content}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
