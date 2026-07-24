/** Default row cap when callers omit limit/range — prevents full-table scans at scale. */
export const DEFAULT_QUERY_LIMIT = 1000;

/** Hard maximum for any single query page. */
export const MAX_QUERY_LIMIT = 1000;

/** Maximum rows per insert/upsert batch (chunked automatically above this). */
export const MAX_BATCH_INSERT_SIZE = 500;

/** Maximum rows a single update/delete may affect. */
export const MAX_MUTATION_ROWS = 1000;

/** RPC function names must match this pattern. */
export const RPC_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/i;
