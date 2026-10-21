/**
 * Static guard: forms DELETE must use can_modify_form (not the narrow
 * can_modify_forms_row-only path).
 *
 *   npx tsx test/database/forms-delete-rls-align.test.ts
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');
const MIGRATION =
  'supabase/migrations/20261021120000_forms_delete_align_can_modify_form.sql';

function main() {
  console.log('forms-delete-rls-align');
  const sql = readFileSync(resolve(ROOT, MIGRATION), 'utf8');
  assert.match(sql, /CREATE POLICY forms_delete[\s\S]*can_modify_form\(id, auth\.uid\(\)\)/i);
  assert.match(sql, /pu\.role IN \('admin', 'editor'\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.can_modify_form/);
  assert.match(sql, /_created_by = \(SELECT up\.email/);
  console.log('  ✓ migration aligns forms_delete with can_modify_form + editors');
  console.log('All forms-delete-rls-align tests passed.');
}

main();
