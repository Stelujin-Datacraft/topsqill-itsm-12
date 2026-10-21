/**
 * Frontend-side unit checks for session UUID filter guards + Nest auth fallback rules.
 * Run: npx tsx src/services/api/databaseClient.session.test.ts
 */
import assert from 'assert';
import { assertFiltersHaveValues, unwrapNestQueryPayload } from '../../utils/databaseQueryGuards';
import { normalizeUserSessionRow } from '../../utils/userSessionRow';
import {
  isNestAuthRejectionMessage,
  shouldUseSupabaseAuthFallback,
  shouldSkipNestWithoutAccessToken,
  buildBearerAuthorization,
  mustUseRawSupabaseForPreAuthProfileLookup,
} from '../../utils/authProjectLoadGate';

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

{
  assert.equal(isNestAuthRejectionMessage('Request failed (401)'), true);
  assert.equal(isNestAuthRejectionMessage('No authorization header'), true);
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'Unauthorized',
      hasSupabaseSession: true,
    }),
    true,
  );
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'Unauthorized',
      hasSupabaseSession: false,
    }),
    false,
  );
  assert.equal(shouldSkipNestWithoutAccessToken(null), true);
  assert.equal(mustUseRawSupabaseForPreAuthProfileLookup(false), true);
  assert.equal(buildBearerAuthorization('abc'), 'Bearer abc');
  console.log('  ✓ Nest 401 / missing-header gated on live Supabase session');
}

console.log('\nAll databaseClient session tests passed.');
