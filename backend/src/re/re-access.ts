/**
 * Runtime access policy for Real Estate Lead Gen.
 *
 * Fail closed on Production unless explicitly enabled.
 *
 *   RE_LEADGEN_ENABLED — master switch
 *   RE_LEADGEN_META_ENRICH — Meta Graph enrichment jobs
 *   RE_LEADGEN_DEDUPE — phone/email de-dupe + re-enquiry
 *   RE_NETWORK_ENABLED — social feed / connections / messaging shell
 *
 * Defaults (all):
 *   development → enabled unless flag=false
 *   production  → disabled unless flag=true
 */

export type ReAppEnvironment = 'development' | 'production';

export interface ReAccessState {
  environment: ReAppEnvironment;
  enabled: boolean;
  metaEnrichEnabled: boolean;
  dedupeEnabled: boolean;
  networkEnabled: boolean;
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

function flagOrEnvDefault(
  env: NodeJS.ProcessEnv,
  key: string,
  environment: ReAppEnvironment,
): boolean {
  const flag = parseBoolFlag(env[key]);
  if (flag !== null) return flag;
  return environment === 'development';
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
  return flagOrEnvDefault(env, 'RE_LEADGEN_ENABLED', resolveReEnvironment(env));
}

export function isReMetaEnrichEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isReLeadgenEnabled(env)) return false;
  return flagOrEnvDefault(env, 'RE_LEADGEN_META_ENRICH', resolveReEnvironment(env));
}

export function isReDedupeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isReLeadgenEnabled(env)) return false;
  return flagOrEnvDefault(env, 'RE_LEADGEN_DEDUPE', resolveReEnvironment(env));
}

export function isReNetworkEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isReLeadgenEnabled(env)) return false;
  return flagOrEnvDefault(env, 'RE_NETWORK_ENABLED', resolveReEnvironment(env));
}

export function getReAccessState(env: NodeJS.ProcessEnv = process.env): ReAccessState {
  const environment = resolveReEnvironment(env);
  const enabled = isReLeadgenEnabled(env);
  const metaEnrichEnabled = isReMetaEnrichEnabled(env);
  const dedupeEnabled = isReDedupeEnabled(env);
  const networkEnabled = isReNetworkEnabled(env);
  let reason: string;
  if (!enabled) {
    reason =
      environment === 'production'
        ? 'Real Estate Lead Gen is disabled in the Production deployment'
        : 'Real Estate Lead Gen is disabled by RE_LEADGEN_ENABLED';
  } else {
    reason = 'Real Estate Lead Gen is enabled';
  }
  return { environment, enabled, metaEnrichEnabled, dedupeEnabled, networkEnabled, reason };
}

export function assertReLeadgenAllowed(env: NodeJS.ProcessEnv = process.env): ReAccessState {
  const state = getReAccessState(env);
  if (!state.enabled) {
    throw new Error(state.reason);
  }
  return state;
}
