/**
 * Unit tests for Link Existing Record match / dedupe helpers.
 * Run: npx tsx src/services/workflow/crossRefLinkHelpers.test.ts
 */
import {
  appendCrossRefLink,
  findMatchingChildRecords,
  normalizeComparableValue,
  submissionMatchesMappings,
  extractLinkedIdentityKeys,
} from './crossRefLinkHelpers.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// normalizeComparableValue
assertEq(normalizeComparableValue('  ACME  '), 'ACME', 'trim string');
assertEq(normalizeComparableValue(42), '42', 'number');
assertEq(normalizeComparableValue(null), '', 'null');

// submissionMatchesMappings — all keys must match
const mappings = [
  { sourceFieldId: 'p_code', targetFieldId: 'c_code' },
  { sourceFieldId: 'p_name', targetFieldId: 'c_name' },
];
assert(
  submissionMatchesMappings(
    { p_code: 'X1', p_name: 'Alpha' },
    { c_code: 'X1', c_name: 'Alpha' },
    mappings,
  ),
  'full match should pass',
);
assert(
  !submissionMatchesMappings(
    { p_code: 'X1', p_name: 'Alpha' },
    { c_code: 'X1', c_name: 'Beta' },
    mappings,
  ),
  'partial mismatch should fail',
);
assert(
  !submissionMatchesMappings(
    { p_code: '', p_name: 'Alpha' },
    { c_code: '', c_name: 'Alpha' },
    mappings,
  ),
  'empty parent values should fail',
);
assert(
  !submissionMatchesMappings({ p_code: 'X1' }, { c_code: 'X1' }, []),
  'no mappings should fail',
);

// findMatchingChildRecords
const candidates = [
  { id: '1', submission_ref_id: 'REF1', submission_data: { c_code: 'A', c_name: 'One' } },
  { id: '2', submission_ref_id: 'REF2', submission_data: { c_code: 'B', c_name: 'Two' } },
  { id: '3', submission_ref_id: 'REF3', submission_data: { c_code: 'A', c_name: 'One' } },
];
const first = findMatchingChildRecords(
  { p_code: 'A', p_name: 'One' },
  candidates,
  mappings,
  'first',
);
assertEq(first.length, 1, 'first scope returns one');
assertEq(first[0].id, '1', 'first match id');

const all = findMatchingChildRecords(
  { p_code: 'A', p_name: 'One' },
  candidates,
  mappings,
  'all',
);
assertEq(all.length, 2, 'all scope returns both');

const none = findMatchingChildRecords(
  { p_code: 'Z', p_name: 'Nope' },
  candidates,
  mappings,
  'all',
);
assertEq(none.length, 0, 'no match');

// extractLinkedIdentityKeys + appendCrossRefLink dedupe
const keys = extractLinkedIdentityKeys([{ submission_ref_id: 'REF1', id: '1', form_id: 'f2' }, 'REF2']);
assert(keys.has('REF1') && keys.has('1') && keys.has('REF2'), 'extract keys');

const already = appendCrossRefLink(
  [{ id: '1', submission_ref_id: 'REF1', form_id: 'f2' }],
  { id: '1', submission_ref_id: 'REF1' },
  'f2',
);
assert(already.alreadyLinked && !already.added, 'dedupe existing link');

const added = appendCrossRefLink(
  [{ id: '1', submission_ref_id: 'REF1', form_id: 'f2' }],
  { id: '2', submission_ref_id: 'REF2' },
  'f2',
);
assert(added.added && !added.alreadyLinked, 'add new link');
assertEq(added.value.length, 2, 'value length after add');
assert(
  typeof added.value[1] === 'object'
    && (added.value[1] as any).submission_ref_id === 'REF2',
  'rich object entry preferred',
);

const fromEmpty = appendCrossRefLink([], { id: '9', submission_ref_id: 'REF9' }, 'f2');
assert(fromEmpty.added, 'add to empty XR');

console.log('crossRefLinkHelpers.test.ts: all assertions passed');
