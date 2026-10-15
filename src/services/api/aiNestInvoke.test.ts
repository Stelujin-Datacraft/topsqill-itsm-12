/**
 * Nest-only AI invoke policy + response mapping.
 * Run: npx tsx src/services/api/aiNestInvoke.test.ts
 */
import assert from 'assert';
import {
  isNestOnlyAiFunction,
  mapNestAiInvokeResult,
  NEST_ONLY_AI_FUNCTIONS,
} from './aiNestInvoke';

console.log('aiNestInvoke');

{
  assert.equal(isNestOnlyAiFunction('ai-assistant'), true);
  assert.equal(isNestOnlyAiFunction('ai-copilot-action'), true);
  assert.equal(isNestOnlyAiFunction('calculate-field'), true);
  assert.equal(isNestOnlyAiFunction('request-signin-otp'), false);
  assert.ok(NEST_ONLY_AI_FUNCTIONS.has('ai-assistant'));
  console.log('  ✓ nest-only AI function set');
}

{
  const ok = mapNestAiInvokeResult({
    data: { success: true, result: { message: 'hi' } },
    error: null,
  });
  assert.equal(ok.error, null);
  assert.deepEqual(ok.data, { success: true, result: { message: 'hi' } });
  console.log('  ✓ success envelope preserved');
}

{
  const fail = mapNestAiInvokeResult({
    data: {
      success: false,
      error: 'OPENROUTER_API_KEY is not configured',
    },
    error: null,
  });
  assert.ok(fail.error);
  assert.match(fail.error!.message, /OPENROUTER_API_KEY/);
  assert.equal((fail.data as { success?: boolean })?.success, false);
  console.log('  ✓ OpenRouter config error surfaced');
}

{
  const httpErr = mapNestAiInvokeResult({
    data: null,
    error: { message: 'No authorization header' },
  });
  assert.equal(httpErr.data, null);
  assert.equal(httpErr.error?.message, 'No authorization header');
  console.log('  ✓ missing session / auth header preserved');
}

{
  const empty = mapNestAiInvokeResult({
    data: null,
    error: null,
  });
  assert.equal(empty.data, null);
  assert.match(empty.error!.message, /Empty response/);
  console.log('  ✓ empty Nest body');
}

{
  const weird = mapNestAiInvokeResult({
    data: {} as Record<string, unknown>,
    error: null,
  });
  assert.ok(weird.error);
  assert.match(weird.error!.message, /Unexpected AI response|missing success/i);
  console.log('  ✓ serialized Response {} detected');
}

{
  const nest500 = mapNestAiInvokeResult({
    data: null,
    error: { message: 'Request failed (500)' },
  });
  assert.equal(nest500.data, null);
  assert.match(nest500.error!.message, /500/);
  console.log('  ✓ Nest HTTP error kept (no Edge fallback path)');
}

console.log('aiNestInvoke: all passed');
