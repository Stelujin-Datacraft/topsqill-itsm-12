/**
 * Unit tests for ITAM Discovery persistence-mode selection.
 * No live database — pure env contract checks.
 *
 *   ITAM_DISCOVERY_UNIT_TEST=1 npx tsx test/itam/itam.discovery-persistence-config.test.ts
 */
import {
  assertPostgresUrlForPersistence,
  isDeployedDiscoveryRuntime,
  isDiscoveryUnitTestContext,
  resolveDeploymentEnvironment,
  resolveDiscoveryPersistenceMode,
  shouldApplyDiscoverySchema,
} from '../../src/itam/discovery/persistence-config';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function section(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
}

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void,
) {
  const keys = Object.keys(patch);
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    const v = patch[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

async function main() {
  console.log('ITAM discovery persistence config');

  section('ENVIRONMENT distinguishes Dev vs Prod; NODE_ENV alone is packaging', () => {
    withEnv(
      { ENVIRONMENT: 'development', NODE_ENV: 'production', APP_ENV: undefined, TOPSQILL_ENV: undefined },
      () => {
        assert(resolveDeploymentEnvironment() === 'development', 'Dev ENVIRONMENT wins');
        assert(isDeployedDiscoveryRuntime() === true, 'Dev is deployed');
      },
    );
    withEnv(
      { ENVIRONMENT: 'production', NODE_ENV: 'production', APP_ENV: undefined, TOPSQILL_ENV: undefined },
      () => {
        assert(resolveDeploymentEnvironment() === 'production', 'Prod ENVIRONMENT');
        assert(isDeployedDiscoveryRuntime() === true, 'Prod is deployed');
      },
    );
    withEnv(
      { ENVIRONMENT: undefined, APP_ENV: undefined, TOPSQILL_ENV: undefined, NODE_ENV: 'production' },
      () => {
        assert(resolveDeploymentEnvironment() === 'production', 'NODE_ENV=production fallback');
        assert(isDeployedDiscoveryRuntime() === true, 'container without ENVIRONMENT is deployed');
      },
    );
    withEnv(
      { ENVIRONMENT: undefined, APP_ENV: undefined, TOPSQILL_ENV: undefined, NODE_ENV: 'development' },
      () => {
        assert(resolveDeploymentEnvironment() === 'local', 'local non-deployed');
        assert(isDeployedDiscoveryRuntime() === false, 'local not deployed');
      },
    );
  });

  section('deployed Dev/Prod require postgres even if memory flags are set', () => {
    withEnv(
      {
        ENVIRONMENT: 'development',
        NODE_ENV: 'production',
        ITAM_DISCOVERY_PERSISTENCE: 'memory',
        ITAM_ALLOW_MEMORY_STORE: '1',
        ITAM_DISCOVERY_UNIT_TEST: undefined,
        ITAM_DISCOVERY_DATABASE_URL: undefined,
        ITAM_DATABASE_URL: undefined,
      },
      () => {
        assert(resolveDiscoveryPersistenceMode() === 'postgres', 'Dev ignores memory flags');
        let threw = false;
        try {
          resolveDiscoveryPersistenceMode(process.env, { mode: 'memory' });
        } catch (e: any) {
          threw = /forbidden|Dev\/Prod/i.test(String(e?.message || e));
        }
        assert(threw, 'explicit memory mode rejected on Dev');
      },
    );
    withEnv(
      {
        ENVIRONMENT: 'production',
        NODE_ENV: 'production',
        ITAM_DISCOVERY_PERSISTENCE: 'memory',
        ITAM_ALLOW_MEMORY_STORE: '1',
        ITAM_DISCOVERY_UNIT_TEST: '1',
        ITAM_DISCOVERY_DATABASE_URL: undefined,
      },
      () => {
        assert(resolveDiscoveryPersistenceMode() === 'postgres', 'Prod ignores UNIT_TEST + memory');
        let threw = false;
        try {
          resolveDiscoveryPersistenceMode(process.env, { mode: 'memory' });
        } catch {
          threw = true;
        }
        assert(threw, 'explicit memory mode rejected on Prod even with UNIT_TEST');
      },
    );
  });

  section('missing database URL fails closed for deployed postgres', () => {
    withEnv(
      {
        ENVIRONMENT: 'development',
        NODE_ENV: 'production',
        ITAM_DISCOVERY_DATABASE_URL: undefined,
        ITAM_DATABASE_URL: undefined,
      },
      () => {
        let threw = false;
        try {
          assertPostgresUrlForPersistence();
        } catch (e: any) {
          threw = /ITAM_DISCOVERY_DATABASE_URL is required/i.test(String(e?.message || e));
        }
        assert(threw, 'missing URL throws');
      },
    );
  });

  section('memory allowed only with ITAM_DISCOVERY_UNIT_TEST=1 outside deployed envs', () => {
    withEnv(
      {
        ENVIRONMENT: undefined,
        APP_ENV: undefined,
        TOPSQILL_ENV: undefined,
        NODE_ENV: 'test',
        ITAM_DISCOVERY_UNIT_TEST: '1',
        ITAM_DISCOVERY_PERSISTENCE: 'memory',
        ITAM_DISCOVERY_DATABASE_URL: undefined,
      },
      () => {
        assert(isDiscoveryUnitTestContext() === true, 'unit test flag');
        assert(resolveDiscoveryPersistenceMode() === 'memory', 'memory ok in unit test');
        assert(
          resolveDiscoveryPersistenceMode(process.env, { mode: 'memory' }) === 'memory',
          'explicit memory ok in unit test',
        );
      },
    );
    withEnv(
      {
        ENVIRONMENT: undefined,
        APP_ENV: undefined,
        TOPSQILL_ENV: undefined,
        NODE_ENV: 'development',
        ITAM_DISCOVERY_UNIT_TEST: undefined,
        ITAM_DISCOVERY_PERSISTENCE: 'memory',
        ITAM_DISCOVERY_DATABASE_URL: undefined,
      },
      () => {
        let threw = false;
        try {
          resolveDiscoveryPersistenceMode();
        } catch (e: any) {
          threw = /ITAM_DISCOVERY_UNIT_TEST=1/i.test(String(e?.message || e));
        }
        assert(threw, 'memory without unit-test flag rejected');
      },
    );
  });

  section('schema apply defaults off; opt-in with ITAM_DISCOVERY_APPLY_SCHEMA=1', () => {
    withEnv(
      { ENVIRONMENT: 'development', NODE_ENV: 'production', ITAM_DISCOVERY_APPLY_SCHEMA: undefined },
      () => assert(shouldApplyDiscoverySchema() === false, 'default off on Dev'),
    );
    withEnv(
      { ENVIRONMENT: 'production', ITAM_DISCOVERY_APPLY_SCHEMA: '0' },
      () => assert(shouldApplyDiscoverySchema() === false, 'explicit 0'),
    );
    withEnv(
      { ENVIRONMENT: 'production', ITAM_DISCOVERY_APPLY_SCHEMA: '1' },
      () => assert(shouldApplyDiscoverySchema() === true, 'explicit 1'),
    );
  });

  section('postgres URL present selects postgres on local', () => {
    withEnv(
      {
        ENVIRONMENT: undefined,
        APP_ENV: undefined,
        TOPSQILL_ENV: undefined,
        NODE_ENV: 'development',
        ITAM_DISCOVERY_UNIT_TEST: undefined,
        ITAM_DISCOVERY_PERSISTENCE: undefined,
        ITAM_DISCOVERY_DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/itam',
      },
      () => {
        assert(resolveDiscoveryPersistenceMode() === 'postgres', 'URL implies postgres');
        assert(
          assertPostgresUrlForPersistence().includes('127.0.0.1'),
          'returns URL',
        );
      },
    );
  });

  console.log('All ITAM discovery persistence-config tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
