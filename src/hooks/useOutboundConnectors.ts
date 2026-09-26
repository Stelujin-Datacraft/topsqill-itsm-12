import { useState, useEffect, useCallback } from 'react';
import { backend as supabase } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type {
  OutboundConnector,
  OutboundConnectorFormData,
  ConnectorCredentials,
} from '@/types/outboundConnector';

function asCredentials(raw: unknown): ConnectorCredentials {
  if (!raw || typeof raw !== 'object') return {};
  return raw as ConnectorCredentials;
}

function asHeaders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

function mapRow(row: Record<string, unknown>): OutboundConnector {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    project_id: (row.project_id as string | null) ?? null,
    name: String(row.name || ''),
    description: (row.description as string | null) ?? null,
    provider: String(row.provider || 'generic_http'),
    mode: (row.mode as OutboundConnector['mode']) || 'batch',
    base_url: (row.base_url as string | null) ?? null,
    auth_type: (row.auth_type as OutboundConnector['auth_type']) || 'api_key',
    credentials: asCredentials(row.credentials),
    headers: asHeaders(row.headers),
    schedule_cron: (row.schedule_cron as string | null) ?? null,
    is_active: row.is_active !== false,
    created_by: String(row.created_by || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export function useOutboundConnectors() {
  const [connectors, setConnectors] = useState<OutboundConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const fetchConnectors = useCallback(async () => {
    if (!userProfile?.organization_id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('outbound_connectors')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnectors((data || []).map((r) => mapRow(r as Record<string, unknown>)));
    } catch (error) {
      console.error('Error fetching outbound connectors:', error);
      toast({
        title: 'Could not load connectors',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userProfile?.organization_id]);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const createConnector = async (form: OutboundConnectorFormData): Promise<OutboundConnector | null> => {
    if (!userProfile?.organization_id || !userProfile?.id) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      return null;
    }
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('outbound_connectors')
        .insert({
          organization_id: userProfile.organization_id,
          project_id: form.project_id || null,
          name: form.name.trim(),
          description: form.description.trim() || null,
          provider: form.provider,
          mode: form.mode,
          base_url: form.base_url.trim() || null,
          auth_type: form.auth_type,
          credentials: form.credentials,
          headers: form.headers,
          schedule_cron: form.mode === 'batch' && form.schedule_cron.trim()
            ? form.schedule_cron.trim()
            : null,
          is_active: form.is_active,
          created_by: userProfile.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      const mapped = mapRow(data as Record<string, unknown>);
      setConnectors((prev) => [mapped, ...prev]);
      toast({ title: 'Connector created', description: `${mapped.name} is ready to use.` });
      return mapped;
    } catch (error) {
      console.error('Error creating connector:', error);
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateConnector = async (
    id: string,
    form: Partial<OutboundConnectorFormData>,
  ): Promise<boolean> => {
    try {
      const payload: Record<string, unknown> = {};
      if (form.name !== undefined) payload.name = form.name.trim();
      if (form.description !== undefined) payload.description = form.description.trim() || null;
      if (form.provider !== undefined) payload.provider = form.provider;
      if (form.mode !== undefined) payload.mode = form.mode;
      if (form.base_url !== undefined) payload.base_url = form.base_url.trim() || null;
      if (form.auth_type !== undefined) payload.auth_type = form.auth_type;
      if (form.credentials !== undefined) payload.credentials = form.credentials;
      if (form.headers !== undefined) payload.headers = form.headers;
      if (form.schedule_cron !== undefined || form.mode !== undefined) {
        const mode = form.mode ?? connectors.find((c) => c.id === id)?.mode;
        const cron = form.schedule_cron ?? connectors.find((c) => c.id === id)?.schedule_cron ?? '';
        payload.schedule_cron = mode === 'batch' && String(cron).trim() ? String(cron).trim() : null;
      }
      if (form.project_id !== undefined) payload.project_id = form.project_id || null;
      if (form.is_active !== undefined) payload.is_active = form.is_active;

      const { error } = await supabase
        .from('outbound_connectors')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      await fetchConnectors();
      toast({ title: 'Connector updated' });
      return true;
    } catch (error) {
      console.error('Error updating connector:', error);
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteConnector = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('outbound_connectors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setConnectors((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'Connector deleted' });
      return true;
    } catch (error) {
      console.error('Error deleting connector:', error);
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateConnector(id, { is_active: isActive });
  };

  return {
    connectors,
    loading,
    fetchConnectors,
    createConnector,
    updateConnector,
    deleteConnector,
    toggleActive,
  };
}
