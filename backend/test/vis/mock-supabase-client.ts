/**
 * In-memory stand-in for the Supabase query builder.
 * Returns { data, error } responses and enforces the VIS unique keys and foreign keys
 * that the review SQL migration declares.
 */
import type { VisSupabaseClient } from '../../src/vis/store/supabase-vis.client';

type Row = Record<string, any>;

const UNIQUE: Record<string, string[][]> = {
  vis_integration_versions: [['integration_id', 'version']],
  vis_schema_cache: [['connection_id', 'form_id']],
  vis_events: [['event_id']],
  vis_event_checkpoints: [['integration_id']],
  vis_connectors: [['name', 'vendor', 'version']],
  vis_secret_blobs: [['ref_id']],
  vis_policy_rules: [['rule_key']],
};

const FOREIGN_KEYS: Record<string, Array<{ column: string; table: string; nullable?: boolean }>> = {
  vis_connections: [{ column: 'credential_ref_id', table: 'vis_credential_references', nullable: true }],
  vis_integration_versions: [{ column: 'integration_id', table: 'vis_integrations' }],
  vis_executions: [{ column: 'integration_id', table: 'vis_integrations' }],
  vis_execution_logs: [{ column: 'execution_id', table: 'vis_executions' }],
  vis_audit_logs: [{ column: 'integration_id', table: 'vis_integrations', nullable: true }],
};

function constraintError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

export interface MockSupabase {
  client: VisSupabaseClient;
  rows(table: string): Row[];
  failNext(table: string | undefined, op: string | undefined, error: { message: string; code?: string }): void;
  setRpc(handler: ((fn: string, args?: Record<string, unknown>) => { data: any; error: any } | Promise<{ data: any; error: any }>) | null): void;
}

