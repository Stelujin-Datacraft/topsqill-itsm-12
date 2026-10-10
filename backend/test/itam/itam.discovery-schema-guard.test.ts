/**
 * Unit tests for ITAM Discovery schema presence guard (no live DB).
 *
 *   ITAM_DISCOVERY_UNIT_TEST=1 npx tsx test/itam/itam.discovery-schema-guard.test.ts
 */
import {
  assertRequiredDiscoverySchema,
  ITAM_DISCOVERY_MIGRATION_FILES,
  REQUIRED_DISCOVERY_RELATIONS,
  normalizeAssetTags,
  ItamDiscoverySchemaMissingError,
  isItamDiscoverySchemaMissingError,
} from '../../src/itam/discovery/pg-persistence';
import { ITAM_DISCOVERY_APPLY_ORDER } from '../../src/itam/discovery/schema-missing.error';
import { ItamDiscoveryService } from '../../src/itam/discovery/discovery.service';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  console.log('ITAM discovery schema guard');

  assert(Object.keys(normalizeAssetTags(null)).length === 0, 'null tags');
  assert(normalizeAssetTags(['env=lab', 'critical'])['env'] === 'lab', 'TEXT[] k=v');
  console.log('  ✓ normalizeAssetTags');

  assert(
    ITAM_DISCOVERY_APPLY_ORDER[0].includes('20260930110000'),
    'apply order starts with helper migration',
  );
  assert(
    ITAM_DISCOVERY_MIGRATION_FILES.includes('supabase/migrations/20260930120000_itam_network_discovery.sql' as any),
    'includes network discovery migration',
  );
  console.log('  ✓ migration apply order includes helper + ITAM files');

  const fakeMissing = {
    query: async () => ({ rows: [{ relname: 'it_assets' }, { relname: 'asset_software' }] }),
  };
  let threw = false;
  try {
    await assertRequiredDiscoverySchema(fakeMissing as any);
  } catch (e: any) {
    threw = true;
    assert(isItamDiscoverySchemaMissingError(e), 'typed schema-missing error');
    assert(e instanceof ItamDiscoverySchemaMissingError, 'instanceof');
    const msg = String(e?.message || e);
    assert(/itam_network_scopes/.test(msg), 'mentions missing scope table');
    assert(/itam_discovered_hosts/.test(msg), 'mentions hosts table (not discovered_assets)');
    assert(/20260930110000_get_current_user_org_id/.test(msg), 'points at helper migration');
    assert(/20260930120000_itam_network_discovery/.test(msg), 'points at discovery migration');
    assert(/In-memory persistence is not used/i.test(msg), 'no memory fallback');
    assert(/ITAM_DISCOVERY_APPLY_SCHEMA=0/.test(msg), 'keeps apply-schema off guidance');
    for (const f of ITAM_DISCOVERY_APPLY_ORDER) {
      assert(msg.includes(f), `mentions ${f}`);
    }
  }
  assert(threw, 'must throw when relations missing');
  console.log('  ✓ assertRequiredDiscoverySchema missing tables');

  const fakeOk = {
    query: async () => ({
      rows: REQUIRED_DISCOVERY_RELATIONS.map((relname) => ({ relname })),
    }),
  };
  await assertRequiredDiscoverySchema(fakeOk as any);
  console.log('  ✓ assertRequiredDiscoverySchema complete schema');

  // Service stays fail-closed without crashing Nest when schema marked unavailable
  const svc = new ItamDiscoveryService();
  const err = new ItamDiscoverySchemaMissingError(['itam_network_scopes', 'itam_discovery_jobs']);
  svc.markSchemaUnavailable(err);
  assert(svc.isSchemaUnavailable(), 'schema unavailable flag');
  assert(svc.persistenceMode() === 'unavailable', 'persistence mode unavailable');
  let apiBlocked = false;
  try {
    svc.listScopes({ userId: 'u', organizationId: 'o', roles: ['admin'] });
  } catch (e: any) {
    apiBlocked = /ITAM_DISCOVERY_SCHEMA_MISSING|unavailable|incomplete/i.test(String(e?.message || e));
  }
  assert(apiBlocked, 'ITAM APIs blocked when schema missing');
  console.log('  ✓ discovery service fail-closed without memory fallback');

  console.log('All ITAM discovery schema-guard tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
