import { useState, useEffect, useCallback } from 'react';
import { backend as supabase } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type {
  OutboundConnector,
  OutboundConnectorFormData,
  ConnectorCredentials,
  ConnectorAuthType,
  ConnectorMode,
  ConnectorProvider,
} from '@/types/outboundConnector';

/**
 * Persist outbound connectors in the existing `data_source_connections` table
 * (already deployed) so Integrations works without a separate migration.
 * Rows are tagged via http_headers["x-tsq-connector"] = "1".
 */

const CONNECTOR_MARKER = 'x-tsq-connector';
const META_PROVIDER = 'x-tsq-provider';
const META_MODE = 'x-tsq-mode';
const META_SCHEDULE = 'x-tsq-schedule';

function asCredentials(raw: unknown): ConnectorCredentials {
  if (!raw || typeof raw !== 'object') return {};
  return raw as ConnectorCredentials;
}

function asStringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

function errorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function isConnectorRow(headers: Record<string, string>): boolean {
  return headers[CONNECTOR_MARKER] === '1';
}

function publicHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(headers).forEach(([k, v]) => {
    if (k.startsWith('x-tsq-')) return;
    out[k] = v;
  });
  return out;
}

function mapAuthType(raw: string | null | undefined): ConnectorAuthType {
  const v = (raw || 'api_key') as ConnectorAuthType;
  if (['api_key', 'basic', 'bearer', 'oauth_client', 'custom'].includes(v)) return v;
  if (v === 'none') return 'api_key';
  return 'custom';
}

function mapRow(row: Record<string, unknown>): OutboundConnector {
  const headers = asStringRecord(row.http_headers);
  return {
    id: String(row.id),
    organization_id: String(row.organization_id || ''),
    project_id: (row.project_id as string | null) ?? null,
    name: String(row.name || ''),
    description: (row.description as string | null) ?? null,
    provider: (headers[META_PROVIDER] as ConnectorProvider) || 'generic_http',
    mode: (headers[META_MODE] as ConnectorMode) || 'batch',
    base_url: (row.http_url as string | null) ?? null,
    auth_type: mapAuthType(row.http_auth_type as string | null),
    credentials: asCredentials(row.http_auth_config),
    headers: publicHeaders(headers),
    schedule_cron: headers[META_SCHEDULE] || null,
    is_active: row.is_active !== false,
    created_by: String(row.created_by || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function buildHeaders(
  form: Pick<OutboundConnectorFormData, 'provider' | 'mode' | 'schedule_cron' | 'headers'>,
): Record<string, string> {
  return {
    ...form.headers,
    [CONNECTOR_MARKER]: '1',
    [META_PROVIDER]: form.provider,
    [META_MODE]: form.mode,
    [META_SCHEDULE]: form.mode === 'batch' ? (form.schedule_cron || '') : '',
  };
}

function filterConnectorRows(rows: Record<string, unknown>[]): OutboundConnector[] {
  return rows
    .filter((r) => isConnectorRow(asStringRecord(r.http_headers)))
    .map(mapRow);
}

export function useOutboundConnectors() {
  const [connectors, setConnectors] = useState<OutboundConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id;
  const userId = userProfile?.id;

  const fetchConnectors = useCallback(async () => {
    if (!orgId) {
      setConnectors([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_source_connections')
        .select('*')
        .eq('organization_id', orgId)
        .eq('connection_type', 'http_api')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setConnectors(filterConnectorRows((data || []) as Record<string, unknown>[]));
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching outbound connectors:', error);
      setConnectors([]);
      setLoadError(errorMessage(error));
      // No toast on load — prevents toast-driven flicker/re-render loops.
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchConnectors();
  }, [fetchConnectors]);

  const createConnector = useCallback(async (
    form: OutboundConnectorFormData,
  ): Promise<OutboundConnector | null> => {
    if (!orgId || !userId) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      return null;
    }
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('data_source_connections')
        .insert({
          organization_id: orgId,
          project_id: form.project_id || null,
          name: form.name.trim(),
          description: form.description.trim() || null,
          connection_type: 'http_api',
          http_url: form.base_url.trim() || null,
          http_method: 'GET',
          http_auth_type: form.auth_type,
          http_auth_config: form.credentials,
          http_headers: buildHeaders(form),
          is_active: form.is_active,
          created_by: userId,
        })
        .select('*')
        .single();

      if (error) throw error;
      const mapped = mapRow(data as Record<string, unknown>);
      setConnectors((prev) => [mapped, ...prev]);
      setLoadError(null);
      toast({ title: 'Connector created', description: `${mapped.name} is ready to use.` });
      return mapped;
    } catch (error) {
      console.error('Error creating connector:', error);
      toast({
        title: 'Create failed',
        description: errorMessage(error),
        variant: 'destructive',
      });
      return null;
    }
  }, [orgId, userId]);

  const updateConnector = useCallback(async (
    id: string,
    form: Partial<OutboundConnectorFormData>,
  ): Promise<boolean> => {
    try {
      const existing = connectors.find((c) => c.id === id);
      if (!existing) {
        toast({ title: 'Connector not found', variant: 'destructive' });
        return false;
      }

      const merged: OutboundConnectorFormData = {
        name: form.name ?? existing.name,
        description: form.description ?? existing.description ?? '',
        provider: (form.provider ?? existing.provider ?? 'generic_http') as ConnectorProvider,
        mode: form.mode ?? existing.mode,
        base_url: form.base_url ?? existing.base_url ?? '',
        auth_type: form.auth_type ?? existing.auth_type,
        credentials: form.credentials ?? existing.credentials,
        headers: form.headers ?? existing.headers,
        schedule_cron: form.schedule_cron ?? existing.schedule_cron ?? '',
        project_id: form.project_id !== undefined ? form.project_id : existing.project_id,
        is_active: form.is_active ?? existing.is_active,
      };

      const { error } = await supabase
        .from('data_source_connections')
        .update({
          name: merged.name.trim(),
          description: merged.description.trim() || null,
          project_id: merged.project_id || null,
          http_url: merged.base_url.trim() || null,
          http_auth_type: merged.auth_type,
          http_auth_config: merged.credentials,
          http_headers: buildHeaders(merged),
          is_active: merged.is_active,
        })
        .eq('id', id);

      if (error) throw error;

      await fetchConnectors();
      toast({ title: 'Connector updated' });
      return true;
    } catch (error) {
      console.error('Error updating connector:', error);
      toast({
        title: 'Update failed',
        description: errorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  }, [connectors, fetchConnectors]);

  const deleteConnector = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('data_source_connections')
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
        description: errorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  }, []);

  const toggleActive = useCallback(async (id: string, isActive: boolean): Promise<boolean> => {
    return updateConnector(id, { is_active: isActive });
  }, [updateConnector]);

  return {
    connectors,
    loading,
    loadError,
    fetchConnectors,
    createConnector,
    updateConnector,
    deleteConnector,
    toggleActive,
  };
}
