import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { writeLogicalSnapshot } from './promo-utils';

const SECRETISH =
  /(password|secret|api[_-]?key|token|credential|private[_-]?key|ciphertext|secret[_-]?handle)/i;

function stripSecretsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecretsDeep);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRETISH.test(k)) continue;
    out[k] = stripSecretsDeep(v);
  }
  return out;
}

/**
 * Integration Studio — integration definitions (+ version docs) from vis_documents.
 * Never promotes vis_secret_blobs, credentials, executions, logs, or audits.
 */
export class VisIntegrationHandler implements PromotableHandler {
  readonly objectType = 'vis_integration' as const;

  async list(source: SbClient, _opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    const { data, error } = await source
      .from('vis_documents')
      .select('id, logical_id, payload, updated_at, deleted_at')
      .eq('collection', 'integrations')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`Failed to list VIS integrations: ${error.message}`);
    return (data || []).map((row) => {
      const payload = (row.payload || {}) as Record<string, unknown>;
      const logical = row.logical_id || String(payload.id || row.id);
      const name = String(payload.name || logical);
      return {
        objectType: 'vis_integration' as const,
        objectId: row.id,
        stableId: logical,
        name,
        module: 'Integration Studio' as const,
        organizationId: (payload.organizationId || payload.organization_id || null) as string | null,
        updatedAt: row.updated_at,
        devVersion: versionFromPayload(
          { name, status: payload.status, environment: payload.environment },
          row.updated_at,
        ),
      };
    });
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: doc, error } = await source
      .from('vis_documents')
      .select('*')
      .eq('id', objectId)
      .eq('collection', 'integrations')
      .maybeSingle();
    if (error) throw new Error(`Failed to load VIS integration: ${error.message}`);
    if (!doc || doc.deleted_at) return null;

    const payload = stripSecretsDeep(doc.payload || {}) as Record<string, unknown>;
    const logical = doc.logical_id || String(payload.id || doc.id);
    payload.id = logical;

    // Child version documents for this integration
    const { data: versionDocs, error: vErr } = await source
      .from('vis_documents')
      .select('logical_id, payload, updated_at')
      .eq('collection', 'versions')
      .is('deleted_at', null);
    if (vErr) throw new Error(`Failed to load VIS versions: ${vErr.message}`);

    const versions = (versionDocs || [])
      .filter((v) => {
        const p = (v.payload || {}) as Record<string, unknown>;
        return p.integrationId === logical || p.integration_id === logical;
      })
      .map((v) => {
        const cleaned = stripSecretsDeep(v.payload || {}) as Record<string, unknown>;
        const vLogical = v.logical_id || String(cleaned.id || '');
        cleaned.id = vLogical;
        cleaned.integrationId = logical;
        return cleaned;
      });

    const portable: Record<string, unknown> = {
      ...payload,
      _logical_id: logical,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('vis_integration', portable);
    const version = versionFromPayload(cleaned, doc.updated_at);

    return {
      objectType: 'vis_integration',
      objectId: doc.id,
      stableId: logical,
      name: String(cleaned.name || logical),
      version,
      contentHash: contentHash({ ...cleaned, versions }),
      portable: cleaned,
      children: { versions },
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(): Promise<DependencyRef[]> {
    // Connections/credentials are env-specific and must be recreated on Prod.
    return [];
  }

  async findInTarget(
    target: SbClient,
    portable: PortableObject,
    _ctx: TransferContext,
    logicalSnapshot?: { version: string; contentHash: string; payload: Record<string, unknown> } | null,
  ) {
    if (logicalSnapshot) {
      return {
        exists: true,
        version: logicalSnapshot.version,
        contentHash: logicalSnapshot.contentHash,
        name: String((logicalSnapshot.payload as any)?.name || portable.name),
      };
    }
    const { data } = await target
      .from('vis_documents')
      .select('id, logical_id, payload, updated_at')
      .eq('collection', 'integrations')
      .eq('logical_id', portable.stableId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return { exists: false, version: null, contentHash: null };
    const name = String((data.payload as any)?.name || data.logical_id);
    return {
      exists: true,
      version: versionFromPayload({ name }, data.updated_at),
      contentHash: null,
      name,
      id: data.id,
    };
  }

  async transfer(
    _source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ) {
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'vis_integration');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const logical = portable.stableId;
    const { _logical_id: _lid, ...payloadRest } = portable.portable;
    const payload = {
      ...payloadRest,
      id: logical,
      // Force Prod environment tag; never copy Dev environment blindly as runtime target
      environment: 'PROD',
      updatedAt: new Date().toISOString(),
    };

    const upsertDoc = async (collection: string, logicalId: string, body: Record<string, unknown>) => {
      const { data: existingDoc } = await target
        .from('vis_documents')
        .select('id')
        .eq('collection', collection)
        .eq('logical_id', logicalId)
        .maybeSingle();
      if (existingDoc?.id) {
        const { error } = await target
          .from('vis_documents')
          .update({
            payload: body,
            updated_at: new Date().toISOString(),
            deleted_at: null,
          })
          .eq('id', existingDoc.id);
        if (error) throw new Error(error.message);
        return existingDoc.id;
      }
      const { data, error } = await target
        .from('vis_documents')
        .insert({
          collection,
          logical_id: logicalId,
          payload: body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    };

    try {
      const integrationRowId = await upsertDoc('integrations', logical, payload);

      const versions = (portable.children?.versions || []) as Record<string, unknown>[];
      for (const v of versions) {
        const vLogical = String(v.id || `${logical}:v${v.version || 1}`);
        await upsertDoc('versions', vLogical, {
          ...v,
          id: vLogical,
          integrationId: logical,
        });
      }

      return {
        status: 'succeeded' as const,
        prodAfter: { id: existing.id || integrationRowId, logical_id: logical, ...payload },
      };
    } catch (e: any) {
      return { status: 'failed' as const, error: e?.message || String(e) };
    }
  }
}
