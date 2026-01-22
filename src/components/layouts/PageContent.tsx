import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface PageContentProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

/**
 * Standard page content wrapper for use with ProtectedLayout.
 * Provides consistent header with title, actions, and content area.
 */
export const PageContent: React.FC<PageContentProps> = ({
  children,
  title,
  actions
}) => {
  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            {title && <h1 className="text-2xl font-semibold">{title}</h1>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className="flex-1 p-6 px-[10px] mx-0 py-[10px]">
        {children}
      </div>
    </>
  );
};
