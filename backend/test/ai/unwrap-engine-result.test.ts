/**
 * AI engine Response unwrap for Nest JSON serialization.
 * Run: npx tsx backend/test/ai/unwrap-engine-result.test.ts
 */
import assert from 'assert';
import { unwrapEngineResult } from '../../src/ai/unwrap-engine-result';

async function main() {
  console.log('unwrapEngineResult');

  {
    const plain = await unwrapEngineResult({
      success: true,
      result: { fields: [] },
    });
    assert.equal(plain.success, true);
    assert.deepEqual(plain.result, { fields: [] });
    console.log('  ✓ plain object passthrough');
  }

  {
    const response = new Response(
      JSON.stringify({ success: true, result: { message: 'ok' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    const unwrapped = await unwrapEngineResult(response);
    assert.equal(unwrapped.success, true);
    assert.deepEqual(unwrapped.result, { message: 'ok' });
    console.log('  ✓ Response.json() unwrapped');
  }

  {
    const errResponse = new Response(
      JSON.stringify({
        success: false,
        error: 'OpenRouter rate limit exceeded',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
    const unwrapped = await unwrapEngineResult(errResponse);
    assert.equal(unwrapped.success, false);
    assert.match(String(unwrapped.error), /rate limit/i);
    console.log('  ✓ error Response body preserved');
  }

  {
    const empty = await unwrapEngineResult(null);
    assert.equal(empty.success, false);
    assert.match(String(empty.error), /Empty/);
    console.log('  ✓ null → failure envelope');
  }

  {
    // Mimic Nest JSON.stringify(Response) → {}
    const serialized = JSON.parse(JSON.stringify(new Response('{}')));
    assert.deepEqual(serialized, {});
    const unwrapped = await unwrapEngineResult(serialized);
    // Plain {} has no success — treated as object passthrough (service still returns it).
    // Callers should prefer unwrapping before serialization.
    assert.equal(typeof unwrapped, 'object');
    console.log('  ✓ post-serialize {} is object (unwrap must run before Nest serialize)');
  }

  console.log('unwrapEngineResult: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
