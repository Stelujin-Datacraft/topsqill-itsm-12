/**
 * Unit tests for safe table column sorting.
 * Run: npx tsx src/components/reports/utils/tableSort.test.ts
 */

import {
  compareTableFieldValues,
  ensureOptionsArray,
  sortTableRows,
} from './tableSort';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

// options stored as JSON string (common DB shape) must not crash .find
assertEq(
  ensureOptionsArray('[{"value":"p1","label":"Priority 1"}]'),
  [{ value: 'p1', label: 'Priority 1' }],
  'parses options JSON string',
);
assertEq(ensureOptionsArray(null), [], 'null options -> []');
assertEq(ensureOptionsArray('not-json'), [], 'invalid JSON -> []');

const opts = [{ value: 'p1', label: 'Priority 1' }, { value: 'p2', label: 'Priority 2' }];

assert(
  compareTableFieldValues('p1', 'p2', 'select', { options: opts }, 'asc') < 0,
  'select sorts by label asc',
);

// JSON-string options previously crashed with .find is not a function
assert(
  typeof compareTableFieldValues(
    'p2',
    'p1',
    'select',
    { options: JSON.stringify(opts) },
    'asc',
  ) === 'number',
  'select with string options does not throw',
);

// status-like object values
assert(
  typeof compareTableFieldValues(
    { label: 'Draft', value: 'draft' },
    'Draft',
    'status',
    { options: [] },
    'asc',
  ) === 'number',
  'status object vs string',
);

// Age color labels (Green/Yellow/Red) as select
assert(
  compareTableFieldValues('Green', 'Red', 'select', {
    options: [
      { value: 'green', label: 'Green' },
      { value: 'red', label: 'Red' },
    ],
  }, 'asc') < 0,
  'Green before Red',
);

// severity ordinal-ish string sort with numeric:true still works lexicographically-ish for High/Low/Medium
assert(
  typeof compareTableFieldValues('High', 'Low', 'select', { options: [] }, 'desc') === 'number',
  'severity strings',
);

const rows = [
  { id: '1', submission_data: { priority: 'p2' } },
  { id: '2', submission_data: { priority: 'p1' } },
  { id: '3', submission_data: { priority: null } },
];

const sorted = sortTableRows(rows, {
  field: 'priority',
  direction: 'asc',
  formFields: [{ id: 'priority', field_type: 'select', options: JSON.stringify(opts) }],
  getFieldValue: (row, id) => row.submission_data?.[id],
});

assertEq(
  sorted.map((r) => r.id),
  ['2', '1', '3'],
  'nulls last; p1 before p2 by label',
);

// Must not blank the page on pathological values
const weird = Object.create(null);
weird.x = 1;
assert(
  typeof compareTableFieldValues(weird, 'a', 'text', null, 'asc') === 'number',
  'null-prototype object does not throw',
);

console.log('All tableSort tests passed.');
