import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

/**
 * Hook that returns the effective user profile.
 * When impersonating, returns the impersonated user's profile.
 * Otherwise, returns the actual logged-in user's profile.
 * 
 * Use this hook in components that should respect impersonation
 * (e.g., viewing forms, checking permissions for display purposes).
 * 
 * IMPORTANT: For actual data mutations and audit logging, 
 * always use the real user (from useAuth) to maintain audit integrity.
 */
export function useEffectiveUser() {
  const { userProfile: realUserProfile } = useAuth();
  const { isImpersonating, impersonatedUser, originalAdminId } = useImpersonation();

  // When impersonating, return impersonated user info
  if (isImpersonating && impersonatedUser) {
    return {
      effectiveProfile: {
        id: impersonatedUser.id,
        email: impersonatedUser.email,
        first_name: impersonatedUser.first_name,
        last_name: impersonatedUser.last_name,
        role: impersonatedUser.role,
        status: impersonatedUser.status,
        organization_id: impersonatedUser.organization_id,
      },
      isImpersonating: true,
      realUserId: originalAdminId,
      realUserProfile: realUserProfile,
    };
  }

  // Not impersonating - return real user
  return {
    effectiveProfile: realUserProfile,
    isImpersonating: false,
    realUserId: realUserProfile?.id || null,
    realUserProfile: realUserProfile,
  };
}
