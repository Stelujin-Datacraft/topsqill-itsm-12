/**
 * ITAM Discovery persistence configuration contract.
 *
 * | Variable | Role |
 * |----------|------|
 * | NODE_ENV | Runtime packaging (containers often use `production` even on Dev VMs) |
 * | ENVIRONMENT | Deployment identity: `development` (Dev) \| `production` (Prod) |
 * | ITAM_DISCOVERY_PERSISTENCE | Explicit mode: `postgres` \| `memory` (memory only with unit-test flag) |
 * | ITAM_DISCOVERY_DATABASE_URL | Env-specific Supabase Postgres URI (Dev→Dev, Prod→Prod) |
 * | ITAM_DISCOVERY_APPLY_SCHEMA | Opt-in DDL at boot (`1`/`true`); default off for deployed envs |
 * | ITAM_DISCOVERY_UNIT_TEST | `1` marks an explicit unit-test process (only place memory is allowed) |
 *
 * Rules:
 * - Dev and Prod deployments always require PostgreSQL (no memory, even if
 *   ITAM_ALLOW_MEMORY_STORE=1 or ITAM_DISCOVERY_PERSISTENCE=memory).
 * - Memory is allowed only when ITAM_DISCOVERY_UNIT_TEST=1 and the process is
 *   not a deployed environment.
 * - Do not auto-apply schema against shared Supabase; apply reviewable SQL
 *   (supabase/migrations/2026093012*) manually.
 */

export type DiscoveryPersistenceMode = 'memory' | 'postgres';
export type DeploymentEnvironment = 'development' | 'production' | 'local';

function normalizeDeploymentEnv(raw: string | undefined | null): 'development' | 'production' | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'development' || v === 'dev') return 'development';
  if (v === 'production' || v === 'prod') return 'production';
  return null;
}

function flagTrue(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Prefer ENVIRONMENT / APP_ENV; do not treat NODE_ENV alone as Dev vs Prod. */
export function resolveDeploymentEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): DeploymentEnvironment {
  const explicit =
    normalizeDeploymentEnv(env.ENVIRONMENT)
    || normalizeDeploymentEnv(env.APP_ENV)
    || normalizeDeploymentEnv(env.TOPSQILL_ENV);
  if (explicit) return explicit;
  // Unset ENVIRONMENT on a production-packaged process → treat as deployed Prod
  // (fail closed). Local Nest without ENVIRONMENT stays "local".
  if (env.NODE_ENV === 'production') return 'production';
  return 'local';
}

/**
 * Deployed = Dev VM or Prod (ENVIRONMENT set, or NODE_ENV=production container).
 * Local laptop with NODE_ENV=development and no ENVIRONMENT is not "deployed".
 */
export function isDeployedDiscoveryRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const deployment = resolveDeploymentEnvironment(env);
  if (deployment === 'development' || deployment === 'production') return true;
  // Container-style boot without ENVIRONMENT still must not use memory.
  return env.NODE_ENV === 'production';
}

/** Explicit unit-test harness only (set by test scripts / test files). */
export function isDiscoveryUnitTestContext(env: NodeJS.ProcessEnv = process.env): boolean {
  return flagTrue(env.ITAM_DISCOVERY_UNIT_TEST);
}

export function getItamDiscoveryDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const url = (env.ITAM_DISCOVERY_DATABASE_URL || env.ITAM_DATABASE_URL || '').trim();
  return url || undefined;
}

/**
 * Schema apply is opt-in. Deployed environments default to disabled so Nest
 * never DDL-migrates Dev/Prod Supabase on boot.
 */
export function shouldApplyDiscoverySchema(env: NodeJS.ProcessEnv = process.env): boolean {
  if (flagTrue(env.ITAM_DISCOVERY_APPLY_SCHEMA)) return true;
  const raw = env.ITAM_DISCOVERY_APPLY_SCHEMA;
  if (raw !== undefined && String(raw).trim() !== '') {
    const v = String(raw).trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  }
  return false;
}

export function resolveDiscoveryPersistenceMode(
  env: NodeJS.ProcessEnv = process.env,
  opts?: { mode?: DiscoveryPersistenceMode },
): DiscoveryPersistenceMode {
  if (opts?.mode === 'postgres') return 'postgres';
  if (opts?.mode === 'memory') {
    if (isDeployedDiscoveryRuntime(env)) {
      throw new Error(
        'In-memory ITAM DiscoveryStore is forbidden in Dev/Prod deployments '
          + '(ENVIRONMENT=development|production or NODE_ENV=production). '
          + 'Set ITAM_DISCOVERY_DATABASE_URL to the env-specific Supabase Postgres URI.',
      );
    }
    if (!isDiscoveryUnitTestContext(env)) {
      throw new Error(
        'In-memory ITAM DiscoveryStore is allowed only when ITAM_DISCOVERY_UNIT_TEST=1. '
          + 'Deployed and normal Nest boots require ITAM_DISCOVERY_DATABASE_URL.',
      );
    }
    return 'memory';
  }

  const explicit = String(env.ITAM_DISCOVERY_PERSISTENCE || '').trim().toLowerCase();

  if (isDeployedDiscoveryRuntime(env)) {
    // ITAM_ALLOW_MEMORY_STORE and PERSISTENCE=memory are ignored in Dev/Prod.
    return 'postgres';
  }

  if (explicit === 'memory') {
    if (!isDiscoveryUnitTestContext(env)) {
      throw new Error(
        'ITAM_DISCOVERY_PERSISTENCE=memory requires ITAM_DISCOVERY_UNIT_TEST=1',
      );
    }
    return 'memory';
  }

  if (explicit === 'postgres' || getItamDiscoveryDatabaseUrl(env)) {
    return 'postgres';
  }

  if (isDiscoveryUnitTestContext(env)) {
    return 'memory';
  }

  // Local non-test Nest without a URL: fail closed toward durable config
  // rather than silently losing data on restart.
  return 'postgres';
}

export function assertPostgresUrlForPersistence(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = getItamDiscoveryDatabaseUrl(env);
  if (url) return url;
  const deployment = resolveDeploymentEnvironment(env);
  throw new Error(
    'ITAM_DISCOVERY_DATABASE_URL is required for PostgreSQL discovery persistence '
      + `(deployment=${deployment}, NODE_ENV=${env.NODE_ENV || 'unset'}). `
      + 'Use the Supabase Postgres connection string for this environment only '
      + '(Dev credentials on Dev, Prod credentials on Prod). '
      + 'In-memory store is forbidden outside ITAM_DISCOVERY_UNIT_TEST=1.',
  );
}

/** @deprecated Use resolveDiscoveryPersistenceMode / isDeployedDiscoveryRuntime */
export function isPostgresPersistenceRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return resolveDiscoveryPersistenceMode(env) === 'postgres';
  } catch {
    return true;
  }
}
