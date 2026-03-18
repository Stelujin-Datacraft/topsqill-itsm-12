import React, { Suspense, createContext, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { usePermissionRealtimeSync } from '@/hooks/usePermissionRealtimeSync';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/loading/PageSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

// Context to signal that we're inside ProtectedLayout
// DashboardLayout checks this to avoid double-wrapping
export const LayoutContext = createContext<boolean>(false);

/**
  * Content loader with skeleton - shown during route transitions
  * Maintains layout structure for smoother visual experience
 */
function ContentLoader() {
   return <PageSkeleton />;
 }
 
 /**
  * Auth loading skeleton - full page while checking authentication
  */
 function AuthLoadingSkeleton() {
   return (
     <div className="min-h-screen flex">
       {/* Sidebar placeholder */}
       <div className="w-64 border-r border-border/30 bg-card/30 p-4 space-y-4 hidden md:block">
         <Skeleton className="h-10 w-full bg-muted/40" />
         <div className="space-y-2 pt-4">
           {[...Array(8)].map((_, i) => (
             <Skeleton key={i} className="h-9 w-full bg-muted/30" />
           ))}
         </div>
       </div>
       {/* Main content placeholder */}
       <div className="flex-1 p-6">
         <PageSkeleton />
       </div>
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
  const { currentProject } = useProject();
  const { isImpersonating } = useImpersonation();
  const location = useLocation();
  const navigate = useNavigate();
  const defaultDashboardChecked = useRef(false);
 
   // Enable real-time permission sync for authenticated users
   usePermissionRealtimeSync();

  // Auto-redirect to default dashboard on initial login (when landing on /dashboard)
  useEffect(() => {
    if (defaultDashboardChecked.current) return;
    if (!currentProject?.id || !user || location.pathname !== '/dashboard') return;

    defaultDashboardChecked.current = true;

    const getDefaultReportForDashboard = async (dashboardId: string): Promise<string | null> => {
      try {
        const { data, error } = await supabase
          .from('reports')
          .select('id')
          .eq('dashboard_id', dashboardId)
          .eq('is_default_report', true)
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error('[DefaultDashboard] Error checking default report:', error);
          return null;
        }
        return data?.id || null;
      } catch {
        return null;
      }
    };

    const checkDefaultDashboard = async () => {
      try {
        console.log('[DefaultDashboard] Checking for user:', user.id, 'project:', currentProject.id);
        
        // First check for a user-specific default assignment
        // Note: user_profiles.id may differ from auth user.id, so look up the profile id first
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        const profileId = userProfile?.id || user.id;
        console.log('[DefaultDashboard] Profile ID:', profileId);

        const { data: userAssignment, error: userError } = await supabase
          .from('default_dashboard_users')
          .select('dashboard_id')
          .eq('project_id', currentProject.id)
          .eq('user_id', profileId)
          .limit(1)
          .maybeSingle();

        console.log('[DefaultDashboard] User assignment:', userAssignment, 'error:', userError);

        if (userAssignment?.dashboard_id) {
          console.log('[DefaultDashboard] Redirecting to user-specific dashboard:', userAssignment.dashboard_id);
          // Check for a default report within this dashboard
          const defaultReportId = await getDefaultReportForDashboard(userAssignment.dashboard_id);
          if (defaultReportId) {
            console.log('[DefaultDashboard] Redirecting to default report:', defaultReportId);
            navigate(`/report-view/${defaultReportId}`, { replace: true });
          } else {
            navigate(`/dashboard-view/${userAssignment.dashboard_id}`, { replace: true });
          }
          return;
        }

        // Then check for a project-wide default (default_for = 'all')
        const { data: projectDefault, error: projectError } = await supabase
          .from('dashboards')
          .select('id, default_for')
          .eq('project_id', currentProject.id)
          .eq('is_default', true)
          .limit(1)
          .maybeSingle();

        console.log('[DefaultDashboard] Project default:', projectDefault, 'error:', projectError);

        if (projectDefault?.id && (projectDefault as any).default_for === 'all') {
          console.log('[DefaultDashboard] Redirecting to project-wide dashboard:', projectDefault.id);
          // Check for a default report within this dashboard
          const defaultReportId = await getDefaultReportForDashboard(projectDefault.id);
          if (defaultReportId) {
            console.log('[DefaultDashboard] Redirecting to default report:', defaultReportId);
            navigate(`/report-view/${defaultReportId}`, { replace: true });
          } else {
            navigate(`/dashboard-view/${projectDefault.id}`, { replace: true });
          }
        }
      } catch (err) {
        console.error('Failed to check default dashboard:', err);
      }
    };

    checkDefaultDashboard();
  }, [currentProject?.id, user, location.pathname, navigate]);

  // Auth loading state - show full page loader since we don't know if user is authenticated
  if (isLoading) {
     return <AuthLoadingSkeleton />;
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
        <div className={`h-screen flex w-full ${isImpersonating ? 'pt-12' : ''}`}>
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
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
