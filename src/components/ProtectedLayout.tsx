import React, { Suspense, createContext } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Context to signal that we're inside ProtectedLayout
// DashboardLayout checks this to avoid double-wrapping
export const LayoutContext = createContext<boolean>(false);

/**
 * Content loader - shown only in the main content area during route transitions
 */
function ContentLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Persistent layout wrapper for protected routes.
 * The sidebar stays mounted while only the content area (Outlet) suspends during route transitions.
 * This prevents the "full page loading" flash when navigating between lazy-loaded routes.
 */
const ProtectedLayout: React.FC = () => {
  const { user, userProfile, isLoading } = useAuth();
  const { isImpersonating } = useImpersonation();
  const location = useLocation();

  // Auth loading state - show full page loader since we don't know if user is authenticated
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No user - redirect to auth
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  // No user profile - show setup message
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Profile Setup Required</h2>
          <p className="text-muted-foreground mb-4">
            Your user profile is being created. Please wait a moment and refresh the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="text-primary hover:underline mr-4"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // No organization - show error
  if (!userProfile.organization_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Organization Required</h2>
          <p className="text-muted-foreground mb-4">
            Your account is not associated with an organization.
          </p>
          <button 
            onClick={() => window.location.href = '/auth'}
            className="text-primary hover:underline"
          >
            Return to authentication
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - render layout with sidebar
  // LayoutContext.Provider tells DashboardLayout it's already inside a layout
  return (
    <LayoutContext.Provider value={true}>
      <SidebarProvider>
        <div className={`min-h-screen flex w-full ${isImpersonating ? 'pt-12' : ''}`}>
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Suspense wraps only the content, sidebar stays visible */}
            <Suspense fallback={<ContentLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </SidebarProvider>
    </LayoutContext.Provider>
  );
};

export default ProtectedLayout;
