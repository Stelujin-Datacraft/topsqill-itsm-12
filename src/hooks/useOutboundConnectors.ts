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
 * Persist outbound connectors in `data_source_connections`.
 * Secrets must NOT live in http_auth_config — only credential_reference_id / header ref.
 */

const CONNECTOR_MARKER = 'x-tsq-connector';
const META_PROVIDER = 'x-tsq-provider';
const META_MODE = 'x-tsq-mode';
const META_SCHEDULE = 'x-tsq-schedule';
const META_CRED_REF = 'x-tsq-credential-ref';
const META_LOGICAL_KEY = 'x-tsq-logical-key';

const SECRET_KEYS = new Set([
  'password', 'token', 'apiKeyValue', 'api_key_value', 'clientSecret', 'client_secret',
  'accessToken', 'refreshToken', 'privateKey', 'secret', 'authorization',
]);

function publicCredentialsOnly(raw: ConnectorCredentials): ConnectorCredentials {
  const out: ConnectorCredentials = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (SECRET_KEYS.has(k)) continue;
    if (typeof v === 'string') (out as any)[k] = v;
  }
  return out;
}

function asCredentials(raw: unknown): ConnectorCredentials {
  if (!raw || typeof raw !== 'object') return {};
  return publicCredentialsOnly(raw as ConnectorCredentials);
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

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'connector';
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
    credential_reference_id:
      (row.credential_reference_id as string | null)
      || headers[META_CRED_REF]
      || null,
    logical_key: (row.logical_key as string | null) || headers[META_LOGICAL_KEY] || null,
    headers: publicHeaders(headers),
    schedule_cron: headers[META_SCHEDULE] || null,
    is_active: row.is_active !== false,
    created_by: String(row.created_by || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function buildHeaders(
  form: Pick<OutboundConnectorFormData, 'provider' | 'mode' | 'schedule_cron' | 'headers' | 'credential_reference_id' | 'logical_key' | 'name'>,
): Record<string, string> {
  const logical = form.logical_key || `connector.${slugify(form.name)}`;
  return {
    ...form.headers,
    [CONNECTOR_MARKER]: '1',
    [META_PROVIDER]: form.provider,
    [META_MODE]: form.mode,
    ...(form.schedule_cron ? { [META_SCHEDULE]: form.schedule_cron } : {}),
    [META_CRED_REF]: form.credential_reference_id,
    [META_LOGICAL_KEY]: logical,
  };
}

export function useOutboundConnectors(projectId?: string | null) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.organization_id;
  const userId = userProfile?.id;
  const [connectors, setConnectors] = useState<OutboundConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) {
      setConnectors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let q = supabase
        .from('data_source_connections')
        .select('*')
        .eq('organization_id', orgId)
        .eq('connection_type', 'http_api')
        .order('created_at', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      const mapped = (data || [])
        .map((row) => mapRow(row as Record<string, unknown>))
        .filter((c) => {
          // mapRow always returns; filter by marker via re-read isn't available — accept all http_api
          return true;
        })
        .filter((c) => {
          // Prefer rows tagged as connectors (have provider meta or credential ref)
          return Boolean(c.provider);
        });
      // Keep only connector-marker rows if we can detect via headers reconstruction
      const tagged = (data || [])
        .filter((row) => isConnectorRow(asStringRecord((row as any).http_headers)))
        .map((row) => mapRow(row as Record<string, unknown>));
      setConnectors(tagged.length ? tagged : mapped);
      setLoadError(null);
    } catch (error) {
      console.error('Error loading connectors:', error);
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    if (!form.credential_reference_id?.trim()) {
      toast({
        title: 'credentialReferenceId required',
        description: 'Secrets must not be stored in connector JSON. Provide a SecretProvider reference.',
        variant: 'destructive',
      });
      return null;
    }

    const logical = form.logical_key || `connector.${slugify(form.name)}`;
    const publicCreds = publicCredentialsOnly(form.credentials);

    try {
      const payload: Record<string, unknown> = {
        organization_id: orgId,
        project_id: form.project_id || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        connection_type: 'http_api',
        http_url: form.base_url.trim() || null,
        http_method: 'GET',
        http_auth_type: form.auth_type,
        http_auth_config: publicCreds,
        http_headers: buildHeaders({ ...form, logical_key: logical }),
        is_active: form.is_active,
        created_by: userId,
        // Columns from promotion migration (ignored if not yet applied — headers still carry ref)
        credential_reference_id: form.credential_reference_id.trim(),
        logical_key: logical,
      };

      let { data, error } = await supabase
        .from('data_source_connections')
        .insert(payload)
        .select('*')
        .single();

      // If migration columns missing, retry without them (ref still in headers)
      if (error && /credential_reference_id|logical_key/i.test(error.message || '')) {
        delete payload.credential_reference_id;
        delete payload.logical_key;
        ({ data, error } = await supabase
          .from('data_source_connections')
          .insert(payload)
          .select('*')
          .single());
      }

      if (error) throw error;
      const mapped = mapRow(data as Record<string, unknown>);
      setConnectors((prev) => [mapped, ...prev]);
      setLoadError(null);
      toast({ title: 'Connector created', description: `${mapped.name} uses credentialReferenceId only.` });
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

      const credRef = (form.credential_reference_id ?? existing.credential_reference_id ?? '').trim();
      if (!credRef) {
        toast({
          title: 'credentialReferenceId required',
          description: 'Cannot save connector secrets into DB JSON.',
          variant: 'destructive',
        });
        return false;
      }

      const merged: OutboundConnectorFormData = {
        name: form.name ?? existing.name,
        description: form.description ?? existing.description ?? '',
        provider: (form.provider ?? existing.provider ?? 'generic_http') as ConnectorProvider,
        mode: form.mode ?? existing.mode,
        base_url: form.base_url ?? existing.base_url ?? '',
        auth_type: form.auth_type ?? existing.auth_type,
        credentials: publicCredentialsOnly(form.credentials ?? existing.credentials),
        credential_reference_id: credRef,
        logical_key: form.logical_key ?? existing.logical_key ?? undefined,
        headers: form.headers ?? existing.headers,
        schedule_cron: form.schedule_cron ?? existing.schedule_cron ?? '',
        project_id: form.project_id !== undefined ? form.project_id : existing.project_id,
        is_active: form.is_active ?? existing.is_active,
      };

      const payload: Record<string, unknown> = {
        name: merged.name.trim(),
        description: merged.description.trim() || null,
        project_id: merged.project_id || null,
        http_url: merged.base_url.trim() || null,
        http_auth_type: merged.auth_type,
        http_auth_config: merged.credentials,
        http_headers: buildHeaders(merged),
        is_active: merged.is_active,
        credential_reference_id: credRef,
        logical_key: merged.logical_key || `connector.${slugify(merged.name)}`,
      };

      let { error } = await supabase.from('data_source_connections').update(payload).eq('id', id);
      if (error && /credential_reference_id|logical_key/i.test(error.message || '')) {
        delete payload.credential_reference_id;
        delete payload.logical_key;
        ({ error } = await supabase.from('data_source_connections').update(payload).eq('id', id));
      }
      if (error) throw error;
      await refresh();
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
  }, [connectors, refresh]);

  const deleteConnector = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('data_source_connections').delete().eq('id', id);
      if (error) throw error;
      setConnectors((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'Connector deleted' });
      return true;
    } catch (error) {
      toast({ title: 'Delete failed', description: errorMessage(error), variant: 'destructive' });
      return false;
    }
  }, []);

  return {
    connectors,
    loading,
    loadError,
    refresh,
    createConnector,
    updateConnector,
    deleteConnector,
  };
}
