/**
 * Database API client — routes table operations through the NestJS backend
 * instead of direct PostgREST calls from the browser.
 *
 * Mirrors the Supabase query builder API so existing hooks work unchanged.
 */

import { request } from './apiClient';
import { rawSupabase } from '@/integrations/supabase/rawClient';

export type FilterClause =
  | { kind: 'filter'; column: string; operator: string; value: unknown }
  | { kind: 'not'; column: string; operator: string; value: unknown }
  | { kind: 'or'; expression: string };

export interface SelectOptions {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
}

export interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };

/**
 * Direct-Supabase fallback.
 * The NestJS API (VITE_API_URL, e.g. http://localhost:3001/api) is not reachable from
 * every environment (published app, preview, machines without the backend running).
 * When a call fails with a network error we permanently switch to talking to
 * Supabase/PostgREST directly so the app keeps working instead of showing
 * "Connection Issue / Failed to fetch".
 */
let backendUnavailable = false;

function isNetworkError(error: { message: string } | null): boolean {
  if (!error) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('network error') ||
    m.includes('load failed') ||
    m.includes('request timed out') ||
    m.includes('networkerror')
  );
}

/** Runs an API call, falling back to direct Supabase on network failure. */
async function withFallback(
  viaApi: () => Promise<QueryResult>,
  viaSupabase: () => Promise<QueryResult>,
): Promise<QueryResult> {
  if (backendUnavailable) return viaSupabase();
  const result = await viaApi();
  if (isNetworkError(result.error)) {
    backendUnavailable = true;
    return viaSupabase();
  }
  return result;
}

/** Applies collected filter clauses onto a raw Supabase query builder. */
function applyFilters(query: any, filters: FilterClause[]) {
  for (const f of filters) {
    if (f.kind === 'or') {
      query = query.or(f.expression);
    } else if (f.kind === 'not') {
      query = query.not(f.column, f.operator, f.value as never);
    } else {
      query = (query as Record<string, (c: string, v: unknown) => unknown>)[f.operator](f.column, f.value);
    }
  }
  return query;
}

/** Shared filter methods for query/update/delete builders */
class FilterMixin {
  protected filters: FilterClause[] = [];

  eq(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'eq', value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'neq', value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'gt', value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'gte', value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'lt', value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'lte', value }); return this; }
  like(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'like', value }); return this; }
  ilike(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'ilike', value }); return this; }
  in(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'in', value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'is', value }); return this; }
  contains(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'contains', value }); return this; }
  containedBy(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'containedBy', value }); return this; }
  cs(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'cs', value }); return this; }
  cd(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'cd', value }); return this; }
  ov(column: string, value: unknown) { this.filters.push({ kind: 'filter', column, operator: 'ov', value }); return this; }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ kind: 'not', column, operator, value });
    return this;
  }

  or(expression: string) {
    this.filters.push({ kind: 'or', expression });
    return this;
  }
}

class QueryBuilder extends FilterMixin {
  private selectCols = '*';
  private selectOptions?: SelectOptions;
  private orderBy: { column: string; ascending?: boolean }[] = [];
  private limitCount?: number;
  private rangeFrom?: number;
  private rangeTo?: number;
  private singleResult = false;
  private maybeSingleResult = false;

  constructor(private table: string) {
    super();
  }

  select(columns: string = '*', options?: SelectOptions) {
    this.selectCols = columns;
    this.selectOptions = options;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() { this.singleResult = true; return this; }
  maybeSingle() { this.maybeSingleResult = true; return this; }

  private async execute(): Promise<QueryResult> {
    return withFallback(() => this.executeViaApi(), () => this.executeViaSupabase());
  }

  private async executeViaApi(): Promise<QueryResult> {
    const result = await request<QueryResult['data']>('/database/query', {
      method: 'POST',
      body: JSON.stringify({
        table: this.table,
        select: this.selectCols,
        selectOptions: this.selectOptions,
        filters: this.filters,
        order: this.orderBy,
        limit: this.limitCount,
        rangeFrom: this.rangeFrom,
        rangeTo: this.rangeTo,
        single: this.singleResult,
        maybeSingle: this.maybeSingleResult,
      }),
    });

    if (result.error) {
      return { data: null, error: result.error };
    }

    const payload = result.data as QueryResult;
    return {
      data: payload?.data ?? payload,
      error: null,
      count: payload?.count ?? undefined,
    };
  }

  private async executeViaSupabase(): Promise<QueryResult> {
    let query: any = (rawSupabase as any).from(this.table).select(this.selectCols, this.selectOptions);
    query = applyFilters(query, this.filters);
    for (const o of this.orderBy) {
      query = query.order(o.column, { ascending: o.ascending ?? true });
    }
    if (this.limitCount !== undefined) query = query.limit(this.limitCount);
    if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
      query = query.range(this.rangeFrom, this.rangeTo);
    }
    if (this.singleResult) query = query.single();
    else if (this.maybeSingleResult) query = query.maybeSingle();

    const { data, error, count } = await query;
    return { data: data ?? null, error: error ? { message: error.message } : null, count: count ?? undefined };
  }

  then(
    resolve: (value: QueryResult) => void,
    reject?: (reason: unknown) => void,
  ) {
    return this.execute().then(resolve, reject);
  }
}

class InsertBuilder {
  constructor(
    private table: string,
    private data: Record<string, unknown> | Record<string, unknown>[],
  ) {}

