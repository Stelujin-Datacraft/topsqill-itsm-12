/**
 * forms insert auth normalization.
 * Run: npx tsx backend/test/database/forms-insert-auth.test.ts
 */
import assert from 'assert';
import {
  formatFormsInsertDiagnostics,
  normalizeFormsInsertRowsForAuth,
} from '../../src/database/forms-insert-auth';

console.log('forms-insert-auth');

const authUserId = 'be8e848b-43d9-40c9-8cd0-de4f6ddb9b19';
const projectId = '77bfd3ce-59b6-4f6b-8c8a-32067e43269c';
const organizationId = '5c8da8c7-251b-4637-8b52-793993a46264';

{
  const { rows, diagnostics } = normalizeFormsInsertRowsForAuth(
    {
      name: 'AI Form',
      project_id: projectId,
      organization_id: organizationId,
      created_by: authUserId,
    },
    authUserId,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].created_by, authUserId);
  assert.match(diagnostics, /authUserId=be8e848b/);
  assert.equal(diagnostics.includes('Bearer'), false);
  console.log('  ✓ authorized insert keeps auth created_by');
}

{
  const { rows } = normalizeFormsInsertRowsForAuth(
    {
      name: 'AI Form',
      project_id: projectId,
      organization_id: organizationId,
    },
    authUserId,
  );
  assert.equal(rows[0].created_by, authUserId);
  console.log('  ✓ missing created_by filled from JWT user');
}

{
  let blocked = false;
  try {
    normalizeFormsInsertRowsForAuth(
      {
        name: 'AI Form',
        project_id: projectId,
        organization_id: organizationId,
        created_by: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      authUserId,
    );
  } catch (e: any) {
    blocked = /created_by must match/i.test(String(e?.message || e));
  }
  assert.equal(blocked, true);
  console.log('  ✓ mismatched created_by rejected');
}

{
  let blocked = false;
  try {
    normalizeFormsInsertRowsForAuth(
      { name: 'AI Form', project_id: projectId },
      authUserId,
    );
  } catch (e: any) {
    blocked = /organization_id/i.test(String(e?.message || e));
  }
  assert.equal(blocked, true);
  console.log('  ✓ missing organization_id rejected');
}

{
  const msg = formatFormsInsertDiagnostics({
    authUserId,
    projectId,
    organizationId,
    createdBy: authUserId,
  });
  assert.match(msg, /\[forms-insert\]/);
  assert.equal(msg.includes('eyJ'), false);
  console.log('  ✓ diagnostics omit token material');
}

console.log('forms-insert-auth: all passed');
