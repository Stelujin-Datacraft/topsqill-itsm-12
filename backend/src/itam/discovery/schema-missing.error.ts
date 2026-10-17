/**
 * Thrown when ITAM Discovery postgres persistence is configured but required
 * relations are missing (migrations not applied on this Supabase project).
 *
 * Nest must not fall back to memory. ItamModule catches this to avoid an
 * uncontrolled Docker restart loop while keeping ITAM APIs fail-closed.
 */

/** DDL/bootstrap order for greenfield Dev (tables missing). */
export const ITAM_DISCOVERY_APPLY_ORDER = [
  'supabase/migrations/20260930110000_get_current_user_org_id.sql',
  'supabase/migrations/20260930120000_itam_network_discovery.sql',
  'supabase/migrations/20260930130000_itam_phases_b_d.sql',
  'supabase/migrations/20260930140000_itam_form_sync.sql',
] as const;

/**
 * Forward-only RLS + unique-index repairs when 20260930120000 / 130000 / 140000
 * are already recorded in schema_migrations (edited in-repo content will NOT re-run).
 * Apply after VIS revoke 20261017130500. Do not auto-delete duplicates.
 */
export const ITAM_DISCOVERY_RLS_FORWARD_ORDER = [
  'supabase/migrations/20261017140000_itam_unique_indexes_preflight.sql',
  'supabase/migrations/20261017141000_itam_phase_a_rls_forward.sql',
  'supabase/migrations/20261017142000_itam_phases_b_d_rls_forward.sql',
  'supabase/migrations/20261017143000_itam_form_sync_rls_forward.sql',
] as const;

export class ItamDiscoverySchemaMissingError extends Error {
  readonly code = 'ITAM_DISCOVERY_SCHEMA_MISSING';
  readonly missingRelations: string[];

  constructor(missingRelations: string[]) {
    const missing = missingRelations.length
      ? missingRelations.join(', ')
      : '(unknown relation)';
    super(
      [
        `ITAM Discovery schema is incomplete — missing relation(s): ${missing}.`,
        'Nest will not auto-create these tables (keep ITAM_DISCOVERY_APPLY_SCHEMA=0 until Dev SQL is reviewed and applied).',
        'In-memory persistence is not used as a fallback.',
        'Apply the following files to the Dev Supabase project only, in order (SQL Editor or surgical CLI — do not bulk db push / repair history):',
        ...ITAM_DISCOVERY_APPLY_ORDER.map((f) => `  - ${f}`),
        'If those timestamps are already recorded but RLS/unique indexes are still loose/missing, apply forward-only repairs instead (do not re-edit shipped files):',
        ...ITAM_DISCOVERY_RLS_FORWARD_ORDER.map((f) => `  - ${f}`),
        'Note: the discovery host table is public.itam_discovered_hosts (not itam_discovered_assets).',
        'See docs/ITAM_DEV_SCHEMA_APPLY.md (Dev-only surgical apply).',
        'Keep ITAM_DISCOVERY_APPLY_SCHEMA=0 on deployed Nest boots.',
        'After applying, restart the backend. Other Nest modules continue; ITAM Discovery APIs remain unavailable until schema is present.',
      ].join('\n'),
    );
    this.name = 'ItamDiscoverySchemaMissingError';
    this.missingRelations = [...missingRelations];
  }
}

export function isItamDiscoverySchemaMissingError(err: unknown): err is ItamDiscoverySchemaMissingError {
  return (
    err instanceof ItamDiscoverySchemaMissingError
    || (Boolean(err) && typeof err === 'object' && (err as any).code === 'ITAM_DISCOVERY_SCHEMA_MISSING')
  );
}
