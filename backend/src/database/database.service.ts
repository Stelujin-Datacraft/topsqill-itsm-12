import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DEFAULT_QUERY_LIMIT,
  MAX_BATCH_INSERT_SIZE,
  MAX_MUTATION_ROWS,
  MAX_QUERY_LIMIT,
  RPC_NAME_PATTERN,
} from '../common/constants/database.constants';
import {
  isDevDatabaseDiagnosticsEnabled,
  normalizeFormsInsertRowsForAuth,
} from './forms-insert-auth';

export type FilterClause =
  | { kind: 'filter'; column: string; operator: string; value: unknown }
  | { kind: 'not'; column: string; operator: string; value: unknown }
  | { kind: 'or'; expression: string };

export interface SelectOptions {
  count?: 'exact' | 'planned' | 'estimated';
  head?: boolean;
}

export interface DatabaseQueryDto {
  table: string;
  select?: string;
  selectOptions?: SelectOptions;
  filters?: FilterClause[];
  order?: { column: string; ascending?: boolean }[];
  limit?: number;
  rangeFrom?: number;
  rangeTo?: number;
  single?: boolean;
  maybeSingle?: boolean;
}

export interface DatabaseInsertDto {
  table: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  returning?: string;
}

export interface DatabaseUpsertDto {
  table: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
  returning?: string;
}

export interface DatabaseUpdateDto {
  table: string;
  data: Record<string, unknown>;
  filters: FilterClause[];
  returning?: string;
}

export interface DatabaseDeleteDto {
  table: string;
  filters: FilterClause[];
  returning?: string;
}

export interface DatabaseRpcDto {
  function: string;
  params?: Record<string, unknown>;
}

const BLOCKED_TABLES = new Set<string>();

