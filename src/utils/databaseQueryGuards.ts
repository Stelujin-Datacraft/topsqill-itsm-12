/**
 * Shared guards for the Nest-backed database client.
 * Kept free of Vite path aliases so Node/tsx tests can import them.
 */

export type GuardFilterClause =
  | { kind: 'filter'; column: string; operator: string; value: unknown }
  | { kind: 'not'; column: string; operator: string; value: unknown }
  | { kind: 'or'; expression: string };

/**
 * Nest `/database/query` returns `{ data, error, count? }`. `request()` wraps the HTTP
 * body once more as `{ data: nestBody }`. Unwrap the Nest envelope; also flatten a
 * single-element array when maybeSingle was requested (defensive).
 */
export function unwrapNestQueryPayload(
  payload: unknown,
  opts?: { maybeSingle?: boolean; single?: boolean },
): unknown {
  let data: unknown = payload;

  if (
    data
    && typeof data === 'object'
    && !Array.isArray(data)
    && Object.prototype.hasOwnProperty.call(data, 'data')
    && (
      Object.prototype.hasOwnProperty.call(data, 'error')
      || Object.prototype.hasOwnProperty.call(data, 'count')
    )
  ) {
    data = (data as { data: unknown }).data;
  }

  // Accidental extra { data: row } wrapper (truthy but no top-level id)
  if (
    data
    && typeof data === 'object'
    && !Array.isArray(data)
    && (data as { id?: unknown }).id == null
    && Object.prototype.hasOwnProperty.call(data, 'data')
    && (data as { data: unknown }).data
    && typeof (data as { data: unknown }).data === 'object'
  ) {
    data = (data as { data: unknown }).data;
  }

  if ((opts?.maybeSingle || opts?.single) && Array.isArray(data)) {
    data = data.length === 0 ? null : data[0];
  }

  return data ?? null;
}

/**
 * JSON.stringify drops keys whose value is `undefined`, which produced observed
 * payloads like: filters: [{ kind, column: "id", operator: "eq" }] (no value)
 * → Postgres: invalid input syntax for type uuid: "undefined"
 */
export function assertFiltersHaveValues(filters: GuardFilterClause[]): void {
  for (const filter of filters) {
    if (filter.kind === 'or') continue;
    const value = filter.value;
    if (value === undefined || value === null || value === 'undefined') {
      throw new Error(
        `Database filter value is required for column "${filter.column}" `
          + `(refusing to send undefined to UUID/text filters)`,
      );
    }
  }
}
