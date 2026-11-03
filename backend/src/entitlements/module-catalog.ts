export const MODULE_KEYS = [
  'ai-builder',
  'asset-discovery',
  'integration-studio',
  'promotional-transfer',
  'real-estate',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** full and grace allow everything, read_only allows reading existing data, none allows nothing. */
export type AccessLevel = 'full' | 'grace' | 'read_only' | 'none';

export type ModuleNeed = 'view' | 'use';

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && (MODULE_KEYS as readonly string[]).includes(value);
}

/** Reads only need view access; anything that creates or changes data needs use. */
export function needForMethod(method: string | undefined): ModuleNeed {
  const upper = String(method || 'GET').toUpperCase();
  return upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS' ? 'view' : 'use';
}

export function levelAllows(level: AccessLevel, need: ModuleNeed): boolean {
  if (level === 'full' || level === 'grace') return true;
  return level === 'read_only' && need === 'view';
}

/** Mirrors public.entitlement_level() so the API can explain a level without another query. */
export function entitlementLevel(
  row: { status: string; starts_at: string; ends_at: string | null; grace_days: number } | null | undefined,
  at: Date = new Date(),
): AccessLevel {
  if (!row) return 'none';
  if (row.status !== 'active') return 'read_only';
  if (new Date(row.starts_at) > at) return 'none';
  if (!row.ends_at) return 'full';
  const ends = new Date(row.ends_at);
  if (at <= ends) return 'full';
  const graceEnds = new Date(ends.getTime() + row.grace_days * 24 * 60 * 60 * 1000);
  return at <= graceEnds ? 'grace' : 'read_only';
}

/** A numeric limit for a metric, or null when the entitlement is unlimited for it. */
export function limitFor(limits: unknown, metric: string): number | null {
  if (!limits || typeof limits !== 'object') return null;
  const value = (limits as Record<string, unknown>)[metric];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export interface ModuleDenial {
  code: 'MODULE_NOT_ENTITLED' | 'MODULE_READ_ONLY' | 'MODULE_LIMIT_REACHED';
  module: ModuleKey;
  level: AccessLevel;
  message: string;
  metric?: string;
  limit?: number;
  used?: number;
}

export function denialFor(module: ModuleKey, level: AccessLevel, moduleName: string): ModuleDenial {
  if (level === 'read_only') {
    return {
      code: 'MODULE_READ_ONLY',
      module,
      level,
      message: `${moduleName} is read-only for your organisation because its subscription has ended. Existing data is still available; renew to run new actions.`,
    };
  }
  return {
    code: 'MODULE_NOT_ENTITLED',
    module,
    level,
    message: `${moduleName} is not included in your organisation's plan. Contact your administrator to add it.`,
  };
}

export const MODULE_NAMES: Record<ModuleKey, string> = {
  'ai-builder': 'AI Builder',
  'asset-discovery': 'Asset Discovery',
  'integration-studio': 'Integration Studio',
  'promotional-transfer': 'Promotional Transfer',
  'real-estate': 'Real Estate Network',
};
