import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface QueryFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'contains' | 'containedBy';
  value: unknown;
}

export interface DatabaseQueryDto {
  table: string;
  select?: string;
  filters?: QueryFilter[];
  order?: { column: string; ascending?: boolean }[];
  limit?: number;
  offset?: number;
  single?: boolean;
  maybeSingle?: boolean;
}

export interface DatabaseInsertDto {
  table: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  returning?: string;
}

export interface DatabaseUpdateDto {
  table: string;
  data: Record<string, unknown>;
  filters: QueryFilter[];
  returning?: string;
}

export interface DatabaseDeleteDto {
  table: string;
  filters: QueryFilter[];
}

export interface DatabaseRpcDto {
  function: string;
  params?: Record<string, unknown>;
}

const BLOCKED_TABLES = new Set<string>();

@Injectable()
export class DatabaseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private applyFilters(query: any, filters: QueryFilter[]) {
    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq': query = query.eq(filter.column, filter.value); break;
        case 'neq': query = query.neq(filter.column, filter.value); break;
        case 'gt': query = query.gt(filter.column, filter.value); break;
        case 'gte': query = query.gte(filter.column, filter.value); break;
        case 'lt': query = query.lt(filter.column, filter.value); break;
        case 'lte': query = query.lte(filter.column, filter.value); break;
        case 'like': query = query.like(filter.column, filter.value); break;
        case 'ilike': query = query.ilike(filter.column, filter.value); break;
        case 'in': query = query.in(filter.column, filter.value); break;
        case 'is': query = query.is(filter.column, filter.value); break;
        case 'contains': query = query.contains(filter.column, filter.value); break;
        case 'containedBy': query = query.containedBy(filter.column, filter.value); break;
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

  async query(dto: DatabaseQueryDto, authHeader?: string) {
    this.validateTable(dto.table);
    const client = authHeader
      ? this.supabaseService.getClientForUser(authHeader)
      : this.supabaseService.getServiceClient();

    let query = client.from(dto.table).select(dto.select || '*');

    if (dto.filters?.length) {
      query = this.applyFilters(query, dto.filters);
    }

    if (dto.order?.length) {
      for (const o of dto.order) {
        query = query.order(o.column, { ascending: o.ascending ?? true });
      }
    }

    if (dto.limit) query = query.limit(dto.limit);
    if (dto.offset) query = query.range(dto.offset, dto.offset + (dto.limit || 1000) - 1);

    if (dto.single) {
      const { data, error } = await query.single();
      if (error) throw new BadRequestException(error.message);
      return { data, error: null };
    }

    if (dto.maybeSingle) {
      const { data, error } = await query.maybeSingle();
      if (error) throw new BadRequestException(error.message);
      return { data, error: null };
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, error: null, count };
  }

  async insert(dto: DatabaseInsertDto, authHeader?: string) {
    this.validateTable(dto.table);
    const client = authHeader
      ? this.supabaseService.getClientForUser(authHeader)
      : this.supabaseService.getServiceClient();

    const select = dto.returning || '*';
    const { data, error } = await client.from(dto.table).insert(dto.data).select(select);
    if (error) throw new BadRequestException(error.message);
    return { data, error: null };
  }

  async update(dto: DatabaseUpdateDto, authHeader?: string) {
    this.validateTable(dto.table);
    const client = authHeader
      ? this.supabaseService.getClientForUser(authHeader)
      : this.supabaseService.getServiceClient();

    let query = client.from(dto.table).update(dto.data);
    query = this.applyFilters(query, dto.filters);

    const select = dto.returning || '*';
    const { data, error } = await query.select(select);
    if (error) throw new BadRequestException(error.message);
    return { data, error: null };
  }

  async delete(dto: DatabaseDeleteDto, authHeader?: string) {
    this.validateTable(dto.table);
    const client = authHeader
      ? this.supabaseService.getClientForUser(authHeader)
      : this.supabaseService.getServiceClient();

    let query = client.from(dto.table).delete();
    query = this.applyFilters(query, dto.filters);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, error: null };
  }

  async rpc(dto: DatabaseRpcDto, authHeader?: string) {
    const client = authHeader
      ? this.supabaseService.getClientForUser(authHeader)
      : this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc(dto.function, dto.params || {});
    if (error) throw new BadRequestException(error.message);
    return { data, error: null };
  }
}
