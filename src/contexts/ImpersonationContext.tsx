import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface ImpersonatedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  status: string;
  organization_id: string | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  originalAdminId: string | null;
  startImpersonation: (userId: string) => Promise<boolean>;
  stopImpersonation: () => void;
  getEffectiveUserId: () => string | null;
  getEffectiveUserProfile: () => ImpersonatedUser | null;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [originalAdminId, setOriginalAdminId] = useState<string | null>(null);

  const isImpersonating = impersonatedUser !== null;

  const startImpersonation = useCallback(async (userId: string): Promise<boolean> => {
    // Only admins can impersonate
    if (!userProfile || userProfile.role !== 'admin') {
      toast.error('Only administrators can impersonate users');
      return false;
    }

    // Cannot impersonate self
    if (userId === userProfile.id) {
      toast.error('You cannot impersonate yourself');
      return false;
    }

    try {
      // Fetch target user profile
      const { data: targetUser, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, role, status, organization_id')
        .eq('id', userId)
        .single();

      if (error || !targetUser) {
        toast.error('User not found');
        return false;
      }

      // Cannot impersonate other admins
      if (targetUser.role === 'admin') {
        toast.error('Cannot impersonate other administrators');
        return false;
      }

      // Log audit event for impersonation start
      await supabase.from('audit_logs').insert({
        user_id: userProfile.id,
        event_type: 'impersonation_start',
        event_category: 'security',
        description: `Admin started impersonating user: ${targetUser.email}`,
        metadata: {
          impersonated_user_id: targetUser.id,
          impersonated_user_email: targetUser.email,
          admin_id: userProfile.id,
          admin_email: userProfile.email,
        },
      });

      setOriginalAdminId(userProfile.id);
      setImpersonatedUser(targetUser as ImpersonatedUser);
      toast.success(`Now impersonating ${targetUser.first_name || targetUser.email}`);
      return true;
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast.error('Failed to start impersonation');
      return false;
    }
  }, [userProfile]);

  const stopImpersonation = useCallback(async () => {
    if (!impersonatedUser || !originalAdminId) return;

    try {
      // Log audit event for impersonation end
      await supabase.from('audit_logs').insert({
        user_id: originalAdminId,
        event_type: 'impersonation_end',
        event_category: 'security',
        description: `Admin stopped impersonating user: ${impersonatedUser.email}`,
        metadata: {
          impersonated_user_id: impersonatedUser.id,
          impersonated_user_email: impersonatedUser.email,
          admin_id: originalAdminId,
        },
      });

      const userName = impersonatedUser.first_name || impersonatedUser.email;
      setImpersonatedUser(null);
      setOriginalAdminId(null);
      toast.success(`Stopped impersonating ${userName}`);
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      // Still clear state even if audit log fails
      setImpersonatedUser(null);
      setOriginalAdminId(null);
    }
  }, [impersonatedUser, originalAdminId]);

  // Get effective user ID - returns impersonated user ID if impersonating
  const getEffectiveUserId = useCallback(() => {
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser.id;
    }
    return userProfile?.id || null;
  }, [isImpersonating, impersonatedUser, userProfile]);

  // Get effective user profile - returns impersonated profile if impersonating
  const getEffectiveUserProfile = useCallback(() => {
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser;
    }
    return null; // Return null to indicate using regular userProfile
  }, [isImpersonating, impersonatedUser]);

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating,
      impersonatedUser,
      originalAdminId,
      startImpersonation,
      stopImpersonation,
      getEffectiveUserId,
      getEffectiveUserProfile,
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    // Return safe defaults during hot reload
    return {
      isImpersonating: false,
      impersonatedUser: null,
      originalAdminId: null,
      startImpersonation: async () => false,
      stopImpersonation: () => {},
      getEffectiveUserId: () => null,
      getEffectiveUserProfile: () => null,
    } as ImpersonationContextType;
  }
  return context;
};
