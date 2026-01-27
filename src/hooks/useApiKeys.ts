import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface ApiKey {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  key_prefix: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  rate_limit_per_minute: number;
  allowed_ips: string[] | null;
  permissions: {
    forms?: string[];
    submissions?: string[];
    workflows?: string[];
    reports?: string[];
  };
}

export interface ApiRequestLog {
  id: string;
  api_key_id: string | null;
  organization_id: string;
  endpoint: string;
  method: string;
  request_body: any;
  response_status: number;
  response_time_ms: number;
  ip_address: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
}

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [requestLogs, setRequestLogs] = useState<ApiRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const fetchApiKeys = useCallback(async () => {
    if (!userProfile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys((data || []) as ApiKey[]);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id]);

  const fetchRequestLogs = useCallback(async (apiKeyId?: string, limit = 100) => {
    if (!userProfile?.organization_id) return;

    try {
      let query = supabase
        .from('api_request_logs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (apiKeyId) {
        query = query.eq('api_key_id', apiKeyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequestLogs((data || []) as ApiRequestLog[]);
    } catch (error) {
      console.error('Error fetching request logs:', error);
    }
  }, [userProfile?.organization_id]);

  // Generate a secure API key
  const generateApiKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'tsk_'; // prefix for Topsqill API key
    for (let i = 0; i < 48; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  // Hash the API key for storage
  const hashApiKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createApiKey = useCallback(async (
    name: string,
    description: string,
    permissions: ApiKey['permissions'],
    options: {
      projectId?: string;
      expiresAt?: string;
      rateLimit?: number;
      allowedIps?: string[];
    } = {}
  ): Promise<{ key: string; id: string } | null> => {
    if (!userProfile?.organization_id || !userProfile?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create API keys',
        variant: 'destructive'
      });
      return null;
    }

    try {
      const rawKey = generateApiKey();
      const keyHash = await hashApiKey(rawKey);
      const keyPrefix = rawKey.substring(0, 12) + '...';

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          organization_id: userProfile.organization_id,
          project_id: options.projectId || null,
          name,
          description,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          created_by: userProfile.id,
          permissions,
          expires_at: options.expiresAt || null,
          rate_limit_per_minute: options.rateLimit || 60,
          allowed_ips: options.allowedIps || null
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: 'API Key Created',
        description: 'Your new API key has been created successfully. Make sure to copy it now - you won\'t be able to see it again!'
      });

      await fetchApiKeys();
      return { key: rawKey, id: data.id };
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create API key',
        variant: 'destructive'
      });
      return null;
    }
  }, [userProfile, fetchApiKeys]);

  const updateApiKey = useCallback(async (
    id: string,
    updates: Partial<Pick<ApiKey, 'name' | 'description' | 'is_active' | 'permissions' | 'rate_limit_per_minute' | 'allowed_ips' | 'expires_at'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'API Key Updated',
        description: 'The API key has been updated successfully'
      });

      await fetchApiKeys();
      return true;
    } catch (error: any) {
      console.error('Error updating API key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update API key',
        variant: 'destructive'
      });
      return false;
    }
  }, [fetchApiKeys]);

  const deleteApiKey = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'API Key Deleted',
        description: 'The API key has been permanently deleted'
      });

      await fetchApiKeys();
      return true;
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete API key',
        variant: 'destructive'
      });
      return false;
    }
  }, [fetchApiKeys]);

  const revokeApiKey = useCallback(async (id: string): Promise<boolean> => {
    return updateApiKey(id, { is_active: false });
  }, [updateApiKey]);

  useEffect(() => {
    if (userProfile?.organization_id) {
      fetchApiKeys();
    }
  }, [userProfile?.organization_id, fetchApiKeys]);

  return {
    apiKeys,
    requestLogs,
    loading,
    fetchApiKeys,
    fetchRequestLogs,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    revokeApiKey
  };
}
