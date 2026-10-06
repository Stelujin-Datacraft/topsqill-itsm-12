/**
 * Frontend Promotional Transfer feature gate.
 *
 * Dev and Prod share the same GitHub repo but are separate deployments.
 * UI visibility is controlled by Vite env vars baked per deployment:
 *
 *   VITE_ENVIRONMENT=development|production
 *   VITE_PROMOTIONAL_TRANSFER_ENABLED=true|false
 *
 * Fail closed: production builds hide the module unless explicitly enabled
 * for a Development deployment.
 *
 * This is NOT sufficient alone — Nest also rejects /api/promotion/* in Prod.
 */

export type FrontendAppEnvironment = 'development' | 'production';

function normalizeEnv(raw: unknown): FrontendAppEnvironment | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'development' || v === 'dev') return 'development';
  if (v === 'production' || v === 'prod') return 'production';
  return null;
}

function parseFlag(raw: unknown): boolean | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return null;
}

export function resolveFrontendEnvironment(): FrontendAppEnvironment {
  const explicit =
    normalizeEnv(import.meta.env.VITE_ENVIRONMENT) ||
    normalizeEnv(import.meta.env.VITE_APP_ENV);
  if (explicit) return explicit;
  // Vite local dev server → development. Production *builds* are fail-closed
  // unless VITE_ENVIRONMENT=development is set on the Dev deployment.
  return import.meta.env.DEV ? 'development' : 'production';
}

/** Client-side gate for nav/routes. Prefer pairing with /api/promotion/availability. */
export function isPromotionalTransferUiEnabled(): boolean {
  const flag = parseFlag(import.meta.env.VITE_PROMOTIONAL_TRANSFER_ENABLED);
  if (flag !== null) return flag;
  return resolveFrontendEnvironment() === 'development';
}
