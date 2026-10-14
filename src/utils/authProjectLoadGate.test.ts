/**
 * Focused tests for auth → profile → project load gates and Nest 401 fallback rules.
 * Run: npx tsx src/utils/authProjectLoadGate.test.ts
 */
import assert from 'assert';
import {
  resolveProfileLoadPhase,
  shouldDeferProjectFetch,
  isNestAuthRejectionMessage,
  shouldUseSupabaseAuthFallback,
} from './authProjectLoadGate';

console.log('authProjectLoadGate');

{
  assert.equal(
    resolveProfileLoadPhase({
      authLoading: true,
      userId: 'u1',
      userProfileId: null,
      profileError: null,
    }),
    'auth_loading',
  );
  assert.equal(
    shouldDeferProjectFetch('auth_loading'),
    true,
    'must defer project fetch while auth/profile still loading',
  );
  console.log('  ✓ defer projects while authLoading');
}

{
  const readyWithProfile = resolveProfileLoadPhase({
    authLoading: false,
    userId: 'u1',
    userProfileId: 'u1',
    profileError: null,
  });
  assert.equal(readyWithProfile, 'ready');
  assert.equal(shouldDeferProjectFetch(readyWithProfile), false);

  // After auth settles without a profile and without error — do not defer forever.
  const readyWithoutProfile = resolveProfileLoadPhase({
    authLoading: false,
    userId: 'u1',
    userProfileId: null,
    profileError: null,
  });
  assert.equal(readyWithoutProfile, 'ready');
  assert.equal(shouldDeferProjectFetch(readyWithoutProfile), false);
  console.log('  ✓ settled auth does not infinite-defer projects');
}

{
  const failed = resolveProfileLoadPhase({
    authLoading: false,
    userId: 'u1',
    userProfileId: null,
    profileError: 'Request failed (401)',
  });
  assert.equal(failed, 'failed');
  assert.equal(shouldDeferProjectFetch(failed), false);
  console.log('  ✓ profile failure is not treated as loading');
}

{
  assert.equal(isNestAuthRejectionMessage('Request failed (401)'), true);
  assert.equal(isNestAuthRejectionMessage('Unauthorized'), true);
  assert.equal(isNestAuthRejectionMessage('Invalid user token'), true);
  assert.equal(isNestAuthRejectionMessage('Request failed (403)'), false);
  assert.equal(isNestAuthRejectionMessage('Request failed (500)'), false);
  assert.equal(isNestAuthRejectionMessage(null), false);
  console.log('  ✓ Nest auth rejection detection');
}

{
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'Request failed (401)',
      hasSupabaseSession: true,
    }),
    true,
    '401 with live session may use PostgREST+RLS',
  );
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'Request failed (401)',
      hasSupabaseSession: false,
    }),
    false,
    '401 without session must not silently bypass auth',
  );
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'Request failed (403)',
      hasSupabaseSession: true,
    }),
    false,
    '403 must not trigger auth fallback',
  );
  console.log('  ✓ Supabase auth fallback only when appropriate');
}

console.log('\nAll authProjectLoadGate tests passed.');
