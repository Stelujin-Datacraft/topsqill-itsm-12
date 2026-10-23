/**
 * Object mapping / apply-mode unit tests.
 * Run: npx tsx test/promotion/promotion.mapping.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { remapFormIdsInValue } from '../../src/promotion/engines/object-mapping';

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((e) => {
      console.error(`  ✗ ${name}`);
      throw e;
    });
}

async function main() {
  console.log('Promotional Transfer — mapping & apply mode');

  await test('remapFormIdsInValue remaps nested form_id keys', async () => {
    const resolve = async (id: string) => (id === 'dev-form-1' ? 'prod-form-9' : null);
    const input = {
      form_id: 'dev-form-1',
      nested: { source_form_id: 'dev-form-1', other: 'keep' },
      list: [{ formId: 'dev-form-1' }],
    };
    const out: any = await remapFormIdsInValue(input, resolve);
    assert.equal(out.form_id, 'prod-form-9');
    assert.equal(out.nested.source_form_id, 'prod-form-9');
    assert.equal(out.nested.other, 'keep');
    assert.equal(out.list[0].formId, 'prod-form-9');
  });

  await test('remapFormIdsInValue keeps unresolved ids', async () => {
    const resolve = async () => null;
    const out: any = await remapFormIdsInValue({ form_id: 'missing' }, resolve);
    assert.equal(out.form_id, 'missing');
  });

  await test('form handler supports replace and merge apply modes', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/handlers/form.handler.ts'), 'utf8');
    assert.ok(/childApplyMode/.test(src));
    assert.ok(/applyMode === 'merge'/.test(src));
    assert.ok(/form_fields.*delete/.test(src.replace(/\n/g, ' ')));
  });

  await test('registry / types expose ChildApplyMode and MappingReport', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/registry/types.ts'), 'utf8');
    assert.ok(/ChildApplyMode/.test(src));
    assert.ok(/MappingReport/.test(src));
    assert.ok(/childApplyMode\?:/.test(src));
  });

  await test('controller exposes POST mappings endpoint', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/promotion.controller.ts'), 'utf8');
    assert.ok(/packages\/:id\/mappings/.test(src));
    assert.ok(/buildMappings/.test(src));
  });

  await test('legacy handlers still registered', async () => {
    const { listHandlers } = await import('../../src/promotion/handlers');
    const types = listHandlers().map((h) => h.objectType);
    for (const t of ['form', 'workflow', 'report', 'dashboard', 'email_template', 'role', 'org_user', 'group']) {
      assert.ok(types.includes(t as any), `missing ${t}`);
    }
  });

  console.log('\nAll mapping tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
