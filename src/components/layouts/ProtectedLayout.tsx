import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { ContentLoader } from './ContentLoader';

/**
 * Persistent layout for protected routes.
 * The sidebar remains visible during page transitions - only the content area reloads.
 * This prevents the jarring full-page loading experience.
 */
const ProtectedLayout: React.FC = () => {
  const { isImpersonating } = useImpersonation();
  
  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full ${isImpersonating ? 'pt-12' : ''}`}>
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <Suspense fallback={<ContentLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default ProtectedLayout;
