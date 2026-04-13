
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, userProfile, isLoading, profileError, retryProfile } = useAuth();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  // Profile failed to load due to transient DB error — show retry UI
  if (!userProfile && profileError) {
    const handleRetry = async () => {
      setRetrying(true);
      await retryProfile();
      setRetrying(false);
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Connection Issue</h2>
          <p className="text-muted-foreground mb-4">
            We're having trouble connecting to the database. This is usually temporary.
          </p>
          <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted p-2 rounded">
            {profileError}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
            <button
              onClick={() => window.location.href = '/auth'}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Profile genuinely doesn't exist
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

  if (!userProfile.organization_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Organization Required</h2>
          <p className="text-muted-foreground mb-4">
            Your account is not associated with an organization. Please contact your administrator or request to join an organization.
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

  return <>{children}</>;
};

export default ProtectedRoute;
