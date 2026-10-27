/**
 * Runtime access policy for Real Estate Lead Gen.
 *
 * Fail closed on Production unless explicitly enabled.
 *
 *   RE_LEADGEN_ENABLED — "true" | "false" (optional override)
 *   ENVIRONMENT | APP_ENV — "development" | "production"
 *
 * Defaults:
 *   development → enabled unless RE_LEADGEN_ENABLED=false
 *   production  → disabled unless RE_LEADGEN_ENABLED=true
 */

export type ReAppEnvironment = 'development' | 'production';

export interface ReAccessState {
  environment: ReAppEnvironment;
  enabled: boolean;
  reason: string;
}

function normalizeEnv(raw: string | undefined | null): ReAppEnvironment | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'development' || v === 'dev') return 'development';
  if (v === 'production' || v === 'prod') return 'production';
  return null;
}

function parseBoolFlag(raw: string | undefined | null): boolean | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return null;
}

export function resolveReEnvironment(env: NodeJS.ProcessEnv = process.env): ReAppEnvironment {
  const explicit =
    normalizeEnv(env.ENVIRONMENT) ||
    normalizeEnv(env.APP_ENV) ||
    normalizeEnv(env.TOPSQILL_ENV);
  if (explicit) return explicit;
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function isReLeadgenEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = parseBoolFlag(env.RE_LEADGEN_ENABLED);
  if (flag !== null) return flag;
  return resolveReEnvironment(env) === 'development';
}

export function getReAccessState(env: NodeJS.ProcessEnv = process.env): ReAccessState {
  const environment = resolveReEnvironment(env);
  const enabled = isReLeadgenEnabled(env);
  let reason: string;
  if (!enabled) {
    reason =
      environment === 'production'
        ? 'Real Estate Lead Gen is disabled in the Production deployment'
        : 'Real Estate Lead Gen is disabled by RE_LEADGEN_ENABLED';
  } else {
    reason = 'Real Estate Lead Gen is enabled';
  }
  return { environment, enabled, reason };
}

export function assertReLeadgenAllowed(env: NodeJS.ProcessEnv = process.env): ReAccessState {
  const state = getReAccessState(env);
  if (!state.enabled) {
    throw new Error(state.reason);
  }
  return state;
}
