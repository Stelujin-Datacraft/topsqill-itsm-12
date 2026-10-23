import { contentHash, versionFromPayload } from '../registry/types';
import type { DependencyRef, ObjectRef, PortableObject, TransferContext } from '../registry/types';
import { sanitizeEnvSpecific } from '../engines/env-values';
import type { PromotableHandler, SbClient } from './handler.types';
import { writeLogicalSnapshot } from './promo-utils';

/**
 * SQL Builder — saved query definitions only.
 * Ownership on Prod is remapped to the promoting System Administrator
 * (saved_queries are user-scoped; Dev user UUIDs must not be copied).
 */
export class SavedQueryHandler implements PromotableHandler {
  readonly objectType = 'saved_query' as const;

  async list(source: SbClient, _opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]> {
    const { data, error } = await source
      .from('saved_queries')
      .select('id, name, query, user_id, updated_at, created_at')
      .order('name');
    if (error) throw new Error(`Failed to list saved_queries: ${error.message}`);
    return (data || []).map((row) => ({
      objectType: 'saved_query' as const,
      objectId: row.id,
      stableId: row.id,
      name: row.name,
      module: 'SQL Builder' as const,
      updatedAt: row.updated_at || row.created_at,
      devVersion: versionFromPayload({ name: row.name, query: row.query }, row.updated_at || row.created_at),
    }));
  }

  async loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null> {
    const { data: sq, error } = await source.from('saved_queries').select('*').eq('id', objectId).maybeSingle();
    if (error) throw new Error(`Failed to load saved_query: ${error.message}`);
    if (!sq) return null;

    const portable: Record<string, unknown> = {
      name: sq.name,
      query: sq.query,
      _dev_user_id: sq.user_id,
    };
    const { stripped, portable: cleaned } = sanitizeEnvSpecific('saved_query', portable);
    const version = versionFromPayload(cleaned, sq.updated_at || sq.created_at);

    return {
      objectType: 'saved_query',
      objectId: sq.id,
      stableId: sq.id,
      name: sq.name,
      version,
      contentHash: contentHash(cleaned),
      portable: cleaned,
      envSpecificStripped: stripped,
    };
  }

  async discoverDependencies(): Promise<DependencyRef[]> {
    return [];
  }

  async findInTarget(
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
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
    // Prefer same id (if already promoted), else match by name owned by promoting admin
    const { data: byId } = await target
      .from('saved_queries')
      .select('id, name, updated_at')
      .eq('id', portable.objectId)
      .maybeSingle();
    if (byId) {
      return {
        exists: true,
        version: versionFromPayload({ name: byId.name }, byId.updated_at),
        contentHash: null,
        name: byId.name,
        id: byId.id,
      };
    }
    const { data: byName } = await target
      .from('saved_queries')
      .select('id, name, updated_at')
      .eq('user_id', ctx.actorId)
      .eq('name', portable.name)
      .maybeSingle();
    if (!byName) return { exists: false, version: null, contentHash: null };
    return {
      exists: true,
      version: versionFromPayload({ name: byName.name }, byName.updated_at),
      contentHash: null,
      name: byName.name,
      id: byName.id,
    };
  }

  async transfer(
    _source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ) {
    if (mode === 'logical_snapshot') return writeLogicalSnapshot(target, portable, ctx, 'saved_query');

    const existing = await this.findInTarget(target, portable, ctx, null);
    const row = {
      name: portable.portable.name,
      query: portable.portable.query,
      user_id: ctx.actorId,
      updated_at: new Date().toISOString(),
    };

    if (existing.exists && existing.id) {
      const { error } = await target.from('saved_queries').update(row).eq('id', existing.id);
      if (error) return { status: 'failed' as const, error: error.message };
      return { status: 'succeeded' as const, prodAfter: { id: existing.id, ...row } };
    }

    const { data, error } = await target
      .from('saved_queries')
      .insert({ ...row, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) return { status: 'failed' as const, error: error.message };
    return { status: 'succeeded' as const, prodAfter: { id: data.id, ...row } };
  }
}
