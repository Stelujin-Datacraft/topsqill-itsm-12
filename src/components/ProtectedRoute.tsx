
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, userProfile, isLoading } = useAuth();

  console.log('ProtectedRoute - isLoading:', isLoading, 'user:', user?.email, 'userProfile:', userProfile?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Check if user has a profile and organization
  if (!userProfile) {
    console.log('No user profile found');
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
    console.log('User has no organization');
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
