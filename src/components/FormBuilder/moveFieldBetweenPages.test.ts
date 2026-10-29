/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/components/FormBuilder/moveFieldBetweenPages.test.ts
 */
import assert from 'node:assert/strict';
import {
  destinationPageIdFromDroppable,
  moveFieldBetweenPages,
  orderedFieldsForPage,
  pageTargetDroppableId,
} from './moveFieldBetweenPages';

const form = {
  name: 'Incident',
  fields: [
    { id: 'a', label: 'Title', pageId: 'page-1' },
    { id: 'b', label: 'Details', pageId: 'page-1' },
    { id: 'c', label: 'Owner', pageId: 'page-1' },
    { id: 'd', label: 'Notes', pageId: 'page-2' },
    { id: 'e', label: 'Priority', pageId: 'page-2' },
    { id: 'orphan', label: 'Unassigned' },
    { id: 'linked', label: 'Linked only', pageId: 'page-1' },
  ],
  pages: [
    { id: 'page-1', name: 'Details', order: 0, fields: ['a', 'b', 'c'] },
    { id: 'page-2', name: 'Follow-up', order: 1, fields: ['d', 'e'] },
    { id: 'page-3', name: 'Empty', order: 2, fields: [] as string[] },
  ],
};

const moved = moveFieldBetweenPages(form, 'page-1', 1, 'page-2');
assert.ok(moved);
assert.equal(moved.movedFieldId, 'b');
assert.deepEqual(
  moved.form.pages.find((page) => page.id === 'page-1')?.fields,
  ['a', 'c'],
);
assert.deepEqual(
  moved.form.pages.find((page) => page.id === 'page-2')?.fields,
  ['d', 'e', 'b'],
);
assert.deepEqual(
  moved.form.pages.find((page) => page.id === 'page-3')?.fields,
  [],
);
assert.equal(moved.form.fields.find((field) => field.id === 'b')?.pageId, 'page-2');
assert.equal(moved.form.fields.find((field) => field.id === 'a')?.pageId, 'page-1');
assert.deepEqual(
  moved.form.fields.map((field) => field.id),
  form.fields.map((field) => field.id),
);
assert.equal(moved.form.name, 'Incident');
assert.equal(form.pages[0].fields[1], 'b');

const toEmpty = moveFieldBetweenPages(form, 'page-1', 0, 'page-3');
assert.deepEqual(toEmpty?.form.pages.find((page) => page.id === 'page-3')?.fields, ['a']);
assert.equal(toEmpty?.form.pages.find((page) => page.id === 'page-1')?.fields.includes('a'), false);

assert.equal(moveFieldBetweenPages(form, 'page-1', 1, 'page-1'), null);
assert.equal(moveFieldBetweenPages(form, 'page-1', 9, 'page-2'), null);
assert.equal(moveFieldBetweenPages(form, 'page-1', -1, 'page-2'), null);
assert.equal(moveFieldBetweenPages(form, 'missing', 0, 'page-2'), null);
assert.equal(moveFieldBetweenPages(form, 'page-1', 0, 'missing'), null);

const pageIdOnly = {
  fields: [
    { id: 'visible', pageId: 'page-1' },
    { id: 'by-page-id', pageId: 'page-1' },
  ],
  pages: [
    { id: 'page-1', fields: ['visible'] },
    { id: 'page-2', fields: ['by-page-id'] },
  ],
};
const movedByPageId = moveFieldBetweenPages(pageIdOnly, 'page-1', 1, 'page-2');
assert.equal(movedByPageId?.movedFieldId, 'by-page-id');
assert.deepEqual(movedByPageId?.form.pages.find((page) => page.id === 'page-1')?.fields, ['visible']);
assert.deepEqual(movedByPageId?.form.pages.find((page) => page.id === 'page-2')?.fields, ['by-page-id']);
assert.equal(
  movedByPageId?.form.pages.filter((page) => page.fields.includes('by-page-id')).length,
  1,
);

const alreadyOnDestination = {
  fields: [{ id: 'shared', pageId: 'page-1' }],
  pages: [
    { id: 'page-1', fields: ['shared'] },
    { id: 'page-2', fields: ['keep', 'shared'] },
  ],
};
const deduped = moveFieldBetweenPages(alreadyOnDestination, 'page-1', 0, 'page-2');
assert.deepEqual(deduped?.form.pages.find((page) => page.id === 'page-1')?.fields, []);
assert.deepEqual(deduped?.form.pages.find((page) => page.id === 'page-2')?.fields, ['keep', 'shared']);

const defaultPage = { id: 'default', fields: ['listed'] };
const ordered = orderedFieldsForPage(
  [
    { id: 'late', pageId: 'default' },
    { id: 'listed', pageId: 'default' },
    { id: 'loose' },
    { id: 'other', pageId: 'page-2' },
  ],
  defaultPage,
);
assert.deepEqual(
  ordered.map((field) => field.id),
  ['listed', 'late', 'loose'],
);

assert.equal(pageTargetDroppableId('page-2'), 'page-target:page-2');
assert.equal(destinationPageIdFromDroppable('page-target:page-2'), 'page-2');
assert.equal(destinationPageIdFromDroppable('page-target:page:extra'), 'page:extra');
assert.equal(destinationPageIdFromDroppable('all-fields'), null);
assert.equal(destinationPageIdFromDroppable('page-target:'), null);
assert.equal(destinationPageIdFromDroppable(undefined), null);

console.log('moveFieldBetweenPages checks passed');
