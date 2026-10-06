import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DependencyRef,
  ObjectRef,
  PortableObject,
  PromotableObjectType,
  TransferContext,
} from '../registry/types';

export type SbClient = SupabaseClient;

export interface PromotableHandler {
  readonly objectType: PromotableObjectType;

  list(source: SbClient, opts: { projectId?: string; organizationId?: string }): Promise<ObjectRef[]>;

  loadPortable(source: SbClient, objectId: string): Promise<PortableObject | null>;

  discoverDependencies(source: SbClient, portable: PortableObject): Promise<DependencyRef[]>;

  findInTarget(
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    logicalSnapshot?: { version: string; contentHash: string; payload: Record<string, unknown> } | null,
  ): Promise<{ exists: boolean; version: string | null; contentHash: string | null; name?: string; id?: string }>;

  transfer(
    source: SbClient,
    target: SbClient,
    portable: PortableObject,
    ctx: TransferContext,
    mode: 'dual_supabase' | 'logical_snapshot',
  ): Promise<{
    status: 'succeeded' | 'identical' | 'failed';
    error?: string;
    prodAfter?: Record<string, unknown>;
  }>;
}

export function stableIdFromRow(row: { reference_id?: string | null; id: string }): string {
  return (row.reference_id && String(row.reference_id).trim()) || row.id;
}
