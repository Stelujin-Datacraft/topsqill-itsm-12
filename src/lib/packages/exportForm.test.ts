/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/lib/packages/exportForm.test.ts
 */
import assert from 'node:assert/strict';
import { isValidVersion } from '../../../packages/package-spec/src/semver';
import { PACKAGE_KEY_PATTERN } from '../../../packages/package-spec/src/validate';
import { exportFormErrors, packageKeyFromName, type ExportFormValues } from '@/lib/packages/exportForm';

const names = ['Asset Management (v2)', '  IT  Service  ', 'Café Ops', '123 Forms', 'A', '!!!', 'x'.repeat(100), 'a----b--'];
for (const name of names) {
  const key = packageKeyFromName(name);
  assert.ok(PACKAGE_KEY_PATTERN.test(key), `${JSON.stringify(name)} -> ${key}`);
}
assert.equal(packageKeyFromName('Asset Management (v2)'), 'asset-management-v2');
assert.equal(packageKeyFromName('Café Ops'), 'cafe-ops');
assert.equal(packageKeyFromName('123 Forms'), 'p-123-forms');
assert.equal(packageKeyFromName('!!!'), 'package');

const valid: ExportFormValues = { key: 'asset-management', name: 'Asset Management', version: '1.0.0', description: '', license: 'private', requiresModules: [] };
assert.deepEqual(exportFormErrors(valid), {});
assert.ok(exportFormErrors({ ...valid, name: '  ' }).name);
assert.ok(exportFormErrors({ ...valid, key: 'Asset' }).key);
assert.ok(exportFormErrors({ ...valid, key: '9lives' }).key);
assert.ok(exportFormErrors({ ...valid, version: '1.0' }).version);
assert.deepEqual(exportFormErrors({ ...valid, version: ' 2.1.0-beta.1 ' }), {});

for (const version of ['1.0.0', '0.0.1', '2.1.0-beta.1', '1.0', '01.0.0', 'v1.0.0']) {
  assert.equal(!exportFormErrors({ ...valid, version }).version, isValidVersion(version), version);
}

console.log('package export form tests passed');
