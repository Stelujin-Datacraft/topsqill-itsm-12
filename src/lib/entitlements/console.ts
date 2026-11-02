import { MODULES, type AccessLevel, type ModuleKey } from './modules';

export interface PlatformModuleRow {
  key: ModuleKey;
  name: string;
  description: string;
  metrics: Record<string, string>;
}

export interface PlatformPlanRow {
  key: string;
  name: string;
  description: string;
  modules: ModuleKey[];
  limits: Record<string, Record<string, number>>;
  is_default: boolean;
  active: boolean;
}

export interface SubscriptionRow {
  organization_id: string;
  plan_key: string;
  status: string;
  current_period_end: string | null;
  grace_days: number;
}

export interface EntitlementRow {
  organization_id: string;
  module_key: ModuleKey;
  source: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  grace_days: number;
  limits: Record<string, number>;
}

export interface UsageRow {
  organization_id: string;
  module_key: ModuleKey;
  metric: string;
  used: number;
}

export interface AuditRow {
  id: number;
  occurred_at: string;
  organization_id: string | null;
  actor_id: string | null;
  actor_source: string;
  action: string;
  module_key: string | null;
  reason: string;
  before_state: unknown;
  after_state: unknown;
}

export interface PlatformOverview {
  modules: PlatformModuleRow[];
  plans: PlatformPlanRow[];
  organizations: { id: string; name: string; status?: string | null }[];
  subscriptions: SubscriptionRow[];
  entitlements: EntitlementRow[];
  usage: UsageRow[];
}

/** Same rule as public.entitlement_level() in the database. */
export function levelOfRow(row: Pick<EntitlementRow, 'status' | 'starts_at' | 'ends_at' | 'grace_days'> | undefined, at: Date = new Date()): AccessLevel {
  if (!row) return 'none';
  if (row.status !== 'active') return 'read_only';
  if (new Date(row.starts_at) > at) return 'none';
  if (!row.ends_at) return 'full';
  const ends = new Date(row.ends_at).getTime();
  if (at.getTime() <= ends) return 'full';
  return at.getTime() <= ends + row.grace_days * 86_400_000 ? 'grace' : 'read_only';
}

export const LEVEL_LABEL: Record<AccessLevel, string> = {
  full: 'Active',
  grace: 'Grace period',
  read_only: 'Read-only',
  none: 'Not included',
};

export const SOURCE_LABEL: Record<string, string> = {
  plan: 'Plan',
  add_on: 'Add-on',
  trial: 'Trial',
  manual: 'Manual grant',
  legacy: 'Existing customer',
};

export interface OrgSummary {
  id: string;
  name: string;
  subscription: SubscriptionRow | null;
  planName: string;
  modules: { key: ModuleKey; name: string; level: AccessLevel; entitlement?: EntitlementRow; usage: Record<string, number> }[];
}

export function summarizeOrgs(overview: PlatformOverview, at: Date = new Date()): OrgSummary[] {
  const plans = new Map(overview.plans.map((plan) => [plan.key, plan]));
  const subs = new Map(overview.subscriptions.map((sub) => [sub.organization_id, sub]));
  const moduleKeys = (overview.modules.length ? overview.modules.map((m) => m.key) : (Object.keys(MODULES) as ModuleKey[]));
  return overview.organizations.map((org) => {
    const subscription = subs.get(org.id) || null;
    return {
      id: org.id,
      name: org.name,
      subscription,
      planName: subscription ? plans.get(subscription.plan_key)?.name || subscription.plan_key : 'No plan',
      modules: moduleKeys.map((key) => {
        const entitlement = overview.entitlements.find((e) => e.organization_id === org.id && e.module_key === key);
        const usage: Record<string, number> = {};
        for (const row of overview.usage) {
          if (row.organization_id === org.id && row.module_key === key) usage[row.metric] = Number(row.used);
        }
        return { key, name: MODULES[key]?.name || key, level: levelOfRow(entitlement, at), entitlement, usage };
      }),
    };
  });
}

/** Form text inputs to a limits object; blank means unlimited. */
export function limitsFromInputs(inputs: Record<string, string>): { limits: Record<string, number>; error: string | null } {
  const limits: Record<string, number> = {};
  for (const [metric, raw] of Object.entries(inputs)) {
    const text = raw.trim();
    if (!text) continue;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 0) return { limits, error: `Limit for ${metric.replace(/_/g, ' ')} must be a whole number of 0 or more` };
    limits[metric] = value;
  }
  return { limits, error: null };
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function auditToCsv(rows: AuditRow[], orgNames: Record<string, string> = {}): string {
  const header = ['time', 'organisation', 'action', 'module', 'actor', 'source', 'reason', 'before', 'after'];
  const lines = rows.map((row) =>
    [
      row.occurred_at,
      row.organization_id ? orgNames[row.organization_id] || row.organization_id : '',
      row.action,
      row.module_key || '',
      row.actor_id || '',
      row.actor_source,
      row.reason,
      row.before_state,
      row.after_state,
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function describeAudit(row: AuditRow): string {
  const [table, op] = row.action.split('.');
  if (row.action === 'access_denied') return `Access denied${row.module_key ? ` to ${MODULES[row.module_key as ModuleKey]?.name || row.module_key}` : ''}`;
  const subject = table === 'org_subscriptions' ? 'Subscription' : table === 'platform_plans' ? 'Plan' : table === 'org_entitlements' ? (MODULES[row.module_key as ModuleKey]?.name || row.module_key || 'Module') : row.action;
  const verb = op === 'insert' ? 'added' : op === 'delete' ? 'removed' : op === 'update' ? 'changed' : '';
  return verb ? `${subject} ${verb}` : subject;
}
