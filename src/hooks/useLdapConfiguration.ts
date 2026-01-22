import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface LdapConfiguration {
  id: string;
  organization_id: string;
  name: string;
  is_enabled: boolean;
  
  // Connection settings
  server_url: string;
  base_dn: string;
  bind_dn: string | null;
  bind_password_encrypted: string | null;
  
  // Search settings
  user_search_base: string | null;
  user_search_filter: string;
  group_search_base: string | null;
  group_search_filter: string;
  
  // Attribute mappings
  username_attribute: string;
  email_attribute: string;
  first_name_attribute: string;
  last_name_attribute: string;
  display_name_attribute: string;
  member_of_attribute: string;
  
  // Security settings
  use_ssl: boolean;
  use_starttls: boolean;
  allow_self_signed_certs: boolean;
  connection_timeout_seconds: number;
  
  // Behavior settings
  auto_provision_users: boolean;
  sync_user_status: boolean;
  fallback_to_local_auth: boolean;
  
  // Sync settings
  sync_enabled: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LdapGroupMapping {
  id: string;
  ldap_config_id: string;
  organization_id: string;
  ldap_group_dn: string;
  ldap_group_name: string;
  mapped_role: string | null;
  mapped_security_template_id: string | null;
  mapped_group_id: string | null;
  priority: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LdapSyncLog {
  id: string;
  ldap_config_id: string;
  organization_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  users_found: number;
  users_created: number;
  users_updated: number;
  users_disabled: number;
  groups_synced: number;
  errors_count: number;
  error_details: any;
  sync_log: any;
  triggered_by: string | null;
}

export interface CreateLdapConfigInput {
  name?: string;
  server_url: string;
  base_dn: string;
  bind_dn?: string;
  bind_password?: string;
  user_search_base?: string;
  user_search_filter?: string;
  group_search_base?: string;
  group_search_filter?: string;
  username_attribute?: string;
  email_attribute?: string;
  first_name_attribute?: string;
  last_name_attribute?: string;
  display_name_attribute?: string;
  member_of_attribute?: string;
  use_ssl?: boolean;
  use_starttls?: boolean;
  allow_self_signed_certs?: boolean;
  connection_timeout_seconds?: number;
  auto_provision_users?: boolean;
  sync_user_status?: boolean;
  fallback_to_local_auth?: boolean;
  sync_enabled?: boolean;
  sync_interval_minutes?: number;
}

export function useLdapConfiguration() {
  const { userProfile } = useAuth();
  const [configurations, setConfigurations] = useState<LdapConfiguration[]>([]);
  const [groupMappings, setGroupMappings] = useState<LdapGroupMapping[]>([]);
  const [syncLogs, setSyncLogs] = useState<LdapSyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  const organizationId = userProfile?.organization_id;

  const loadConfigurations = useCallback(async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ldap_configurations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setConfigurations((data || []) as unknown as LdapConfiguration[]);
    } catch (error) {
      console.error('Error loading LDAP configurations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load LDAP configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  const loadGroupMappings = useCallback(async (configId?: string) => {
    if (!organizationId) return;
    
    try {
      let query = supabase
        .from('ldap_group_mappings')
        .select('*')
        .eq('organization_id', organizationId)
        .order('priority', { ascending: true });
      
      if (configId) {
        query = query.eq('ldap_config_id', configId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGroupMappings((data || []) as unknown as LdapGroupMapping[]);
    } catch (error) {
      console.error('Error loading LDAP group mappings:', error);
    }
  }, [organizationId]);

  const loadSyncLogs = useCallback(async (configId?: string, limit = 20) => {
    if (!organizationId) return;
    
    try {
      let query = supabase
        .from('ldap_sync_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (configId) {
        query = query.eq('ldap_config_id', configId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSyncLogs((data || []) as unknown as LdapSyncLog[]);
    } catch (error) {
      console.error('Error loading LDAP sync logs:', error);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadConfigurations();
    }
  }, [organizationId, loadConfigurations]);

  const createConfiguration = async (input: CreateLdapConfigInput): Promise<LdapConfiguration | null> => {
    if (!organizationId || !userProfile?.id) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('ldap_configurations')
        .insert({
          organization_id: organizationId,
          created_by: userProfile.id,
          name: input.name || 'Primary LDAP',
          server_url: input.server_url,
          base_dn: input.base_dn,
          bind_dn: input.bind_dn || null,
          bind_password_encrypted: input.bind_password || null, // Will be encrypted by edge function
          user_search_base: input.user_search_base || null,
          user_search_filter: input.user_search_filter || '(sAMAccountName={username})',
          group_search_base: input.group_search_base || null,
          group_search_filter: input.group_search_filter || '(objectClass=group)',
          username_attribute: input.username_attribute || 'sAMAccountName',
          email_attribute: input.email_attribute || 'mail',
          first_name_attribute: input.first_name_attribute || 'givenName',
          last_name_attribute: input.last_name_attribute || 'sn',
          display_name_attribute: input.display_name_attribute || 'displayName',
          member_of_attribute: input.member_of_attribute || 'memberOf',
          use_ssl: input.use_ssl ?? true,
          use_starttls: input.use_starttls ?? false,
          allow_self_signed_certs: input.allow_self_signed_certs ?? false,
          connection_timeout_seconds: input.connection_timeout_seconds || 10,
          auto_provision_users: input.auto_provision_users ?? true,
          sync_user_status: input.sync_user_status ?? true,
          fallback_to_local_auth: input.fallback_to_local_auth ?? true,
          sync_enabled: input.sync_enabled ?? false,
          sync_interval_minutes: input.sync_interval_minutes || 60,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'LDAP configuration created successfully',
      });

      await loadConfigurations();
      return data as unknown as LdapConfiguration;
    } catch (error: any) {
      console.error('Error creating LDAP configuration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create LDAP configuration',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateConfiguration = async (id: string, updates: Partial<CreateLdapConfigInput>): Promise<boolean> => {
    try {
      const updateData: any = { ...updates };
      
      // Handle password separately (will be encrypted by edge function)
      if (updates.bind_password) {
        updateData.bind_password_encrypted = updates.bind_password;
        delete updateData.bind_password;
      }

      const { error } = await supabase
        .from('ldap_configurations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'LDAP configuration updated successfully',
      });

      await loadConfigurations();
      return true;
    } catch (error: any) {
      console.error('Error updating LDAP configuration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update LDAP configuration',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteConfiguration = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('ldap_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'LDAP configuration deleted successfully',
      });

      await loadConfigurations();
      return true;
    } catch (error: any) {
      console.error('Error deleting LDAP configuration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete LDAP configuration',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleEnabled = async (id: string, enabled: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('ldap_configurations')
        .update({ is_enabled: enabled })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `LDAP ${enabled ? 'enabled' : 'disabled'} successfully`,
      });

      await loadConfigurations();
      return true;
    } catch (error: any) {
      console.error('Error toggling LDAP:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle LDAP',
        variant: 'destructive',
      });
      return false;
    }
  };

  const testConnection = async (configId: string): Promise<{ success: boolean; message: string }> => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ldap-test-connection', {
        body: { configId }
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      
      toast({
        title: result.success ? 'Connection Successful' : 'Connection Failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });

      return result;
    } catch (error: any) {
      console.error('Error testing LDAP connection:', error);
      const message = error.message || 'Failed to test LDAP connection';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, message };
    } finally {
      setIsTesting(false);
    }
  };

  const triggerSync = async (configId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('ldap-sync', {
        body: { configId }
      });

      if (error) throw error;

      toast({
        title: 'Sync Started',
        description: 'LDAP synchronization has been initiated',
      });

      await loadSyncLogs(configId);
      return true;
    } catch (error: any) {
      console.error('Error triggering LDAP sync:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start LDAP sync',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Group mapping operations
  const createGroupMapping = async (mapping: {
    ldap_config_id: string;
    ldap_group_dn: string;
    ldap_group_name: string;
    mapped_role?: string;
    mapped_security_template_id?: string;
    mapped_group_id?: string;
    priority?: number;
  }): Promise<boolean> => {
    if (!organizationId || !userProfile?.id) return false;

    try {
      const { error } = await supabase
        .from('ldap_group_mappings')
        .insert({
          ...mapping,
          organization_id: organizationId,
          created_by: userProfile.id,
          priority: mapping.priority || 100,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Group mapping created successfully',
      });

      await loadGroupMappings(mapping.ldap_config_id);
      return true;
    } catch (error: any) {
      console.error('Error creating group mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create group mapping',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateGroupMapping = async (id: string, updates: Partial<LdapGroupMapping>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('ldap_group_mappings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Group mapping updated successfully',
      });

      await loadGroupMappings();
      return true;
    } catch (error: any) {
      console.error('Error updating group mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update group mapping',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteGroupMapping = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('ldap_group_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Group mapping deleted successfully',
      });

      await loadGroupMappings();
      return true;
    } catch (error: any) {
      console.error('Error deleting group mapping:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete group mapping',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    configurations,
    groupMappings,
    syncLogs,
    isLoading,
    isTesting,
    loadConfigurations,
    loadGroupMappings,
    loadSyncLogs,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    toggleEnabled,
    testConnection,
    triggerSync,
    createGroupMapping,
    updateGroupMapping,
    deleteGroupMapping,
  };
}
