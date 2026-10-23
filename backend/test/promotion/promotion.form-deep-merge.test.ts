/**
 * Deep merge for form options / rules / actions.
 * Run: npx tsx test/promotion/promotion.form-deep-merge.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  actionStableKey,
  fieldMappingStableKey,
  mergeCustomConfig,
  mergeFieldOptions,
  mergeFormFieldPayload,
  mergeFormPermissions,
  mergeKeyedRecords,
  mergePages,
  mergeRuleActions,
  mergeRules,
  mergeStringLists,
  mergeTransitionRules,
  optionStableKey,
  parseJsonArray,
  remapPageFieldIds,
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

  await test('mergeFormPermissions unions principal lists', () => {
    const out: any = mergeFormPermissions(
      { view: ['role-a', '*'], submit: ['role-a'], edit: [] },
      { view: ['role-b'], submit: ['role-a'], edit: ['role-b'] },
    );
    assert.deepEqual(out.view.sort(), ['*', 'role-a', 'role-b'].sort());
    assert.deepEqual(out.submit, ['role-a']);
    assert.deepEqual(out.edit, ['role-b']);
  });

  await test('mergePages keeps Prod-only and unions fields', () => {
    const out = mergePages(
      [
        { id: 'p1', name: 'Main', order: 0, fields: ['f-prod-1', 'f-prod-2'] },
        { id: 'p-only', name: 'Prod Extra', order: 2, fields: ['f-x'] },
      ],
      [
        { id: 'p1', name: 'Main Updated', order: 0, fields: ['f-prod-2', 'f-dev-3'] },
        { id: 'p-new', name: 'Dev Page', order: 1, fields: ['f-dev-4'] },
      ],
    );
    assert.equal(out.length, 3);
    const main = out.find((p) => p.id === 'p1')!;
    assert.equal(main.name, 'Main Updated');
    assert.deepEqual((main.fields as string[]).sort(), ['f-dev-3', 'f-prod-1', 'f-prod-2'].sort());
    assert.ok(out.some((p) => p.id === 'p-only'));
    assert.ok(out.some((p) => p.id === 'p-new'));
  });

  await test('remapPageFieldIds maps Dev→Prod and drops unknown', () => {
    const map = new Map([
      ['dev-1', 'prod-1'],
      ['dev-2', 'prod-2'],
    ]);
    const out = remapPageFieldIds([{ id: 'p1', fields: ['dev-1', 'missing', 'prod-2'] }], map);
    assert.deepEqual(out[0].fields, ['prod-1', 'prod-2']);
  });

  await test('mergeCustomConfig unions transitionRules and filters', () => {
    const out: any = mergeCustomConfig(
      {
        displayAsLifecycle: true,
        transitionRules: { New: ['In Progress'], Done: ['Closed'] },
        filters: [{ id: 'f1', field: 'a', operator: '==', value: '1' }],
      },
      {
        displayAsLifecycle: true,
        transitionRules: { New: ['Blocked', 'In Progress'], Open: ['New'] },
        filters: [
          { id: 'f1', field: 'a', operator: '==', value: '2' },
          { id: 'f2', field: 'b', operator: '!=', value: 'x' },
        ],
      },
    );
    assert.deepEqual(out.transitionRules.New.sort(), ['Blocked', 'In Progress'].sort());
    assert.deepEqual(out.transitionRules.Done, ['Closed']);
    assert.deepEqual(out.transitionRules.Open, ['New']);
    assert.equal(out.filters.length, 2);
    assert.equal(out.filters.find((f: any) => f.id === 'f1').value, '2');
  });

  await test('mergeTransitionRules is associative for empty sides', () => {
    assert.deepEqual(mergeTransitionRules(null, { A: ['B'] }), { A: ['B'] });
    assert.deepEqual(mergeStringLists(['a'], ['A', 'b']), ['a', 'b']);
  });

  await test('mergeKeyedRecords for field mappings prefers names', () => {
    assert.equal(
      fieldMappingStableKey({ sourceFieldName: 'Status', targetFieldName: 'State' }),
      'name:status=>state',
    );
    const out = mergeKeyedRecords(
      [{ sourceFieldName: 'A', targetFieldName: 'B', transform: 'prod' }],
      [
        { sourceFieldName: 'A', targetFieldName: 'B', transform: 'dev' },
        { sourceFieldName: 'C', targetFieldName: 'D' },
      ],
      fieldMappingStableKey,
    );
    assert.equal(out.length, 2);
    assert.equal(out[0].transform, 'dev');
  });

  await test('form.handler wires deep merges + page remap', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/handlers/form.handler.ts'), 'utf8');
    assert.ok(/mergeFormFieldPayload/.test(src));
    assert.ok(/mergeRules/.test(src));
    assert.ok(/mergeFormPermissions/.test(src));
    assert.ok(/mergePages/.test(src));
    assert.ok(/remapPageFieldIds/.test(src));
    assert.ok(/applyMode === 'merge'/.test(src));
  });

  await test('access-control honors merge for children', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/promotion/handlers/access-control.handler.ts'), 'utf8');
    assert.ok(/applyMode === 'merge'/.test(src));
    assert.ok(/role_permissions merge/.test(src) || /existingKeys/.test(src));
    assert.ok(/user_role_assignments merge/.test(src) || /have\.has\(roleId\)/.test(src));
    assert.ok(/group_memberships merge/.test(src) || /haveMembers/.test(src));
  });

  await test('data-feed and itam merge mapping arrays', () => {
    const feed = readFileSync(resolve(process.cwd(), 'src/promotion/handlers/data-feed.handler.ts'), 'utf8');
    const itam = readFileSync(resolve(process.cwd(), 'src/promotion/handlers/itam.handler.ts'), 'utf8');
    assert.ok(/mergeKeyedRecords/.test(feed));
    assert.ok(/fieldMappingStableKey/.test(feed));
    assert.ok(/mergeKeyedRecords/.test(itam));
    assert.ok(/itamMappingStableKey/.test(itam));
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
