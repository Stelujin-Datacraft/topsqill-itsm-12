import { BadRequestException } from '@nestjs/common';
import { isModuleKey, type ModuleKey } from './module-catalog';

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'expired', 'cancelled'] as const;
export const ENTITLEMENT_SOURCES = ['plan', 'add_on', 'trial', 'manual'] as const;
export const ENTITLEMENT_STATUSES = ['active', 'suspended'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLAN_KEY = /^[a-z][a-z0-9-]{1,48}$/;

function fail(message: string): never {
  throw new BadRequestException(message);
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) fail(`${field} must be a UUID`);
  return value;
}

export function requireModule(value: unknown): ModuleKey {
  if (!isModuleKey(value)) fail(`Unknown module "${String(value)}"`);
  return value;
}

export function requireReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length < 3) fail('A reason is required for the audit log');
  if (reason.length > 500) fail('Keep the reason under 500 characters');
  return reason;
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) fail(`${field} must be a date`);
  return date.toISOString();
}

function graceDays(value: unknown): number {
  if (value === undefined || value === null || value === '') return 14;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 0 || days > 365) fail('graceDays must be a whole number from 0 to 365');
  return days;
}

/** Limits are metric -> non-negative whole number; an absent metric means unlimited. */
export function parseLimits(value: unknown): Record<string, number> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail('limits must be an object of metric: number');
  const limits: Record<string, number> = {};
  for (const [metric, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_]{1,48}$/.test(metric)) fail(`Invalid metric name "${metric}"`);
    if (raw === null || raw === '') continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) fail(`Limit for ${metric} must be a whole number of 0 or more`);
    limits[metric] = n;
  }
  return limits;
}

export function parseApplyPlan(body: Record<string, unknown>) {
  const planKey = String(body.planKey || '');
  if (!PLAN_KEY.test(planKey)) fail('planKey is required');
  const status = String(body.status || 'active');
  if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) fail(`status must be one of ${SUBSCRIPTION_STATUSES.join(', ')}`);
  return {
    planKey,
    status,
    periodEnd: optionalDate(body.periodEnd, 'periodEnd'),
    graceDays: graceDays(body.graceDays),
    reason: requireReason(body.reason),
  };
}

export function parseSetEntitlement(body: Record<string, unknown>) {
  const source = String(body.source || 'add_on');
  if (!(ENTITLEMENT_SOURCES as readonly string[]).includes(source)) fail(`source must be one of ${ENTITLEMENT_SOURCES.join(', ')}`);
  const status = String(body.status || 'active');
  if (!(ENTITLEMENT_STATUSES as readonly string[]).includes(status)) fail(`status must be one of ${ENTITLEMENT_STATUSES.join(', ')}`);
  return {
    source,
    status,
    endsAt: optionalDate(body.endsAt, 'endsAt'),
    graceDays: graceDays(body.graceDays),
    limits: parseLimits(body.limits),
    reason: requireReason(body.reason),
  };
}

export function parsePlan(key: string, body: Record<string, unknown>) {
  if (!PLAN_KEY.test(key)) fail('Plan key must be lowercase letters, numbers and dashes');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) fail('Plan name is required');
  const modules = Array.isArray(body.modules) ? body.modules.map(requireModule) : fail('modules must be a list');
  const limits: Record<string, Record<string, number>> = {};
  if (body.limits && typeof body.limits === 'object') {
    for (const [module, moduleLimits] of Object.entries(body.limits as Record<string, unknown>)) {
      limits[requireModule(module)] = parseLimits(moduleLimits);
    }
  }
  return {
    key,
    name,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    modules: Array.from(new Set(modules)),
    limits,
    active: body.active !== false,
    reason: requireReason(body.reason),
    applyToSubscribers: body.applyToSubscribers === true,
  };
}
