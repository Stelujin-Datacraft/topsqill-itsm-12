/**
 * Deep merge for form options / rules / actions.
 * Run: npx tsx test/promotion/promotion.form-deep-merge.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  actionStableKey,
  mergeFieldOptions,
  mergeFormFieldPayload,
  mergeRuleActions,
  mergeRules,
  optionStableKey,
  parseJsonArray,
  ruleStableKey,
} from '../../src/promotion/engines/form-deep-merge';

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
  console.log('Promotional Transfer — form deep merge (options / rules / actions)');

  await test('optionStableKey prefers value then label', () => {
    assert.equal(optionStableKey({ value: 'Open', label: 'OPEN' }), 'open');
    assert.equal(optionStableKey({ label: 'Closed' }), 'closed');
    assert.equal(optionStableKey('High'), 'high');
  });

  await test('mergeFieldOptions unions and Dev wins on match', () => {
    const prod = [
      { id: '1', value: 'a', label: 'A' },
      { id: '2', value: 'b', label: 'B-prod' },
      { id: '3', value: 'c', label: 'C' },
    ];
    const dev = [
      { id: 'x', value: 'b', label: 'B-dev' },
      { id: 'y', value: 'd', label: 'D' },
    ];
    const out = mergeFieldOptions(prod, dev) as Array<{ value: string; label: string }>;
    assert.deepEqual(
      out.map((o) => o.value),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(out.find((o) => o.value === 'b')?.label, 'B-dev');
  });

  await test('mergeFormFieldPayload deep-merges select options', () => {
    const prod = {
      label: 'Status',
      field_type: 'select',
      options: [
        { id: '1', value: 'new', label: 'New' },
        { id: '2', value: 'done', label: 'Done' },
      ],
      required: false,
    };
    const dev = {
      label: 'Status',
      field_type: 'select',
      options: [
        { id: '9', value: 'done', label: 'Completed' },
        { id: '8', value: 'wip', label: 'In Progress' },
      ],
      required: true,
    };
    const out = mergeFormFieldPayload(prod, dev);
    assert.equal(out.required, true);
    const opts = out.options as Array<{ value: string; label: string }>;
    assert.deepEqual(
      opts.map((o) => o.value),
      ['new', 'done', 'wip'],
    );
    assert.equal(opts.find((o) => o.value === 'done')?.label, 'Completed');
  });

  await test('ruleStableKey uses name', () => {
    assert.equal(ruleStableKey({ name: ' Hide Title ', action: 'hide' }), 'name:hide title');
  });

  await test('mergeRules keeps Prod-only, appends Dev-only, merges matched', () => {
    const prod = [
      {
        id: 'p1',
        name: 'Show Priority',
        action: 'show',
        targetFieldId: 'f1',
        isActive: true,
        actions: [{ id: 'a1', action: 'show', targetFieldId: 'f1' }],
      },
      {
        id: 'p2',
        name: 'Prod Only Rule',
        action: 'hide',
        targetFieldId: 'f2',
        isActive: true,
      },
    ];
    const dev = [
      {
        id: 'd1',
        name: 'Show Priority',
        action: 'show',
        targetFieldId: 'f1',
        isActive: false,
        actions: [
          { id: 'a1', action: 'show', targetFieldId: 'f1', actionValue: 'x' },
          { id: 'a2', action: 'require', targetFieldId: 'f3' },
        ],
      },
      {
        id: 'd3',
        name: 'Dev New Rule',
        action: 'disable',
        targetFieldId: 'f4',
        isActive: true,
      },
    ];
    const out = mergeRules(prod, dev);
    assert.equal(out.length, 3);
    const show = out.find((r) => ruleStableKey(r) === 'name:show priority')!;
    assert.equal(show.isActive, false);
    assert.equal(show.id, 'p1'); // Prod id preserved
    assert.equal((show.actions as any[]).length, 2);
    assert.ok(out.some((r) => ruleStableKey(r) === 'name:prod only rule'));
    assert.ok(out.some((r) => ruleStableKey(r) === 'name:dev new rule'));
  });

  await test('mergeRuleActions appends by action+target', () => {
    const prod = [{ action: 'show', targetFieldId: 'a' }];
    const dev = [
      { action: 'show', targetFieldId: 'a', actionValue: 1 },
      { action: 'hide', targetFieldId: 'b' },
    ];
    const out = mergeRuleActions(prod, dev);
    assert.equal(out.length, 2);
    assert.equal(out[0].actionValue, 1);
    assert.equal(actionStableKey(out[1]), 'act:hide::b');
  });

  await test('parseJsonArray accepts stringified rules', () => {
    const arr = parseJsonArray(JSON.stringify([{ name: 'R1', action: 'show' }]));
    assert.equal(arr.length, 1);
    assert.equal(arr[0].name, 'R1');
  });

  await test('form.handler wires mergeFieldOptions / mergeRules', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/handlers/form.handler.ts'), 'utf8');
    assert.ok(/mergeFormFieldPayload/.test(src));
    assert.ok(/mergeRules/.test(src));
    assert.ok(/applyMode === 'merge'/.test(src));
  });

  await test('object-mapping reports rule and action kinds', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/engines/object-mapping.ts'), 'utf8');
    assert.ok(/kind: 'rule'/.test(src));
    assert.ok(/kind: 'action'/.test(src));
    assert.ok(/addRuleMappingEntries/.test(src));
  });

  await test('MappingEntry type includes rule and action', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/registry/types.ts'), 'utf8');
    assert.ok(/\| 'rule'/.test(src));
    assert.ok(/\| 'action'/.test(src));
  });

  console.log('\nAll form deep-merge tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
