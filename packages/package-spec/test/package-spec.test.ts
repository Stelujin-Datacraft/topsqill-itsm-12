/**
 * Run from the repo root: npx tsx packages/package-spec/test/package-spec.test.ts
 */
import assert from 'assert';
import {
  buildPackage,
  canonicalJson,
  collectSourceIds,
  compareVersions,
  computeChecksum,
  externalFormReferences,
  generateSigningKeys,
  isValidVersion,
  objectKey,
  packageFileName,
  remapIds,
  validatePackage,
  verifyIntegrity,
  type PackageManifest,
  type PackageObject,
} from '../src';

const FORM = '11111111-1111-4111-8111-111111111111';
const FIELD = '22222222-2222-4222-8222-222222222222';
const OTHER_FORM = '33333333-3333-4333-8333-333333333333';
const WORKFLOW = '44444444-4444-4444-8444-444444444444';
const NODE = '55555555-5555-4555-8555-555555555555';
const SOLUTION = '66666666-6666-4666-8666-666666666666';

const manifest: PackageManifest = {
  key: 'asset-management',
  name: 'Asset Management',
  version: '1.0.0',
  publisher: 'Topsqill',
  description: 'Asset registers and scoring',
  license: 'paid',
  requires: { modules: [] },
  createdAt: '2026-11-03T00:00:00.000Z',
};

const objects: PackageObject[] = [
  { type: 'form', key: objectKey('form', FORM), name: 'Asset Register', data: {
    form: { id: FORM, name: 'Asset Register', pages: [{ id: 'page-1', fields: [FIELD] }] },
    fields: [{ id: FIELD, form_id: FORM, label: 'Score', field_type: 'query-field', custom_config: { query: `select avg(x) from submissions where form_id = '${FORM}' and field = '${FIELD}'` } }],
  } },
  { type: 'workflow', key: objectKey('workflow', WORKFLOW), name: 'Notify', data: {
    workflow: { id: WORKFLOW, name: 'Notify' },
    nodes: [{ id: NODE, workflow_id: WORKFLOW, config: { formId: FORM, lookup: { targetFormId: OTHER_FORM } } }],
    connections: [],
    triggers: [],
  } },
  { type: 'solution', key: objectKey('solution', SOLUTION), name: 'Assets', data: { solution: { id: SOLUTION, name: 'Assets', color: '#10b981' }, formIds: [FORM] } },
];

