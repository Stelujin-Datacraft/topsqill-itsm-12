import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AccessLevel,
  MODULE_KEYS,
  MODULE_NAMES,
  ModuleDenial,
  ModuleKey,
  ModuleNeed,
  denialFor,
  entitlementLevel,
  levelAllows,
  limitFor,
} from './module-catalog';

export interface EntitlementRow {
  organization_id: string;
  module_key: string;
  source: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  grace_days: number;
  limits: Record<string, unknown> | null;
}

export interface ModuleAccess {
  module: ModuleKey;
  name: string;
  level: AccessLevel;
  source: string | null;
  endsAt: string | null;
  graceDays: number | null;
  limits: Record<string, unknown>;
}

export interface OrgAccess {
  organizationId: string;
  /** False until the entitlements migration is applied; every module is then open. */
  enforced: boolean;
  modules: Record<ModuleKey, ModuleAccess>;
}

const ORG_TTL_MS = 60_000;
const ACCESS_TTL_MS = 30_000;
const DENIAL_LOG_TTL_MS = 10 * 60_000;

export function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === '42883' || error.code === 'PGRST205' || error.code === 'PGRST202') return true;
  return /does not exist|Could not find the (table|function)/i.test(error.message || '');
}

export function buildOrgAccess(organizationId: string, rows: EntitlementRow[] | null, at: Date = new Date()): OrgAccess {
  const enforced = rows !== null;
  const byKey = new Map((rows || []).map((row) => [row.module_key, row]));
  const modules = {} as Record<ModuleKey, ModuleAccess>;
  for (const key of MODULE_KEYS) {
    const row = byKey.get(key);
    modules[key] = {
      module: key,
      name: MODULE_NAMES[key],
      level: enforced ? entitlementLevel(row, at) : 'full',
      source: row?.source ?? null,
      endsAt: row?.ends_at ?? null,
      graceDays: row?.grace_days ?? null,
      limits: (row?.limits as Record<string, unknown>) || {},
    };
  }
  return { organizationId, enforced, modules };
}

export class ModuleAccessDeniedException extends ForbiddenException {
  constructor(readonly denial: ModuleDenial) {
    super({ statusCode: 403, error: 'Forbidden', ...denial });
  }
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly orgByUser = new Map<string, { value: string | null; expiresAt: number }>();
  private readonly accessByOrg = new Map<string, { value: OrgAccess; expiresAt: number }>();
  private readonly recentDenials = new Map<string, number>();
  private warnedUnenforced = false;

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.getServiceClient();
  }

  async getOrgIdForUser(userId: string): Promise<string | null> {
    const cached = this.orgByUser.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const { data, error } = await this.db()
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    const value = (data?.organization_id as string | undefined) ?? null;
    this.orgByUser.set(userId, { value, expiresAt: Date.now() + ORG_TTL_MS });
    return value;
  }

  async getOrgAccess(organizationId: string): Promise<OrgAccess> {
    const cached = this.accessByOrg.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const { data, error } = await this.db()
      .from('org_entitlements')
      .select('organization_id, module_key, source, status, starts_at, ends_at, grace_days, limits')
      .eq('organization_id', organizationId);
    let rows: EntitlementRow[] | null = (data as EntitlementRow[]) || [];
    if (error) {
      if (!isMissingSchemaError(error)) throw error;
      if (!this.warnedUnenforced) {
        this.logger.warn('Module entitlements are not enforced: apply supabase/migrations/20261102150000_module_entitlements.sql');
        this.warnedUnenforced = true;
      }
      rows = null;
    }
    const value = buildOrgAccess(organizationId, rows);
    this.accessByOrg.set(organizationId, { value, expiresAt: Date.now() + ACCESS_TTL_MS });
    return value;
  }

  invalidate(organizationId?: string) {
    if (organizationId) this.accessByOrg.delete(organizationId);
    else this.accessByOrg.clear();
  }

  async assertModule(organizationId: string, module: ModuleKey, need: ModuleNeed, actorId?: string): Promise<ModuleAccess> {
    const access = await this.getOrgAccess(organizationId);
    const entry = access.modules[module];
    if (levelAllows(entry.level, need)) return entry;
    const denial = denialFor(module, entry.level, entry.name);
    await this.logDenial(organizationId, module, actorId, { ...denial, need });
    throw new ModuleAccessDeniedException(denial);
  }

  /** Adds `amount` to this month's usage, refusing when the entitlement limit would be passed. */
  async consume(organizationId: string, module: ModuleKey, metric: string, amount = 1, actorId?: string) {
    const access = await this.getOrgAccess(organizationId);
    if (!access.enforced) return { allowed: true, used: 0, limit: null as number | null };
    const limit = limitFor(access.modules[module].limits, metric);
    const { data, error } = await this.db().rpc('consume_module_usage', {
      _org_id: organizationId,
      _module: module,
      _metric: metric,
      _amount: amount,
      _limit: limit,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; used: number } | null;
    const used = Number(row?.used ?? 0);
    if (row?.allowed) return { allowed: true, used, limit };
    const denial: ModuleDenial = {
      code: 'MODULE_LIMIT_REACHED',
      module,
      level: access.modules[module].level,
      metric,
      limit: limit ?? undefined,
      used,
      message: `${MODULE_NAMES[module]} has used its ${limit} ${metric.replace(/_/g, ' ')} for this month. Ask your administrator to raise the limit.`,
    };
    await this.logDenial(organizationId, module, actorId, denial);
    throw new ModuleAccessDeniedException(denial);
  }

  async usageThisMonth(organizationId: string): Promise<Record<string, Record<string, number>>> {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    const { data, error } = await this.db()
      .from('module_usage_counters')
      .select('module_key, metric, used')
      .eq('organization_id', organizationId)
      .eq('period_start', periodStart.toISOString().slice(0, 10));
    if (error) {
      if (isMissingSchemaError(error)) return {};
      throw error;
    }
    const usage: Record<string, Record<string, number>> = {};
    for (const row of (data || []) as { module_key: string; metric: string; used: number }[]) {
      usage[row.module_key] = { ...(usage[row.module_key] || {}), [row.metric]: Number(row.used) };
    }
    return usage;
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.db().from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) {
      if (isMissingSchemaError(error)) return false;
      throw error;
    }
    return !!data;
  }

  private async logDenial(organizationId: string, module: ModuleKey, actorId: string | undefined, detail: object) {
    const key = `${organizationId}:${module}:${actorId || '-'}:${(detail as ModuleDenial).code}`;
    const last = this.recentDenials.get(key) || 0;
    if (Date.now() - last < DENIAL_LOG_TTL_MS) return;
    this.recentDenials.set(key, Date.now());
    const { error } = await this.db().rpc('platform_log_entitlement_event', {
      _org_id: organizationId,
      _module: module,
      _action: 'access_denied',
      _actor: actorId ?? null,
      _actor_source: 'api',
      _detail: detail,
    });
    if (error && !isMissingSchemaError(error)) this.logger.warn(`Could not log module denial: ${error.message}`);
  }
}
