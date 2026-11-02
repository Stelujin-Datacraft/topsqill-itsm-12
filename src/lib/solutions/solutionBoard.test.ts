/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/solutions/solutionBoard.test.ts
 */
import assert from 'node:assert/strict';
import {
  UNASSIGNED_COLUMN_ID,
  applyFormMove,
  columnIdToSolutionId,
  columnsVisibleToViewer,
  groupFormsBySolution,
  groupSelectionState,
  planFormMove,
  solutionColor,
  solutionIdByForm,
  solutionNameError,
  type Solution,
  type SolutionFormLink,
} from '@/lib/solutions/solutionBoard';

const solution = (id: string, name: string): Solution => ({
  id,
  name,
  organization_id: 'org',
  project_id: 'project',
  description: null,
  color: 'teal',
});

const solutions = [solution('s-risk', 'Risk Management'), solution('s-asset', 'Asset Management')];
const forms = [
  { id: 'f-register', name: 'Asset Register' },
  { id: 'f-assess', name: 'Asset Assessment' },
  { id: 'f-risk', name: 'Risk Register' },
  { id: 'f-loose', name: 'Vendor Intake' },
];
const links: SolutionFormLink[] = [
  { solution_id: 's-asset', form_id: 'f-register' },
  { solution_id: 's-asset', form_id: 'f-assess' },
  { solution_id: 's-risk', form_id: 'f-risk' },
  { solution_id: 's-deleted', form_id: 'f-loose' },
];

const columns = groupFormsBySolution(solutions, links, forms);
assert.deepEqual(
  columns.map((column) => column.id),
  ['s-asset', 's-risk', UNASSIGNED_COLUMN_ID],
  'solutions are sorted by name and the unassigned column is last',
);
assert.deepEqual(columns[0].forms.map((form) => form.id), ['f-assess', 'f-register']);
assert.deepEqual(columns[1].forms.map((form) => form.id), ['f-risk']);
assert.deepEqual(
  columns[2].forms.map((form) => form.id),
  ['f-loose'],
  'a link to a solution that is not loaded counts as unassigned',
);
assert.equal(solutionIdByForm(solutions, links).get('f-loose'), undefined);

assert.deepEqual(planFormMove('f-risk', 's-risk', 's-risk'), { kind: 'none' });
assert.deepEqual(planFormMove('f-loose', null, null), { kind: 'none' });
assert.deepEqual(planFormMove('f-loose', undefined, 's-risk'), { kind: 'assign', formId: 'f-loose', solutionId: 's-risk' });
assert.deepEqual(planFormMove('f-risk', 's-risk', null), { kind: 'unassign', formId: 'f-risk' });

const shifted = applyFormMove(links, planFormMove('f-register', 's-asset', 's-risk'));
assert.equal(shifted.filter((link) => link.form_id === 'f-register').length, 1, 'a form stays in one solution');
assert.equal(solutionIdByForm(solutions, shifted).get('f-register'), 's-risk');
const removed = applyFormMove(shifted, planFormMove('f-register', 's-risk', null));
assert.equal(removed.some((link) => link.form_id === 'f-register'), false);
assert.equal(applyFormMove(links, { kind: 'none' }), links);

assert.equal(columnIdToSolutionId(UNASSIGNED_COLUMN_ID), null);
assert.equal(columnIdToSolutionId('s-risk'), 's-risk');

assert.equal(solutionColor('rose').key, 'rose');
assert.equal(solutionColor('unknown').key, 'teal');

assert.match(solutionNameError('   ', solutions)!, /Enter/);
assert.match(solutionNameError('x'.repeat(121), solutions)!, /120/);
assert.match(solutionNameError(' risk management ', solutions)!, /already exists/);
assert.equal(solutionNameError('Risk Management', solutions, 's-risk'), null, 'renaming a solution to itself is allowed');
assert.equal(solutionNameError('Compliance', solutions), null);

const viewerForms = forms.filter((form) => form.id === 'f-risk');
const viewerColumns = groupFormsBySolution([...solutions, solution('s-empty', 'Empty')], links, viewerForms);
assert.deepEqual(
  columnsVisibleToViewer(viewerColumns, false).map((column) => column.id),
  ['s-risk'],
  'a viewer only sees solutions holding a form their role grants',
);
assert.equal(columnsVisibleToViewer(viewerColumns, true).length, 4, 'managers see every solution, including empty ones');
assert.deepEqual(
  columnsVisibleToViewer(viewerColumns, false)[0].forms.map((form) => form.id),
  ['f-risk'],
  'other forms of the same solution stay hidden',
);

const granted = new Set(['f-register']);
assert.equal(groupSelectionState(['f-register', 'f-assess'], (id) => granted.has(id)), 'indeterminate');
granted.add('f-assess');
assert.equal(groupSelectionState(['f-register', 'f-assess'], (id) => granted.has(id)), true);
assert.equal(groupSelectionState(['f-risk'], (id) => granted.has(id)), false);

console.log('solutionBoard tests passed');
