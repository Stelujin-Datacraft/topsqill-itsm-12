/**
 * AI form create auth / forms_insert access checks.
 * Run: npx tsx src/lib/aiFormCreateAuth.test.ts
 */
import assert from 'assert';
import {
  assertAiFormCreateAccess,
  canSatisfyFormsInsertPolicy,
  formatAiFormCreateDiagnostics,
  type AiFormAccessSnapshot,
} from './aiFormCreateAuth';

console.log('aiFormCreateAuth');

const base: AiFormAccessSnapshot = {
  authUserId: 'be8e848b-43d9-40c9-8cd0-de4f6ddb9b19',
  projectId: '77bfd3ce-59b6-4f6b-8c8a-32067e43269c',
  projectOrganizationId: '5c8da8c7-251b-4637-8b52-793993a46264',
  profileOrganizationId: '5c8da8c7-251b-4637-8b52-793993a46264',
  isProjectMember: true,
};

{
  assert.equal(canSatisfyFormsInsertPolicy(base), true);
  const ids = assertAiFormCreateAccess(base);
  assert.equal(ids.userId, base.authUserId);
  assert.equal(ids.organizationId, base.projectOrganizationId);
  assert.equal(ids.projectId, base.projectId);
  console.log('  ✓ authorized project admin / member allowed');
}

{
  const orgOnly: AiFormAccessSnapshot = {
    ...base,
    isProjectMember: false,
  };
  assert.equal(canSatisfyFormsInsertPolicy(orgOnly), true);
  assertAiFormCreateAccess(orgOnly);
  console.log('  ✓ profile org match without project_users allowed');
}

{
  const outsider: AiFormAccessSnapshot = {
    ...base,
    isProjectMember: false,
    profileOrganizationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  };
  assert.equal(canSatisfyFormsInsertPolicy(outsider), false);
  let blocked = false;
  try {
    assertAiFormCreateAccess(outsider);
  } catch (e: any) {
    blocked = /do not have permission/i.test(String(e?.message || e));
  }
  assert.equal(blocked, true);
  console.log('  ✓ user without project access rejected');
}

{
  const mismatchOrg: AiFormAccessSnapshot = {
    ...base,
    submittedOrganizationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  };
  let blocked = false;
  try {
    assertAiFormCreateAccess(mismatchOrg);
  } catch (e: any) {
    blocked = /Organization does not match/i.test(String(e?.message || e));
  }
  assert.equal(blocked, true);
  console.log('  ✓ mismatched organization/project IDs rejected');
}

{
  const mismatchUser: AiFormAccessSnapshot = {
    ...base,
    submittedUserId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  };
  let blocked = false;
  try {
    assertAiFormCreateAccess(mismatchUser);
  } catch (e: any) {
    blocked = /does not match the signed-in user/i.test(String(e?.message || e));
  }
  assert.equal(blocked, true);
  console.log('  ✓ mismatched created_by / auth user rejected');
}

{
  const msg = formatAiFormCreateDiagnostics(base);
  assert.match(msg, /authUserId=be8e848b/);
  assert.match(msg, /projectId=77bfd3ce/);
  assert.equal(msg.includes('Bearer'), false);
  assert.equal(msg.toLowerCase().includes('jwt'), false);
  console.log('  ✓ diagnostics omit secrets');
}

console.log('aiFormCreateAuth: all passed');
