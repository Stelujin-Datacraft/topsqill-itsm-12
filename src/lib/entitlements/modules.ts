export type ModuleKey = 'ai-builder' | 'asset-discovery' | 'integration-studio' | 'promotional-transfer' | 'real-estate';
export type AccessLevel = 'full' | 'grace' | 'read_only' | 'none';

export interface ModuleInfo {
  key: ModuleKey;
  name: string;
  summary: string;
  benefits: string[];
  /** Route prefixes that belong entirely to this module. */
  paths: string[];
  metrics: Record<string, string>;
}

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  'ai-builder': {
    key: 'ai-builder',
    name: 'AI Builder',
    summary: 'Describe what you need and let AI build forms, workflows and reports, plus the AI assistant.',
    benefits: [
      'Generate complete forms and workflows from a sentence',
      'AI assistant that answers questions about your data and setup',
      'Edit and extend everything it builds with the normal builders',
    ],
    paths: ['/build'],
    metrics: { ai_requests: 'AI requests' },
  },
  'asset-discovery': {
    key: 'asset-discovery',
    name: 'Asset Discovery',
    summary: 'Find every device and cloud resource automatically and keep the asset register up to date.',
    benefits: [
      'Network discovery with approved scan scopes',
      'Cloud and VMware discovery',
      'Discovery agents, network intelligence and topology maps',
    ],
    paths: [],
    metrics: { discovery_jobs: 'discovery jobs' },
  },
  'integration-studio': {
    key: 'integration-studio',
    name: 'Integration Studio',
    summary: 'Connect Topsqill to external systems with managed connectors.',
    benefits: ['Describe an integration and generate it', 'Managed connections and credentials', 'Execution history and monitoring'],
    paths: ['/vis'],
    metrics: {},
  },
  'promotional-transfer': {
    key: 'promotional-transfer',
    name: 'Promotional Transfer',
    summary: 'Promote forms, workflows and reports from Dev to Prod safely.',
    benefits: ['Package configuration changes', 'Conflict detection before promotion', 'Full promotion history'],
    paths: ['/promotional-transfer'],
    metrics: {},
  },
  'real-estate': {
    key: 'real-estate',
    name: 'Real Estate Network',
    summary: 'Real estate lead generation, listings and network.',
    benefits: ['Lead capture and enrichment', 'Listings and properties', 'Professional network and messaging'],
    paths: ['/re'],
    metrics: {},
  },
};

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/** IT Assets tabs that belong to Asset Discovery; the rest of IT Assets is core. */
export const ASSET_DISCOVERY_TABS = ['discovery', 'cloud', 'intelligence', 'topology', 'agents'] as const;

export function moduleForPath(pathname: string): ModuleKey | null {
  for (const info of Object.values(MODULES)) {
    if (info.paths.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return info.key;
  }
  return null;
}

export function canView(level: AccessLevel | undefined): boolean {
  return level === 'full' || level === 'grace' || level === 'read_only';
}

export function canUse(level: AccessLevel | undefined): boolean {
  return level === 'full' || level === 'grace';
}

export interface ModuleAccess {
  module: ModuleKey;
  name: string;
  level: AccessLevel;
  source: string | null;
  endsAt: string | null;
  graceDays: number | null;
  limits: Record<string, number>;
}

export interface EntitlementsSnapshot {
  organizationId: string | null;
  enforced: boolean;
  modules: Record<ModuleKey, ModuleAccess>;
  usage: Record<string, Record<string, number>>;
  isPlatformAdmin: boolean;
}

/** Used until the server answers, and when the server predates entitlements: never lock the UI. */
export function openSnapshot(): EntitlementsSnapshot {
  const modules = {} as Record<ModuleKey, ModuleAccess>;
  for (const key of MODULE_KEYS) {
    modules[key] = { module: key, name: MODULES[key].name, level: 'full', source: null, endsAt: null, graceDays: null, limits: {} };
  }
  return { organizationId: null, enforced: false, modules, usage: {}, isPlatformAdmin: false };
}

export interface UsageLine {
  metric: string;
  label: string;
  used: number;
  limit: number | null;
  ratio: number | null;
}

export function usageLines(snapshot: EntitlementsSnapshot, module: ModuleKey): UsageLine[] {
  const info = MODULES[module];
  const limits = snapshot.modules[module]?.limits || {};
  const used = snapshot.usage[module] || {};
  const metrics = new Set([...Object.keys(info.metrics), ...Object.keys(limits)]);
  return [...metrics].map((metric) => {
    const limit = typeof limits[metric] === 'number' ? limits[metric] : null;
    const value = used[metric] || 0;
    return {
      metric,
      label: info.metrics[metric] || metric.replace(/_/g, ' '),
      used: value,
      limit,
      ratio: limit ? value / limit : null,
    };
  });
}

/** Days until the paid period ends (negative once it has ended), or null when open-ended. */
export function daysUntil(endsAt: string | null, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function moduleBanner(snapshot: EntitlementsSnapshot, module: ModuleKey): { tone: 'warning' | 'info'; title: string; text: string } | null {
  const access = snapshot.modules[module];
  if (!access) return null;
  const name = MODULES[module].name;
  if (access.level === 'read_only') {
    return {
      tone: 'warning',
      title: `${name} is read-only`,
      text: 'The subscription for this module has ended. Existing data is still available, but nothing new can be started until it is renewed.',
    };
  }
  if (access.level === 'grace') {
    const graceLeft = (daysUntil(access.endsAt) ?? 0) + (access.graceDays ?? 0);
    return {
      tone: 'warning',
      title: `${name} subscription has ended`,
      text: `Everything keeps working for ${Math.max(graceLeft, 0)} more day(s). Renew to avoid the module becoming read-only.`,
    };
  }
  const nearLimit = usageLines(snapshot, module).find((line) => line.ratio !== null && line.ratio >= 0.8);
  if (nearLimit) {
    return {
      tone: 'info',
      title: `${name} usage`,
      text: `${nearLimit.used} of ${nearLimit.limit} ${nearLimit.label} used this month.`,
    };
  }
  const left = daysUntil(access.endsAt);
  if (left !== null && left <= 14 && left >= 0) {
    return { tone: 'info', title: `${name} renews soon`, text: `The current period ends in ${left} day(s).` };
  }
  return null;
}