function main() {
  console.log('package-spec');

  assert.ok(isValidVersion('1.2.3') && isValidVersion('2.0.0-beta.1'));
  assert.ok(!isValidVersion('1.2') && !isValidVersion('v1.2.3') && !isValidVersion('01.0.0'));
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0);
  assert.ok(compareVersions('1.0.0-beta.2', '1.0.0-beta.10') < 0);
  assert.ok(compareVersions('1.0.0-rc.1', '1.0.0') < 0, 'a pre-release comes before the release');
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);

  assert.equal(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[1,{"y":2,"z":1}]},"b":1}');
  assert.equal(canonicalJson({ a: undefined, b: 1 }), '{"b":1}');

  const pkg = buildPackage(manifest, objects);
  assert.deepEqual(pkg.objects.map((o) => o.type), ['solution', 'form', 'workflow'], 'objects are ordered predictably');
  assert.equal(pkg.integrity.checksum, computeChecksum(pkg));
  assert.equal(packageFileName(manifest), 'asset-management-1.0.0.tpkg.json');
  assert.deepEqual(validatePackage(pkg).errors, []);
  assert.deepEqual(validatePackage(pkg).warnings, [`workflow:${WORKFLOW} refers to form ${OTHER_FORM}, which is not in the package`]);

  // Same content in a different key order hashes the same.
  const reordered = JSON.parse(JSON.stringify(pkg));
  reordered.manifest = Object.fromEntries(Object.entries(reordered.manifest).reverse());
  assert.equal(computeChecksum(reordered), pkg.integrity.checksum);

  const keys = generateSigningKeys();
  const signed = buildPackage(manifest, objects, { keyId: 'topsqill-2026', privateKeyPem: keys.privateKey });
  assert.deepEqual(verifyIntegrity(signed, { 'topsqill-2026': keys.publicKey }, { requireSignature: true }), { ok: true, signed: true, keyId: 'topsqill-2026' });
  assert.equal(verifyIntegrity(pkg, {}, { requireSignature: true }).ok, false, 'unsigned packages are refused when a signature is required');
  assert.deepEqual(verifyIntegrity(pkg, {}, { requireSignature: false }), { ok: true, signed: false, keyId: null });

  const tampered = JSON.parse(JSON.stringify(signed));
  tampered.objects[1].data.fields[0].label = 'Hacked';
  const tamperedResult = verifyIntegrity(tampered, { 'topsqill-2026': keys.publicKey }, { requireSignature: true });
  assert.equal(tamperedResult.ok === false && tamperedResult.reason, 'checksum_mismatch');

  const resealed = { ...tampered, integrity: { algorithm: 'sha256', checksum: computeChecksum(tampered) } };
  const resealedResult = verifyIntegrity(resealed, { 'topsqill-2026': keys.publicKey }, { requireSignature: true });
  assert.equal(resealedResult.ok === false && resealedResult.reason, 'bad_signature', 'recomputing the checksum does not fake the signature');

  const otherKeys = generateSigningKeys();
  const unknown = verifyIntegrity(signed, { 'someone-else': otherKeys.publicKey }, { requireSignature: true });
  assert.equal(unknown.ok === false && unknown.reason, 'unknown_key');

  const ids = collectSourceIds(pkg).sort();
  assert.deepEqual(ids, [FORM, FIELD, WORKFLOW, NODE, SOLUTION].sort());
  const idMap = { [FORM]: 'aaaaaaaa-0000-4000-8000-000000000001', [FIELD]: 'aaaaaaaa-0000-4000-8000-000000000002' };
  const remapped = remapIds(pkg.objects[1].data, idMap) as {
    form: { id: string; pages: { fields: string[] }[] };
    fields: { custom_config: { query: string } }[];
  };
  assert.equal(remapped.form.id, idMap[FORM]);
  assert.deepEqual(remapped.form.pages[0].fields, [idMap[FIELD]]);
  assert.ok(remapped.fields[0].custom_config.query.includes(idMap[FORM]) && remapped.fields[0].custom_config.query.includes(idMap[FIELD]), 'ids inside SQL are remapped');
  assert.ok(!JSON.stringify(remapped).includes(FORM));
  assert.equal(remapIds({ page: 'page-1' }, idMap).page, 'page-1', 'non-UUID strings are untouched');
  assert.equal((remapIds(pkg.objects[2].data, idMap) as { nodes: { config: { lookup: { targetFormId: string } } }[] }).nodes[0].config.lookup.targetFormId, OTHER_FORM, 'unmapped ids stay as they are');

  assert.deepEqual(externalFormReferences(pkg), [{ objectKey: `workflow:${WORKFLOW}`, formId: OTHER_FORM }]);

  const broken = JSON.parse(JSON.stringify(pkg));
  broken.manifest.version = '1.0';
  broken.manifest.requires.modules = ['crm'];
  broken.objects[0].data.formIds.push(OTHER_FORM);
  broken.objects.push({ ...broken.objects[1] });
  const errors = validatePackage(broken).errors.join('\n');
  assert.match(errors, /semantic version/);
  assert.match(errors, /unknown module "crm"/);
  assert.match(errors, /not in the package/);
  assert.match(errors, /appears more than once/);
  assert.throws(() => buildPackage({ ...manifest, key: 'Bad Key' }, objects), /manifest.key/);
  assert.match(validatePackage({ ...pkg, objects: pkg.objects.filter((o) => o.type !== 'solution') }).errors.join(), /exactly one solution/);
  assert.equal(validatePackage('nope').ok, false);

  console.log('package-spec checks passed');
}

main();
