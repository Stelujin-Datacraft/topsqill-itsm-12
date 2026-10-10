/**
 * @deprecated Replaced by `supabase-vis.store.ts`.
 * Kept as a thin fatal stub so accidental imports fail loudly.
 */
export class PrismaVisStore {
  constructor() {
    throw new Error(
      'PrismaVisStore has been removed. Use SupabaseVisStore (shared Supabase project).',
    );
  }
}

export class PrismaVisStoreTx {
  constructor() {
    throw new Error('PrismaVisStoreTx has been removed. Use SupabaseVisStoreTx.');
  }
}
