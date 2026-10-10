/**
 * VIS persistence selection.
 *
 * Production uses the existing Supabase project (service role, server-side only).
 * VIS_DATABASE_URL and Prisma are not consulted.
 * File/memory mode remains available for tests and is rejected in production.
 */

export type VisPersistenceMode = 'supabase' | 'file';

export function assertSupabaseConfigured(): void {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for VIS persistence. '
      + 'VIS_DATABASE_URL is not used.',
    );
  }
}

export function visPersistenceMode(): VisPersistenceMode {
  const requested = (process.env.VIS_PERSISTENCE || '').toLowerCase();
  const production = process.env.NODE_ENV === 'production';
  const fileRequested = requested === 'file'
    || requested === 'memory'
    || (process.env.VIS_STORE_MEMORY === '1' && requested !== 'supabase');

  if (requested === 'prisma') {
    throw new Error(
      'VIS_PERSISTENCE=prisma is no longer supported. VIS uses Supabase '
      + '(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY). Remove VIS_DATABASE_URL.',
    );
  }

  if (fileRequested) {
    if (production && process.env.VIS_ALLOW_FILE_STORE !== '1') {
      throw new Error(
        'File/memory VisStore is forbidden in production. Configure SUPABASE_URL and '
        + 'SUPABASE_SERVICE_ROLE_KEY (VIS_PERSISTENCE=supabase).',
      );
    }
    return 'file';
  }

  if (requested === 'supabase' || production) {
    assertSupabaseConfigured();
    return 'supabase';
  }

  return 'file';
}

export function isSupabasePersistenceEnabled(): boolean {
  return visPersistenceMode() === 'supabase';
}
