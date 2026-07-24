/**
 * Database API client — routes table operations through the NestJS backend
 * instead of direct PostgREST calls from the browser.
 */

import { request } from './apiClient';

export interface QueryFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'contains' | 'containedBy';
  value: unknown;
}

class QueryBuilder {
  private table: string;
  private selectCols = '*';
  private filters: QueryFilter[] = [];
  private orderBy: { column: string; ascending?: boolean }[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private singleResult = false;
  private maybeSingleResult = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*') {
    this.selectCols = columns;
    return this;
  }

  eq(column: string, value: unknown) { this.filters.push({ column, operator: 'eq', value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, operator: 'neq', value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ column, operator: 'gt', value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ column, operator: 'gte', value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ column, operator: 'lt', value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ column, operator: 'lte', value }); return this; }
  like(column: string, value: unknown) { this.filters.push({ column, operator: 'like', value }); return this; }
  ilike(column: string, value: unknown) { this.filters.push({ column, operator: 'ilike', value }); return this; }
  in(column: string, value: unknown) { this.filters.push({ column, operator: 'in', value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, operator: 'is', value }); return this; }
  contains(column: string, value: unknown) { this.filters.push({ column, operator: 'contains', value }); return this; }
  containedBy(column: string, value: unknown) { this.filters.push({ column, operator: 'containedBy', value }); return this; }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) { this.limitCount = count; return this; }
  range(from: number, to: number) { this.offsetCount = from; this.limitCount = to - from + 1; return this; }

  single() { this.singleResult = true; return this; }
  maybeSingle() { this.maybeSingleResult = true; return this; }

  private async execute() {
    const result = await request('/database/query', {
      method: 'POST',
      body: JSON.stringify({
        table: this.table,
        select: this.selectCols,
        filters: this.filters,
        order: this.orderBy,
        limit: this.limitCount,
        offset: this.offsetCount,
        single: this.singleResult,
        maybeSingle: this.maybeSingleResult,
      }),
    });
    return result;
  }

  then(resolve: (value: { data: unknown; error: { message: string } | null; count?: number }) => void, reject?: (reason: unknown) => void) {
    return this.execute().then(resolve, reject);
  }
}

class InsertBuilder {
  constructor(private table: string, private data: Record<string, unknown> | Record<string, unknown>[]) {}

  select(columns = '*') {
    return request('/database/insert', {
      method: 'POST',
      body: JSON.stringify({ table: this.table, data: this.data, returning: columns }),
    });
  }

  then(resolve: (value: { data: unknown; error: { message: string } | null }) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

class UpdateBuilder {
  private filters: QueryFilter[] = [];

  constructor(private table: string, private data: Record<string, unknown>) {}

  eq(column: string, value: unknown) { this.filters.push({ column, operator: 'eq', value }); return this; }

  select(columns = '*') {
    return request('/database/update', {
      method: 'POST',
      body: JSON.stringify({ table: this.table, data: this.data, filters: this.filters, returning: columns }),
    });
  }

  then(resolve: (value: { data: unknown; error: { message: string } | null }) => void, reject?: (reason: unknown) => void) {
    return this.select().then(resolve, reject);
  }
}

class DeleteBuilder {
  private filters: QueryFilter[] = [];

  constructor(private table: string) {}

  eq(column: string, value: unknown) { this.filters.push({ column, operator: 'eq', value }); return this; }

  then(resolve: (value: { data: unknown; error: { message: string } | null }) => void, reject?: (reason: unknown) => void) {
    return request('/database/delete', {
      method: 'POST',
      body: JSON.stringify({ table: this.table, filters: this.filters }),
    }).then(resolve, reject);
  }
}

/** Supabase-compatible database client that routes through NestJS API */
export const db = {
  from(table: string) {
    return {
      select: (columns = '*') => new QueryBuilder(table).select(columns),
      insert: (data: Record<string, unknown> | Record<string, unknown>[]) => new InsertBuilder(table, data),
      update: (data: Record<string, unknown>) => new UpdateBuilder(table, data),
      delete: () => new DeleteBuilder(table),
      upsert: (data: Record<string, unknown> | Record<string, unknown>[]) => new InsertBuilder(table, data),
    };
  },

  rpc(functionName: string, params?: Record<string, unknown>) {
    return request('/database/rpc', {
      method: 'POST',
      body: JSON.stringify({ function: functionName, params }),
    });
  },
};
