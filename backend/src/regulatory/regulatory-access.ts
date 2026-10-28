/**
 * Regulatory compliance module gate.
 * Fail closed on production unless REGULATORY_ENABLED=true.
 * Development is on unless the flag is explicitly false.
 */

export type RegulatoryEnvironment = 'development' | 'production';

export interface RegulatoryAccessState {
  environment: RegulatoryEnvironment;
  enabled: boolean;
  reason: string;
}

function normalizeEnv(raw: string | undefined | null): RegulatoryEnvironment | null {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'development' || value === 'dev') return 'development';
  if (value === 'production' || value === 'prod') return 'production';
  return null;
}

function parseBoolFlag(raw: string | undefined | null): boolean | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return null;
}

export function resolveRegulatoryEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): RegulatoryEnvironment {
  const explicit =
    normalizeEnv(env.ENVIRONMENT) ||
    normalizeEnv(env.APP_ENV) ||
    normalizeEnv(env.TOPSQILL_ENV);
  if (explicit) return explicit;
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function getRegulatoryAccessState(
  env: NodeJS.ProcessEnv = process.env,
): RegulatoryAccessState {
  const environment = resolveRegulatoryEnvironment(env);
  const flag = parseBoolFlag(env.REGULATORY_ENABLED);
  const enabled = flag === null ? environment === 'development' : flag;
  return {
    environment,
    enabled,
    reason: enabled
      ? `Regulatory compliance is enabled (${environment}).`
      : 'Regulatory compliance is disabled. Set REGULATORY_ENABLED=true to enable it in this environment.',
  };
}

export function isRegulatoryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getRegulatoryAccessState(env).enabled;
}
