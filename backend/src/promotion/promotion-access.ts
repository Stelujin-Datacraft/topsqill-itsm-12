/**
 * Runtime access policy for Promotional Transfer.
 *
 * Dev and Prod share the same GitHub repo / codebase but are separate deployments.
 * This module is the single source of truth for:
 *   - detecting the deployment environment
 *   - whether Promotional Transfer is enabled
 *   - enforcing Dev → Prod only (never Prod → Dev)
 *
 * Environment variables (backend):
 *   ENVIRONMENT | APP_ENV     — "development" | "production" (preferred)
 *   NODE_ENV                  — fallback when ENVIRONMENT unset
 *   PROMOTIONAL_TRANSFER_ENABLED — "true" | "false" (optional explicit override)
 *
 * Defaults (fail closed for production):
 *   development → enabled unless PROMOTIONAL_TRANSFER_ENABLED=false
 *   production  → disabled unless PROMOTIONAL_TRANSFER_ENABLED=true
 */

export type AppRuntimeEnvironment = 'development' | 'production';

export interface PromotionAccessState {
  environment: AppRuntimeEnvironment;
  enabled: boolean;
  sourceKey: string;
  targetKey: string;
  reason: string;
}

function normalizeEnv(raw: string | undefined | null): AppRuntimeEnvironment | null {
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

export function resolveAppEnvironment(env: NodeJS.ProcessEnv = process.env): AppRuntimeEnvironment {
  const explicit =
    normalizeEnv(env.ENVIRONMENT) ||
    normalizeEnv(env.APP_ENV) ||
    normalizeEnv(env.TOPSQILL_ENV);
  if (explicit) return explicit;
  // Fallback: Node convention. Deployed services often set NODE_ENV=production
  // even for a Dev deployment — prefer setting ENVIRONMENT explicitly.
  return env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function isPromotionalTransferEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = parseBoolFlag(env.PROMOTIONAL_TRANSFER_ENABLED);
  if (flag !== null) return flag;
  return resolveAppEnvironment(env) === 'development';
}

export function getPromotionAccessState(
  env: NodeJS.ProcessEnv = process.env,
  opts?: { sourceKey?: string; targetKey?: string },
): PromotionAccessState {
  const environment = resolveAppEnvironment(env);
  const enabled = isPromotionalTransferEnabled(env);
  const sourceKey = opts?.sourceKey || env.PROMOTION_SOURCE_KEY || 'TopsqillITSM_Dev';
  const targetKey = opts?.targetKey || env.PROMOTION_TARGET_KEY || 'TopsqillITSM_Prod';

  let reason: string;
  if (!enabled) {
    reason =
      environment === 'production'
        ? 'Promotional Transfer is disabled in the Production deployment'
        : 'Promotional Transfer is disabled by PROMOTIONAL_TRANSFER_ENABLED';
  } else if (environment !== 'development') {
    reason = 'Promotional Transfer may only run in the Development deployment';
  } else {
    reason = 'Promotional Transfer is enabled (Dev → Prod only)';
  }

  return { environment, enabled, sourceKey, targetKey, reason };
}

/**
 * Hard gate used by Nest handlers.
 * Throws a plain Error with a stable message; callers map to ForbiddenException.
 */
export function assertPromotionalTransferAllowed(
  env: NodeJS.ProcessEnv = process.env,
  opts?: { sourceKey?: string; targetKey?: string },
): PromotionAccessState {
  const state = getPromotionAccessState(env, opts);

  if (state.environment !== 'development') {
    throw new Error(
      'Promotional Transfer is only available in the Development environment. This deployment is Production.',
    );
  }

  if (!state.enabled) {
    throw new Error('Promotional Transfer is disabled in this deployment.');
  }

  // Direction lock: source must be Dev, target must be Prod (config keys).
  const source = state.sourceKey.toLowerCase();
  const target = state.targetKey.toLowerCase();
  const sourceLooksDev = source.includes('dev');
  const targetLooksProd = target.includes('prod');
  if (!sourceLooksDev || !targetLooksProd) {
    throw new Error(
      `Invalid promotion direction: source="${state.sourceKey}" target="${state.targetKey}". Only Dev → Prod is allowed.`,
    );
  }

  return state;
}
