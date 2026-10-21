/**
 * Regression tests for auth → profile → project gates and Nest Authorization rules.
 * Run: npx tsx src/utils/authProjectLoadGate.test.ts
 */
import assert from 'assert';
import {
  resolveProfileLoadPhase,
  shouldDeferProjectFetch,
  isNestAuthRejectionMessage,
  shouldUseSupabaseAuthFallback,
  shouldSkipNestWithoutAccessToken,
  buildBearerAuthorization,
  mustUseRawSupabaseForPreAuthProfileLookup,
  shouldKeepFormsLoading,
  isGenuineProfilePermissionFailure,
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
  assert.equal(shouldDeferProjectFetch('auth_loading'), true);
  console.log('  ✓ defer projects while auth/profile loading');
}

{
  assert.equal(
    resolveProfileLoadPhase({
      authLoading: false,
      userId: 'u1',
      userProfileId: 'u1',
      profileError: null,
    }),
    'ready',
  );
  assert.equal(
    resolveProfileLoadPhase({
      authLoading: false,
      userId: 'u1',
      userProfileId: null,
      profileError: null,
    }),
    'ready',
  );
  assert.equal(shouldDeferProjectFetch('ready'), false);
  console.log('  ✓ settled auth does not infinite-defer');
}

{
  // Profile lookup before a session exists
  assert.equal(mustUseRawSupabaseForPreAuthProfileLookup(false), true);
  assert.equal(shouldSkipNestWithoutAccessToken(null), true);
  assert.equal(shouldSkipNestWithoutAccessToken(undefined), true);
  assert.equal(buildBearerAuthorization(null), null);
  console.log('  ✓ profile lookup before session skips Nest / has no bearer');
}

{
  // Profile lookup after a valid session is established
  assert.equal(mustUseRawSupabaseForPreAuthProfileLookup(true), false);
  assert.equal(shouldSkipNestWithoutAccessToken('eyJhbGciOi...'), false);
  assert.equal(buildBearerAuthorization('tok_abc'), 'Bearer tok_abc');
  console.log('  ✓ profile lookup after session attaches bearer');
}

{
  // Current Nest "No authorization header" 401 response
  assert.equal(isNestAuthRejectionMessage('No authorization header'), true);
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'No authorization header',
      hasSupabaseSession: true,
    }),
    true,
  );
  assert.equal(
    shouldUseSupabaseAuthFallback({
      errorMessage: 'No authorization header',
      hasSupabaseSession: false,
    }),
    false,
    'must not bypass Nest auth when there is no client session',
  );
  console.log('  ✓ No authorization header 401 handling');
}

{
  // Token refresh / sign-out semantics (cache seed vs clear are covered by helpers)
  assert.equal(shouldSkipNestWithoutAccessToken(''), true);
  assert.equal(buildBearerAuthorization('  '), null);
  assert.equal(shouldSkipNestWithoutAccessToken('refreshed-token'), false);
  console.log('  ✓ token refresh keeps Nest path; empty token clears bearer');
}

{
  // Authenticated user whose profile/project list is temporarily loading
  assert.equal(shouldKeepFormsLoading({ authLoading: true, projectsLoading: false }), true);
  assert.equal(shouldKeepFormsLoading({ authLoading: false, projectsLoading: true }), true);
  assert.equal(shouldKeepFormsLoading({ authLoading: false, projectsLoading: false }), false);
  assert.equal(shouldDeferProjectFetch('auth_loading'), true);
  console.log('  ✓ temporary loading keeps forms/projects deferred');
}

{
  // Genuine profile/project permission error
  const failed = resolveProfileLoadPhase({
    authLoading: false,
    userId: 'u1',
    userProfileId: null,
    profileError: 'No authorization header',
  });
  assert.equal(failed, 'failed');
  assert.equal(shouldDeferProjectFetch(failed), false);
  assert.equal(isGenuineProfilePermissionFailure('No authorization header'), true);
  assert.equal(isGenuineProfilePermissionFailure('new row violates row-level security policy'), true);
  assert.equal(isGenuineProfilePermissionFailure(null), false);
  console.log('  ✓ genuine permission errors are not empty-project');
}

console.log('\nAll authProjectLoadGate tests passed.');
