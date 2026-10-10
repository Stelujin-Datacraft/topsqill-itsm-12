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
} from '../../src/itam/discovery/pg-persistence';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  console.log('ITAM discovery schema guard');

  // normalizeAssetTags
  assert(Object.keys(normalizeAssetTags(null)).length === 0, 'null tags');
  assert(normalizeAssetTags(['env=lab', 'critical'])['env'] === 'lab', 'TEXT[] k=v');
  assert(normalizeAssetTags(['critical'])['critical'] === 'critical', 'TEXT[] bare');
  assert(normalizeAssetTags({ a: '1' }).a === '1', 'object tags');
  console.log('  ✓ normalizeAssetTags');

  // Missing relations → clear fail-closed error (no memory fallback wording)
  const fakeMissing = {
    query: async () => ({ rows: [{ relname: 'it_assets' }, { relname: 'asset_software' }] }),
  };
  let threw = false;
  try {
    await assertRequiredDiscoverySchema(fakeMissing as any);
  } catch (e: any) {
    threw = true;
    const msg = String(e?.message || e);
    assert(/itam_network_scopes/.test(msg), 'mentions missing scope table');
    assert(/20260930120000_itam_network_discovery/.test(msg), 'points at migration file');
    assert(/In-memory persistence is not used/i.test(msg), 'no memory fallback');
    for (const f of ITAM_DISCOVERY_MIGRATION_FILES) {
      assert(msg.includes(f), `mentions ${f}`);
    }
  }
  assert(threw, 'must throw when relations missing');
  console.log('  ✓ assertRequiredDiscoverySchema missing tables');

  // All present → ok
  const fakeOk = {
    query: async () => ({
      rows: REQUIRED_DISCOVERY_RELATIONS.map((relname) => ({ relname })),
    }),
  };
  await assertRequiredDiscoverySchema(fakeOk as any);
  console.log('  ✓ assertRequiredDiscoverySchema complete schema');

  console.log('All ITAM discovery schema-guard tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
