export type RegulatoryFrontendEnvironment = 'development' | 'production';

function normalizeEnv(raw: unknown): RegulatoryFrontendEnvironment | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (value === 'development' || value === 'dev') return 'development';
  if (value === 'production' || value === 'prod') return 'production';
  return null;
}

function parseFlag(raw: unknown): boolean | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return null;
}

export function isRegulatoryUiEnabled(): boolean {
  const flag = parseFlag(import.meta.env.VITE_REGULATORY_ENABLED);
  if (flag !== null) return flag;
  const explicit =
    normalizeEnv(import.meta.env.VITE_ENVIRONMENT) ||
    normalizeEnv(import.meta.env.VITE_APP_ENV);
  if (explicit) return explicit === 'development';
  return Boolean(import.meta.env.DEV);
}
