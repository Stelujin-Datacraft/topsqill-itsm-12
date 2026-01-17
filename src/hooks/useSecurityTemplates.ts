import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SecurityTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  
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
  
  // Metadata
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type SecurityTemplateInput = Omit<SecurityTemplate, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by'>;

const DEFAULT_TEMPLATE: SecurityTemplateInput = {
  name: '',
  description: null,
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
  session_timeout_minutes: 30,
  session_timeout_warning_seconds: 60,
  max_concurrent_sessions: 3,
  static_session_timeout: false,
  access_start_time: null,
  access_end_time: null,
  allowed_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  mfa_required: false,
  mfa_method: 'email',
  mfa_pin_expiry_minutes: 5,
  mfa_max_attempts: 3,
  is_default: false,
};

export function useSecurityTemplates() {
  const { currentOrganization } = useOrganization();
  const { userProfile } = useAuth();
  const [templates, setTemplates] = useState<SecurityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('security_templates')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) {
        console.error('Error loading security templates:', error);
        return;
      }

      setTemplates((data as SecurityTemplate[]) || []);
    } catch (error) {
      console.error('Error loading security templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (input: SecurityTemplateInput): Promise<SecurityTemplate | null> => {
    if (!currentOrganization?.id || !userProfile?.id) {
      toast.error('Missing organization or user');
      return null;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('security_templates')
        .insert({
          ...input,
          organization_id: currentOrganization.id,
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Security template created successfully');
      await loadTemplates();
      return data as SecurityTemplate;
    } catch (error: any) {
      console.error('Error creating security template:', error);
      toast.error(error.message || 'Failed to create security template');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = async (id: string, updates: Partial<SecurityTemplateInput>): Promise<boolean> => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('security_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Security template updated successfully');
      await loadTemplates();
      return true;
    } catch (error: any) {
      console.error('Error updating security template:', error);
      toast.error(error.message || 'Failed to update security template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('security_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Security template deleted successfully');
      await loadTemplates();
      return true;
    } catch (error: any) {
      console.error('Error deleting security template:', error);
      toast.error(error.message || 'Failed to delete security template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const initializeDefaultTemplates = async (): Promise<boolean> => {
    if (!currentOrganization?.id || !userProfile?.id) {
      return false;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc('create_default_security_templates', {
        org_id: currentOrganization.id,
        creator_id: userProfile.id,
      });

      if (error) throw error;

      toast.success('Default templates created');
      await loadTemplates();
      return true;
    } catch (error: any) {
      console.error('Error creating default templates:', error);
      toast.error(error.message || 'Failed to create default templates');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    
    // Set up realtime subscription for templates
    if (currentOrganization?.id) {
      const channel = supabase
        .channel('security-templates-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'security_templates',
            filter: `organization_id=eq.${currentOrganization.id}`,
          },
          () => {
            loadTemplates();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentOrganization?.id]);

  return {
    templates,
    loading,
    saving,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    initializeDefaultTemplates,
    refetch: loadTemplates,
    defaultTemplate: DEFAULT_TEMPLATE,
  };
}