@Injectable()
export class DatabaseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Reject missing filter values. JSON.stringify drops `undefined`, so clients can
   * send `{ column: "id", operator: "eq" }` without `value`; supabase-js then
   * queries `eq=undefined` and Postgres returns:
   *   invalid input syntax for type uuid: "undefined"
   */
  assertFilterValues(filters: FilterClause[] | undefined) {
    if (!filters?.length) return;
    for (const filter of filters) {
      if (filter.kind === 'or') continue;
      const value = filter.value;
      if (value === undefined || value === null || value === 'undefined') {
        throw new BadRequestException(
          `Filter value is required for column "${filter.column}"`,
        );
      }
    }
  }

  private applyFilters(query: any, filters: FilterClause[]) {
    this.assertFilterValues(filters);
    for (const filter of filters) {
      if (filter.kind === 'or') {
        query = query.or(filter.expression);
        continue;
      }
      if (filter.kind === 'not') {
        query = query.not(filter.column, filter.operator, filter.value);
        continue;
      }
      const { column, operator, value } = filter;
      switch (operator) {
        case 'eq': query = query.eq(column, value); break;
        case 'neq': query = query.neq(column, value); break;
        case 'gt': query = query.gt(column, value); break;
        case 'gte': query = query.gte(column, value); break;
        case 'lt': query = query.lt(column, value); break;
        case 'lte': query = query.lte(column, value); break;
        case 'like': query = query.like(column, value); break;
        case 'ilike': query = query.ilike(column, value); break;
        case 'in': query = query.in(column, value); break;
        case 'is': query = query.is(column, value); break;
        case 'contains': query = query.contains(column, value); break;
        case 'containedBy': query = query.containedBy(column, value); break;
        case 'cs': query = query.cs(column, value); break;
        case 'cd': query = query.cd(column, value); break;
        case 'ov': query = query.ov(column, value); break;
        case 'fts': query = query.fts(column, value); break;
        default:
          throw new BadRequestException(`Unsupported filter operator: ${operator}`);
      }
    }
    return query;
  }

  private validateTable(table: string) {
    if (!table || !/^[a-z_][a-z0-9_]*$/i.test(table)) {
      throw new BadRequestException('Invalid table name');
    }
    if (BLOCKED_TABLES.has(table)) {
      throw new ForbiddenException(`Access to table ${table} is not allowed`);
    }
  }

  private validateRpcName(functionName: string) {
    if (!functionName || !RPC_NAME_PATTERN.test(functionName)) {
      throw new BadRequestException('Invalid RPC function name');
    }
  }

  private requireFilters(filters: FilterClause[] | undefined, operation: string) {
    if (!filters?.length) {
      throw new BadRequestException(`Filters are required for ${operation} operations`);
    }
  }

  /**
   * Guard update/delete against oversized mutations without using PostgREST
   * Limited Update/Delete (`limit` on PATCH/DELETE), which requires an explicit
   * `order` on a unique column (PGRST109: "A 'limit' was applied without an
   * explicit 'order'"). Count matching rows first, then mutate without `.limit()`.
   */
  private async assertMutationWithinRowLimit(
    client: ReturnType<SupabaseService['getServiceClient']>,
    table: string,
    filters: FilterClause[],
    operation: 'Update' | 'Delete',
  ) {
    let countQuery = client.from(table).select('*', { count: 'exact', head: true });
    countQuery = this.applyFilters(countQuery, filters);
    const { count, error } = await countQuery;
    if (error) throw new BadRequestException(error.message);
    if ((count ?? 0) > MAX_MUTATION_ROWS) {
      throw new BadRequestException(
        `${operation} would affect more than ${MAX_MUTATION_ROWS} rows. Add more specific filters.`,
      );
    }
  }

  /**
   * PostgREST + RLS often return HTTP 200 with an empty representation when
   * the caller is not allowed to see/mutate the row. Treat that as failure so
   * clients never report success for zero affected rows.
   */
  private assertMutationAffectedRows(
    data: unknown,
    operation: 'insert' | 'update' | 'delete',
    table: string,
    minRows = 1,
  ) {
    const rows = Array.isArray(data) ? data : data == null ? [] : [data];
    if (rows.length < minRows) {
      const verb =
        operation === 'insert'
          ? 'inserted'
          : operation === 'update'
            ? 'updated'
            : 'deleted';
      throw new BadRequestException(
        `No rows were ${verb} on ${table}. The record may be missing, already removed, or blocked by row-level security.`,
      );
    }
  }

  private resolvePagination(dto: DatabaseQueryDto): {
    rangeFrom?: number;
    rangeTo?: number;
    limit: number;
  } {
    if (dto.single || dto.maybeSingle) {
      return { limit: 1 };
    }

    if (dto.rangeFrom !== undefined && dto.rangeTo !== undefined) {
      const size = dto.rangeTo - dto.rangeFrom + 1;
      if (size > MAX_QUERY_LIMIT) {
        throw new BadRequestException(`Range size exceeds maximum of ${MAX_QUERY_LIMIT}`);
      }
      if (dto.rangeFrom < 0 || dto.rangeTo < dto.rangeFrom) {
        throw new BadRequestException('Invalid range');
      }
      return { rangeFrom: dto.rangeFrom, rangeTo: dto.rangeTo, limit: size };
    }

    const limit = dto.limit ?? DEFAULT_QUERY_LIMIT;
    if (limit > MAX_QUERY_LIMIT) {
      throw new BadRequestException(`Limit exceeds maximum of ${MAX_QUERY_LIMIT}`);
    }
    if (limit < 1) {
      throw new BadRequestException('Limit must be at least 1');
    }

    return { limit };
  }

  private getClient(authHeader?: string, opts?: { requireUser?: boolean }) {
    if (opts?.requireUser) {
      if (!authHeader) {
        throw new UnauthorizedException('No authorization header');
      }
      // Never fall back to service-role for user mutations (would bypass or mis-apply RLS).
      return this.supabaseService.getClientForUser(authHeader);
    }
    if (authHeader) {
      return this.supabaseService.getClientForUser(authHeader);
    }
    // Reads/RPCs without a user token: service client (background / health only).
    return this.supabaseService.getServiceClient();
  }

  private async chunkInsert(
    client: ReturnType<SupabaseService['getServiceClient']>,
    table: string,
    rows: Record<string, unknown>[],
    select: string,
  ) {
    const results: unknown[] = [];

    for (let i = 0; i < rows.length; i += MAX_BATCH_INSERT_SIZE) {
      const chunk = rows.slice(i, i + MAX_BATCH_INSERT_SIZE);
      const { data, error } = await client.from(table).insert(chunk).select(select);
      if (error) throw new BadRequestException(error.message);
      if (Array.isArray(data)) {
        results.push(...data);
      } else if (data) {
        results.push(data);
      }
    }

    return results;
  }

  async query(dto: DatabaseQueryDto, authHeader?: string) {
    this.validateTable(dto.table);
    const client = this.getClient(authHeader);
    const pagination = this.resolvePagination(dto);

    const selectOpts = dto.selectOptions;
    const hasSelectOptions = selectOpts && (selectOpts.count || selectOpts.head);

    let query = hasSelectOptions
      ? client.from(dto.table).select(dto.select || '*', {
          count: selectOpts.count,
          head: selectOpts.head,
        })
      : client.from(dto.table).select(dto.select || '*');

    if (dto.filters?.length) {
      query = this.applyFilters(query, dto.filters);
    }

    if (dto.order?.length) {
      for (const o of dto.order) {
        query = query.order(o.column, { ascending: o.ascending ?? true });
      }
    }

    if (pagination.rangeFrom !== undefined && pagination.rangeTo !== undefined) {
      query = query.range(pagination.rangeFrom, pagination.rangeTo);
    } else {
      query = query.limit(pagination.limit);
    }

    if (dto.single) {
      const { data, error, count } = await query.single();
      if (error) throw new BadRequestException(error.message);
      return { data, error: null, count: count ?? undefined };
    }

    if (dto.maybeSingle) {
      const { data, error, count } = await query.maybeSingle();
      if (error) throw new BadRequestException(error.message);
      return { data, error: null, count: count ?? undefined };
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, error: null, count: count ?? undefined };
  }

  async insert(dto: DatabaseInsertDto, authHeader?: string) {
    this.validateTable(dto.table);
    // User-scoped client only — forms_insert (and other RLS) must see auth.uid().
    const client = this.getClient(authHeader, { requireUser: true });
    const select = dto.returning || '*';
    let payload: Record<string, unknown> | Record<string, unknown>[] = dto.data;

    if (dto.table === 'forms') {
      const user = await this.supabaseService.getUserFromToken(authHeader);
      if (!user?.id) {
        throw new UnauthorizedException('Invalid user token');
      }
      try {
        const normalized = normalizeFormsInsertRowsForAuth(dto.data, user.id);
        if (isDevDatabaseDiagnosticsEnabled()) {
          console.info(normalized.diagnostics);
        }
        payload =
          Array.isArray(dto.data) ? normalized.rows : normalized.rows[0];
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Invalid forms insert payload',
        );
      }
    }

    const rows = Array.isArray(payload) ? payload : [payload];

    if (rows.length > MAX_BATCH_INSERT_SIZE) {
      const data = await this.chunkInsert(client, dto.table, rows, select);
      return { data, error: null };
    }

    const { data, error } = await client.from(dto.table).insert(payload).select(select);
    if (error) throw new BadRequestException(error.message);
    this.assertMutationAffectedRows(data, 'insert', dto.table, rows.length);
    return { data, error: null };
  }

  async upsert(dto: DatabaseUpsertDto, authHeader?: string) {
    this.validateTable(dto.table);
    // User JWT required — same RLS identity rules as insert/update/delete.
    const client = this.getClient(authHeader, { requireUser: true });
    const select = dto.returning || '*';
    const rows = Array.isArray(dto.data) ? dto.data : [dto.data];

    const options: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    if (dto.onConflict) options.onConflict = dto.onConflict;
    if (dto.ignoreDuplicates !== undefined) options.ignoreDuplicates = dto.ignoreDuplicates;

    if (rows.length > MAX_BATCH_INSERT_SIZE) {
      const results: unknown[] = [];
      for (let i = 0; i < rows.length; i += MAX_BATCH_INSERT_SIZE) {
        const chunk = rows.slice(i, i + MAX_BATCH_INSERT_SIZE);
        const { data, error } = await client.from(dto.table).upsert(chunk, options).select(select);
        if (error) throw new BadRequestException(error.message);
        if (Array.isArray(data)) results.push(...data);
        else if (data) results.push(data);
      }
      return { data: results, error: null };
    }

    const { data, error } = await client
      .from(dto.table)
      .upsert(dto.data, options)
      .select(select);

    if (error) throw new BadRequestException(error.message);
    this.assertMutationAffectedRows(data, 'insert', dto.table, rows.length);
    return { data, error: null };
  }

  async update(dto: DatabaseUpdateDto, authHeader?: string) {
    this.validateTable(dto.table);
    this.requireFilters(dto.filters, 'update');
    // User JWT required on Dev and Prod VMs so RLS sees auth.uid().
    const client = this.getClient(authHeader, { requireUser: true });
    await this.assertMutationWithinRowLimit(client, dto.table, dto.filters, 'Update');

    let query = client.from(dto.table).update(dto.data);
    query = this.applyFilters(query, dto.filters);

    const select = dto.returning || 'id';
    // Do not call .limit() on PATCH — PostgREST treats it as Limited Update and
    // requires order on a unique column (see assertMutationWithinRowLimit).
    const { data, error } = await query.select(select);
    if (error) throw new BadRequestException(error.message);
    // RLS can yield success with zero rows — do not report false success to clients.
    this.assertMutationAffectedRows(data, 'update', dto.table, 1);
    return { data, error: null };
  }

  async delete(dto: DatabaseDeleteDto, authHeader?: string) {
    this.validateTable(dto.table);
    this.requireFilters(dto.filters, 'delete');
    // User JWT required on Dev and Prod VMs so RLS sees auth.uid().
    const client = this.getClient(authHeader, { requireUser: true });
    await this.assertMutationWithinRowLimit(client, dto.table, dto.filters, 'Delete');

    let query = client.from(dto.table).delete();
    query = this.applyFilters(query, dto.filters);

    const returning = dto.returning || 'id';
    // Do not call .limit() on DELETE — same PostgREST Limited Delete constraint.
    const { data, error } = await query.select(returning);
    if (error) throw new BadRequestException(error.message);
    // RLS deny / wrong id often returns [] with no error — treat as failure.
    this.assertMutationAffectedRows(data, 'delete', dto.table, 1);
    return { data, error: null };
  }

  async rpc(dto: DatabaseRpcDto, authHeader?: string) {
    this.validateRpcName(dto.function);
    // User JWT required — RPCs like delete_form_authorized need auth.uid().
    const client = this.getClient(authHeader, { requireUser: true });
    const { data, error } = await client.rpc(dto.function, dto.params || {});
    if (error) throw new BadRequestException(error.message);
    return { data, error: null };
  }
}
