/**
 * Frontend-side unit checks for session UUID filter guards.
 * Run: npx tsx src/services/api/databaseClient.session.test.ts
 */
import assert from 'assert';
import { assertFiltersHaveValues, unwrapNestQueryPayload } from '../../utils/databaseQueryGuards';
import { normalizeUserSessionRow } from '../../utils/userSessionRow';

console.log('databaseClient session UUID guards');

{
  const nested = { data: { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', is_active: true }, error: null };
  assert.equal((nested as any).id, undefined);
  const unwrapped = unwrapNestQueryPayload(nested, { maybeSingle: true }) as any;
  assert.equal(unwrapped.id, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  assert.equal(normalizeUserSessionRow(nested)?.id, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  console.log('  ✓ nested envelope yields UUID id');
}

{
  let blocked = false;
  try {
    assertFiltersHaveValues([{ kind: 'filter', column: 'id', operator: 'eq', value: undefined }]);
  } catch (e: any) {
    blocked = /filter value is required/i.test(String(e?.message || e));
  }
  assert.equal(blocked, true);
  const serialized = JSON.stringify({
    filters: [{ kind: 'filter', column: 'id', operator: 'eq', value: undefined }],
  });
  assert.equal(serialized.includes('"value"'), false);
  console.log('  ✓ missing filter value blocked before POST');
}

{
  assert.equal(normalizeUserSessionRow({ id: 'undefined', is_active: true }), null);
  console.log('  ✓ literal "undefined" id rejected');
}

console.log('\nAll databaseClient session tests passed.');