  select(columns = '*') {
    return new ReturningResult(() =>
      withFallback(
        () =>
          request('/database/insert', {
            method: 'POST',
            body: JSON.stringify({ table: this.table, data: this.data, returning: columns }),
          }).then(normalizeResult),
        async () => {
          const { data, error } = await (rawSupabase as any)
            .from(this.table)
            .insert(this.data as never)
            .select(columns);
          return { data: data ?? null, error: error ? { message: error.message } : null };
        },
      ),
    );
  }

  then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

/** Wraps a returning-clause result so `.single()` / `.maybeSingle()` can be chained. */
class ReturningResult {
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(private run: () => Promise<QueryResult>) {}

  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybeSingle'; return this; }

  private async execute(): Promise<QueryResult> {
    const result = await this.run();
    if (result.error || this.mode === 'many') return result;
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (rows.length === 0) {
      if (this.mode === 'maybeSingle') return { ...result, data: null };
      return { data: null, error: { message: 'No rows returned' } };
    }
    return { ...result, data: rows[0] };
  }

  then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    return this.execute().then(resolve, reject);
  }

  catch(reject: (reason: unknown) => void) {
    return this.execute().catch(reject);
  }
}

class LegacyInsertBuilder {
  constructor(
    private table: string,
    private data: Record<string, unknown> | Record<string, unknown>[],
  ) {}

  select(columns = '*') {
    return withFallback(
      () =>
        request('/database/insert', {
          method: 'POST',
          body: JSON.stringify({ table: this.table, data: this.data, returning: columns }),
        }).then(normalizeResult),
      async () => {
        const { data, error } = await (rawSupabase as any)
          .from(this.table)
          .insert(this.data as never)
          .select(columns);
        return { data: data ?? null, error: error ? { message: error.message } : null };
      },
    );
  }

  then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

class UpsertBuilder {
  constructor(
    private table: string,
    private data: Record<string, unknown> | Record<string, unknown>[],
    private options: UpsertOptions = {},
  ) {}

  select(columns = '*') {
    return new ReturningResult(() => withFallback(
      () =>
        request('/database/upsert', {
          method: 'POST',
          body: JSON.stringify({
            table: this.table,
            data: this.data,
            onConflict: this.options.onConflict,
            ignoreDuplicates: this.options.ignoreDuplicates,
            returning: columns,
          }),
        }).then(normalizeResult),
      async () => {
        const { data, error } = await (rawSupabase as any)
          .from(this.table)
          .upsert(this.data as never, {
            onConflict: this.options.onConflict,
            ignoreDuplicates: this.options.ignoreDuplicates,
          })
          .select(columns);
        return { data: data ?? null, error: error ? { message: error.message } : null };
      },
    ));
  }

  then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

class UpdateBuilder extends FilterMixin {
  constructor(
    private table: string,
    private data: Record<string, unknown>,
  ) {
    super();
  }

  select(columns = '*') {
    return new ReturningResult(() => withFallback(
      () =>
        request('/database/update', {
          method: 'POST',
          body: JSON.stringify({
            table: this.table,
            data: this.data,
            filters: this.filters,
            returning: columns,
          }),
        }).then(normalizeResult),
      async () => {
        let query: any = (rawSupabase as any).from(this.table).update(this.data as never);
        query = applyFilters(query, this.filters);
        const { data, error } = await query.select(columns);
        return { data: data ?? null, error: error ? { message: error.message } : null };
      },
    ));
  }

  then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

class DeleteBuilder extends FilterMixin {
  constructor(private table: string) {
    super();
  }

  select(columns = '*') {
    return new ReturningResult(() => withFallback(
      () =>
        request('/database/delete', {
          method: 'POST',
          body: JSON.stringify({ table: this.table, filters: this.filters, returning: columns }),
        }).then(normalizeResult),
      async () => {
        let query: any = (rawSupabase as any).from(this.table).delete();
        query = applyFilters(query, this.filters);
        const { data, error } = await query.select(columns);
        return { data: data ?? null, error: error ? { message: error.message } : null };
      },
    ));
  }

  then(resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

function normalizeResult(result: { data: unknown; error: { message: string } | null }): QueryResult {
  if (result.error) return { data: null, error: result.error };
  const payload = result.data as QueryResult;
  return { data: payload?.data ?? payload, error: null, count: payload?.count };
}

export function paginatedRange(page = 1, pageSize = 100) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(1000, Math.max(1, pageSize));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1, page: safePage, pageSize: safeSize };
}

/** Supabase-compatible database client that routes through NestJS API */
export const db = {
  from(table: string) {
    return {
      select: (columns?: string, options?: SelectOptions) =>
        new QueryBuilder(table).select(columns ?? '*', options),
      insert: (data: Record<string, unknown> | Record<string, unknown>[]) =>
        new InsertBuilder(table, data),
      update: (data: Record<string, unknown>) => new UpdateBuilder(table, data),
      delete: () => new DeleteBuilder(table),
      upsert: (
        data: Record<string, unknown> | Record<string, unknown>[],
        options?: UpsertOptions,
      ) => new UpsertBuilder(table, data, options),
    };
  },

  rpc(functionName: string, params?: Record<string, unknown>) {
    return withFallback(
      () =>
        request('/database/rpc', {
          method: 'POST',
          body: JSON.stringify({ function: functionName, params }),
        }).then(normalizeResult),
      async () => {
        const { data, error } = await (rawSupabase as any).rpc(functionName, params);
        return { data: data ?? null, error: error ? { message: error.message } : null };
      },
    );
  },
};
