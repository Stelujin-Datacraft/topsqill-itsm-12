import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface UserSecurityParameters {
  id: string;
  user_id: string;
  organization_id: string;
  
  // Password Policy
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  password_expiry_days: number;
  password_expiry_warning_days: number;
  password_history_count: number;
  password_change_min_hours: number;
  
  // Account Lockout
  max_failed_login_attempts: number;
  lockout_duration_minutes: number;
  account_locked_until: string | null;
  failed_login_count: number;
  last_failed_login: string | null;
  
  // Session Management
  session_timeout_minutes: number;
  session_timeout_warning_seconds: number;
  max_concurrent_sessions: number;
  static_session_timeout: boolean;
  
  // Access Restrictions
  access_start_time: string | null;
  access_end_time: string | null;
  allowed_days: string[];
  ip_whitelist: string[] | null;
  ip_blacklist: string[] | null;
  
  // MFA Settings
  mfa_required: boolean;
  mfa_method: string;
  mfa_pin_expiry_minutes: number;
  mfa_max_attempts: number;
  
  // Metadata
  last_password_change: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSecurityDefaults {
  id: string;
  organization_id: string;
  
  // Password Policy
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  password_expiry_days: number;
  password_expiry_warning_days: number;
  password_history_count: number;
  password_change_min_hours: number;
  
  // Account Lockout
  max_failed_login_attempts: number;
  lockout_duration_minutes: number;
  
  // Session Management
  session_timeout_minutes: number;
  session_timeout_warning_seconds: number;
  max_concurrent_sessions: number;
  static_session_timeout: boolean;
  
  // Access Restrictions
  access_start_time: string | null;
  access_end_time: string | null;
  allowed_days: string[];
  
  // MFA Settings
  mfa_required: boolean;
  mfa_method: string;
  mfa_pin_expiry_minutes: number;
  mfa_max_attempts: number;
  
  created_at: string;
  updated_at: string;
}

const DEFAULT_SECURITY_PARAMS: Omit<UserSecurityParameters, 'id' | 'user_id' | 'organization_id' | 'created_at' | 'updated_at'> = {
  password_min_length: 9,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_numbers: true,
  password_require_special: true,
  password_expiry_days: 90,
  password_expiry_warning_days: 14,
  password_history_count: 20,
  password_change_min_hours: 24,
  max_failed_login_attempts: 3,
  lockout_duration_minutes: 30,
  account_locked_until: null,
  failed_login_count: 0,
  last_failed_login: null,
  session_timeout_minutes: 30,
  session_timeout_warning_seconds: 60,
  max_concurrent_sessions: 3,
  static_session_timeout: false,
  access_start_time: null,
  access_end_time: null,
  allowed_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  ip_whitelist: null,
  ip_blacklist: null,
  mfa_required: false,
  mfa_method: 'email',
  mfa_pin_expiry_minutes: 5,
  mfa_max_attempts: 3,
  last_password_change: null,
  last_login: null,
};

export function useSecurityParameters(userId?: string) {
  const { currentOrganization } = useOrganization();
  const [parameters, setParameters] = useState<UserSecurityParameters | null>(null);
  const [orgDefaults, setOrgDefaults] = useState<OrganizationSecurityDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadParameters = async () => {
    if (!userId || !currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load user-specific parameters
      const { data: userParams, error: userError } = await supabase
        .from('user_security_parameters')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (userError) {
        console.error('Error loading user security parameters:', userError);
      }

      // Load organization defaults
      const { data: orgParams, error: orgError } = await supabase
        .from('organization_security_defaults')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (orgError) {
        console.error('Error loading org security defaults:', orgError);
      }

      setParameters(userParams as UserSecurityParameters | null);
      setOrgDefaults(orgParams as OrganizationSecurityDefaults | null);
    } catch (error) {
      console.error('Error loading security parameters:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveParameters = async (updates: Partial<UserSecurityParameters>) => {
    if (!userId || !currentOrganization?.id) {
      toast.error('Missing user or organization');
      return false;
    }

    try {
      setSaving(true);

      if (parameters?.id) {
        // Update existing
        const { error } = await supabase
          .from('user_security_parameters')
          .update(updates)
          .eq('id', parameters.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_security_parameters')
          .insert({
            user_id: userId,
            organization_id: currentOrganization.id,
            ...updates,
          });

        if (error) throw error;
      }

      toast.success('Security parameters saved successfully');
      await loadParameters();
      return true;
    } catch (error: any) {
      console.error('Error saving security parameters:', error);
      toast.error(error.message || 'Failed to save security parameters');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const unlockAccount = async () => {
    if (!userId) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_security_parameters')
        .update({
          account_locked_until: null,
          failed_login_count: 0,
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Account unlocked successfully');
      await loadParameters();
      return true;
    } catch (error: any) {
      console.error('Error unlocking account:', error);
      toast.error(error.message || 'Failed to unlock account');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const getEffectiveValue = <K extends keyof UserSecurityParameters>(
    key: K
  ): UserSecurityParameters[K] => {
    if (parameters?.[key] !== undefined && parameters?.[key] !== null) {
      return parameters[key];
    }
    if (orgDefaults && key in orgDefaults) {
      return (orgDefaults as any)[key];
    }
    return (DEFAULT_SECURITY_PARAMS as any)[key];
  };

  useEffect(() => {
    loadParameters();
  }, [userId, currentOrganization?.id]);

  return {
    parameters,
    orgDefaults,
    loading,
    saving,
    saveParameters,
    unlockAccount,
    getEffectiveValue,
    refetch: loadParameters,
    defaultParams: DEFAULT_SECURITY_PARAMS,
  };
}

export function useAllSecurityParameters() {
  const { currentOrganization } = useOrganization();
  const [allParameters, setAllParameters] = useState<UserSecurityParameters[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAllParameters = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_security_parameters')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (error) {
        console.error('Error loading all security parameters:', error);
        return;
      }

      setAllParameters((data as UserSecurityParameters[]) || []);
    } catch (error) {
      console.error('Error loading all security parameters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllParameters();
  }, [currentOrganization?.id]);

  return {
    allParameters,
    loading,
    refetch: loadAllParameters,
  };
}
