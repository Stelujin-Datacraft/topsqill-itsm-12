import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface PageContentProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

/**
 * Page content wrapper for use inside ProtectedLayout.
 * Provides consistent header styling and content spacing.
 * Use this instead of DashboardLayout for pages that render inside the persistent layout.
 */
const PageContent: React.FC<PageContentProps> = ({
  children,
  title,
  description,
  actions
}) => {
  return (
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
};

export default PageContent;
