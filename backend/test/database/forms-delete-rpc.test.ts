/**
 *   npx tsx test/database/forms-delete-rpc.test.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const M =
  'supabase/migrations/20261021123000_forms_delete_authorized_rpc.sql';

function main() {
  console.log('forms-delete-rpc');
  const sql = readFileSync(resolve(ROOT, M), 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.delete_form_authorized/);
  assert.match(sql, /can_modify_form\(_form_id, uid\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.delete_form_authorized/);
  assert.match(sql, /GRANT EXECUTE[\s\S]*authenticated, service_role/);
  console.log('  ✓ authorized delete RPC migration present');
  console.log('All forms-delete-rpc tests passed.');
}

main();
