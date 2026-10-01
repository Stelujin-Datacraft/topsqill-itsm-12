/**
 * Pilot environment configuration — explicit DEV/TEST/UAT/PROD separation.
 * Fail closed when environment cannot be determined or production is targeted
 * by pilot/destructive tests.
 */
export type PilotEnvironmentName = 'DEV' | 'TEST' | 'UAT' | 'PROD';

export interface TopSqillApiConfig {
  environment: PilotEnvironmentName;
  baseUrl: string;
  /** Supabase project host (never log keys) */
  supabaseUrl: string;
  tenantId?: string;
  organizationId?: string;
  applicationId?: string;
  formId?: string;
  formName?: string;
  /** SecretProvider / env reference names — not secret values */
  credentialReferences: {
    anonKeyEnv: string;
    serviceRoleKeyEnv: string;
  };
  apiScopes: string[];
}

export interface ThirdPartySandboxConfig {
  environment: PilotEnvironmentName;
  providerName: string;
  baseUrl: string;
  apiVersion?: string;
  authType: 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC' | 'OAUTH2';
  credentialReferenceId?: string;
  openApiUrl?: string;
  pagination?: { style: 'offset' | 'cursor' | 'page'; limitParam?: string };
  rateLimitPerMinute?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface PilotRuntimeConfig {
  environment: PilotEnvironmentName;
  recordPrefix: string;
  topsqill: TopSqillApiConfig;
  thirdParty?: ThirdPartySandboxConfig;
  redisUrl?: string;
  oidc?: {
    issuer: string;
    clientId: string;
    clientSecretRef: string;
    redirectUri: string;
  };
  allowDestructivePilot: boolean;
}

const ALLOWED_PILOT_ENVS: PilotEnvironmentName[] = ['DEV', 'TEST', 'UAT'];

export function resolvePilotEnvironment(raw?: string): PilotEnvironmentName {
  const v = String(raw || process.env.VIS_PILOT_ENV || process.env.VIS_ENV || '')
    .trim()
    .toUpperCase();
  if (v === 'DEV' || v === 'TEST' || v === 'UAT' || v === 'PROD') return v;
  throw new Error(
    'Pilot environment cannot be determined. Set VIS_PILOT_ENV to DEV|TEST|UAT (PROD rejected for pilot tests).',
  );
}

/** Fail closed for pilot/destructive runs. */
export function assertPilotSafeEnvironment(env?: PilotEnvironmentName): PilotEnvironmentName {
  const resolved = env || resolvePilotEnvironment();
  if (!ALLOWED_PILOT_ENVS.includes(resolved)) {
    throw new Error(`Pilot tests refused: environment=${resolved} is not DEV/TEST/UAT`);
  }
  if (process.env.VIS_PILOT_ALLOW_PROD === '1') {
    throw new Error('VIS_PILOT_ALLOW_PROD is forbidden — pilot must never target production');
  }
  const base = process.env.VIS_PILOT_TOPSQILL_BASE_URL || process.env.SUPABASE_URL || '';
  if (/prod|production/i.test(base) && process.env.VIS_PILOT_FORCE_UNSAFE !== '1') {
    throw new Error('Pilot refused: TopSqill base URL looks like production');
  }
  return resolved;
}

export function loadPilotRuntimeConfig(): PilotRuntimeConfig {
  const environment = assertPilotSafeEnvironment();
  const supabaseUrl = process.env.VIS_PILOT_TOPSQILL_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const topsqillBase =
    process.env.VIS_PILOT_TOPSQILL_BASE_URL
    || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/rest/v1` : '')
    || '';

  const thirdPartyBase = process.env.VIS_PILOT_SOURCE_BASE_URL || '';
  const thirdParty: ThirdPartySandboxConfig | undefined = thirdPartyBase
    ? {
        environment,
        providerName: process.env.VIS_PILOT_SOURCE_PROVIDER || 'generic-rest',
        baseUrl: thirdPartyBase,
        apiVersion: process.env.VIS_PILOT_SOURCE_API_VERSION,
        authType: (process.env.VIS_PILOT_SOURCE_AUTH_TYPE as ThirdPartySandboxConfig['authType']) || 'NONE',
        credentialReferenceId: process.env.VIS_PILOT_SOURCE_CREDENTIAL_REF,
        openApiUrl: process.env.VIS_PILOT_SOURCE_OPENAPI_URL,
        pagination: {
          style: (process.env.VIS_PILOT_SOURCE_PAGINATION as 'offset' | 'cursor' | 'page') || 'offset',
          limitParam: process.env.VIS_PILOT_SOURCE_LIMIT_PARAM || 'limit',
        },
        rateLimitPerMinute: Number(process.env.VIS_PILOT_SOURCE_RATE_LIMIT || 60),
        timeoutMs: Number(process.env.VIS_PILOT_SOURCE_TIMEOUT_MS || 15000),
      }
    : undefined;

  return {
    environment,
    recordPrefix: process.env.VIS_PILOT_RECORD_PREFIX || 'VIS-PILOT-',
    topsqill: {
      environment,
      baseUrl: topsqillBase,
      supabaseUrl,
      tenantId: process.env.VIS_PILOT_TOPSQILL_TENANT_ID,
      organizationId: process.env.VIS_PILOT_TOPSQILL_ORG_ID,
      applicationId: process.env.VIS_PILOT_TOPSQILL_APP_ID,
      formId: process.env.VIS_PILOT_TOPSQILL_FORM_ID,
      formName: process.env.VIS_PILOT_TOPSQILL_FORM_NAME || 'VIS Integration Test Form',
      credentialReferences: {
        anonKeyEnv: 'SUPABASE_ANON_KEY',
        serviceRoleKeyEnv: 'SUPABASE_SERVICE_ROLE_KEY',
      },
      apiScopes: ['forms:read', 'forms:write', 'submissions:read', 'submissions:write'],
    },
    thirdParty,
    redisUrl: process.env.REDIS_URL || process.env.VIS_REDIS_URL,
    oidc: process.env.VIS_OIDC_ISSUER
      ? {
          issuer: process.env.VIS_OIDC_ISSUER,
          clientId: process.env.VIS_OIDC_CLIENT_ID || '',
          clientSecretRef: process.env.VIS_OIDC_CLIENT_SECRET_REF || 'oidc-client-secret',
          redirectUri: process.env.VIS_OIDC_REDIRECT_URI || 'http://127.0.0.1/callback',
        }
      : undefined,
    allowDestructivePilot: environment !== 'PROD',
  };
}

export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return url.replace(/:\/\/[^/@]+@/g, '://***@');
  }
}