export function createMockSupabase(): MockSupabase {
  const tables = new Map<string, Row[]>();
  const failures: Array<{ table?: string; op?: string; error: { message: string; code?: string } }> = [];
  let rpcOverride: MockSupabase['setRpc'] extends (handler: infer H) => void ? H : never = null;

  function tableRows(table: string): Row[] {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  }

  function takeFailure(table: string, op: string) {
    const index = failures.findIndex((failure) =>
      (failure.table == null || failure.table === table) && (failure.op == null || failure.op === op));
    if (index < 0) return null;
    return failures.splice(index, 1)[0].error;
  }

  function enforce(table: string, row: Row, existing: Row[]) {
    if (row.id != null && existing.some((item) => item.id === row.id)) {
      throw constraintError(`duplicate key value violates unique constraint "${table}_pkey"`, '23505');
    }
    for (const keys of UNIQUE[table] || []) {
      if (keys.some((key) => row[key] == null)) continue;
      const clash = existing.some((item) => keys.every((key) => item[key] === row[key]));
      if (clash) throw constraintError(`duplicate key value violates unique constraint "${table}_${keys.join('_')}_key"`, '23505');
    }
    for (const fk of FOREIGN_KEYS[table] || []) {
      const value = row[fk.column];
      if (value == null) {
        if (fk.nullable) continue;
        throw constraintError(`null value in column "${fk.column}" violates not-null constraint`, '23502');
      }
      const parent = tableRows(fk.table);
      if (!parent.some((item) => item.id === value)) {
        throw constraintError(
          `insert or update on table "${table}" violates foreign key constraint "${table}_${fk.column}_fkey"`,
          '23503',
        );
      }
    }
  }

  function applyRpc(args?: Record<string, unknown>) {
    const ops = Array.isArray(args?.ops) ? args.ops as Array<Record<string, any>> : null;
    if (!ops) return { data: null, error: { message: 'ops must be a json array', code: '22023' } };
    const snapshot = new Map<string, Row[]>([...tables.entries()].map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
    try {
      for (const op of ops) {
        const table = String(op.table || '');
        const rows = tableRows(table);
        if (op.op === 'delete') {
          const id = op.id;
          if (table === 'vis_documents') {
            for (const row of rows) {
              if (row.id === id && (op.collection == null || row.collection === op.collection)) {
                row.deleted_at = new Date().toISOString();
              }
            }
          } else {
            tables.set(table, rows.filter((row) => row.id !== id));
          }
          continue;
        }
        if (op.op !== 'upsert') throw constraintError(`unsupported op ${op.op}`, '22023');
        const incoming = { ...(op.row || {}) };
        const index = rows.findIndex((row) => row.id === incoming.id);
        if (index >= 0) {
          rows[index] = { ...rows[index], ...incoming, id: rows[index].id };
        } else {
          enforce(table, incoming, rows);
          rows.push(incoming);
        }
      }
      return { data: { ok: true, count: ops.length }, error: null };
    } catch (error: any) {
      tables.clear();
      for (const [name, rows] of snapshot) tables.set(name, rows);
      return { data: null, error: { message: error.message, code: error.code } };
    }
  }

  class Query {
    private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    private filters: Array<{ column: string; value: any; kind: 'eq' | 'is' }> = [];
    private sort?: { column: string; ascending: boolean };
    private fromIndex?: number;
    private toIndex?: number;
    private columns = '*';
    private payload: any = null;
    private onConflict = 'id';

    constructor(private readonly table: string) {}

    select(columns = '*') {
      this.columns = columns;
      return this;
    }

    insert(row: any) {
      this.op = 'insert';
      this.payload = row;
      return this;
    }

    update(patch: any) {
      this.op = 'update';
      this.payload = patch;
      return this;
    }

    upsert(row: any, options?: { onConflict?: string }) {
      this.op = 'upsert';
      this.payload = row;
      this.onConflict = options?.onConflict || 'id';
      return this;
    }

    delete() {
      this.op = 'delete';
      return this;
    }

    eq(column: string, value: any) {
      this.filters.push({ column, value, kind: 'eq' });
      return this;
    }

    is(column: string, value: any) {
      this.filters.push({ column, value, kind: 'is' });
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.sort = { column, ascending: options?.ascending !== false };
      return this;
    }

    range(from: number, to: number) {
      this.fromIndex = from;
      this.toIndex = to;
      return this;
    }

    limit(count: number) {
      this.fromIndex = 0;
      this.toIndex = count - 1;
      return this;
    }

    private matches(row: Row) {
      return this.filters.every((filter) => {
        const value = row[filter.column] ?? null;
        return filter.kind === 'is' ? value === filter.value : row[filter.column] === filter.value;
      });
    }

    private project(row: Row) {
      if (!this.columns || this.columns === '*') return { ...row };
      const projected: Row = {};
      for (const column of this.columns.split(',').map((item) => item.trim())) projected[column] = row[column];
      return projected;
    }

    async execute(): Promise<{ data: any; error: any }> {
      const failure = takeFailure(this.table, this.op);
      if (failure) return { data: null, error: failure };
      const rows = tableRows(this.table);
      try {
        if (this.op === 'insert') {
          const row = { ...this.payload };
          enforce(this.table, row, rows);
          rows.push(row);
          return { data: this.project(row), error: null };
        }
        if (this.op === 'upsert') {
          const row = { ...this.payload };
          const keys = this.onConflict.split(',').map((key) => key.trim());
          const index = rows.findIndex((existing) => keys.every((key) => existing[key] === row[key]));
          if (index >= 0) {
            const next = { ...rows[index], ...row, id: rows[index].id };
            rows[index] = next;
            return { data: this.project(next), error: null };
          }
          enforce(this.table, row, rows);
          rows.push(row);
          return { data: this.project(row), error: null };
        }
        if (this.op === 'update') {
          const matched = rows.filter((row) => this.matches(row));
          for (const row of matched) Object.assign(row, this.payload);
          return { data: matched.map((row) => this.project(row)), error: null };
        }
        if (this.op === 'delete') {
          const removed: Row[] = [];
          const kept: Row[] = [];
          for (const row of rows) {
            if (this.matches(row)) removed.push(row);
            else kept.push(row);
          }
          tables.set(this.table, kept);
          return { data: removed.map((row) => this.project(row)), error: null };
        }
        let matched = rows.filter((row) => this.matches(row));
        if (this.sort) {
          const { column, ascending } = this.sort;
          matched = [...matched].sort((left, right) => {
            const a = left[column];
            const b = right[column];
            if (a === b) return 0;
            if (a == null) return 1;
            if (b == null) return -1;
            return (a < b ? -1 : 1) * (ascending ? 1 : -1);
          });
        }
        if (this.fromIndex != null || this.toIndex != null) {
          const from = this.fromIndex ?? 0;
          const to = this.toIndex != null ? this.toIndex + 1 : matched.length;
          matched = matched.slice(from, to);
        }
        return { data: matched.map((row) => this.project(row)), error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message, code: error.code } };
      }
    }

    async single() {
      const result = await this.execute();
      if (result.error) return { data: null, error: result.error };
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      if (rows.length !== 1) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      }
      return { data: rows[0], error: null };
    }

    async maybeSingle() {
      const result = await this.execute();
      if (result.error) return { data: null, error: result.error };
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      if (rows.length > 1) return { data: null, error: { message: 'multiple rows', code: 'PGRST116' } };
      return { data: rows[0] ?? null, error: null };
    }

    then<TResult1 = { data: any; error: any }, TResult2 = never>(
      onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  const client: VisSupabaseClient = {
    from(table: string) {
      return new Query(table);
    },
    async rpc(fn: string, args?: Record<string, unknown>) {
      if (fn !== 'vis_apply_transaction') {
        return { data: null, error: { message: `function ${fn} does not exist`, code: 'PGRST202' } };
      }
      if (rpcOverride) return rpcOverride(fn, args);
      return applyRpc(args);
    },
  };

  return {
    client,
    rows: tableRows,
    failNext(table, op, error) {
      failures.push({ table, op, error });
    },
    setRpc(handler) {
      rpcOverride = handler;
    },
  };
}
