/**
 * Frontend Real Estate Lead Gen feature gate.
 *
 *   VITE_ENVIRONMENT=development|production
 *   VITE_RE_LEADGEN_ENABLED=true|false
 *
 * Fail closed: production builds hide the module unless explicitly enabled.
 */

export type ReFrontendEnvironment = 'development' | 'production';

function normalizeEnv(raw: unknown): ReFrontendEnvironment | null {
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

export function resolveReFrontendEnvironment(): ReFrontendEnvironment {
  const explicit =
    normalizeEnv(import.meta.env.VITE_ENVIRONMENT) ||
    normalizeEnv(import.meta.env.VITE_APP_ENV);
  if (explicit) return explicit;
  return import.meta.env.DEV ? 'development' : 'production';
}

/** Client-side gate for nav/routes. Pair with GET /api/re/availability. */
export function isReLeadgenUiEnabled(): boolean {
  const flag = parseFlag(import.meta.env.VITE_RE_LEADGEN_ENABLED);
  if (flag !== null) return flag;
  return resolveReFrontendEnvironment() === 'development';
}
