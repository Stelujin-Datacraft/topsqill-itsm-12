/**
 * CrowdStrike device fields must map onto the discovered form schema,
 * not the hardcoded Vulnerability template (external_id / vulnerability_id / …).
 */
import assert from 'node:assert/strict';
import {
  CROWDSTRIKE_DEVICE_SOURCE_FIELDS,
  isCrowdStrikeDesign,
  pickMatchingTargetField,
  suggestFieldMappings,
} from '../src/lib/vis/fieldMapping.ts';

// Typical device form the user actually selected (not Vulnerability)
const deviceFormFields = [
  { name: 'id', label: 'ID', required: true },
  { name: 'hostname', label: 'Hostname' },
  { name: 'os', label: 'OS' },
  { name: 'serialNumber', label: 'Serial Number' },
  { name: 'status', label: 'Status' },
];

const mapped = suggestFieldMappings({
  sourceFields: CROWDSTRIKE_DEVICE_SOURCE_FIELDS,
  targetFields: deviceFormFields,
});

assert.ok(mapped.length >= 4, `expected mappings, got ${mapped.length}`);
const bySource = Object.fromEntries(mapped.map((m) => [m.sourceField, m.targetField]));
assert.equal(bySource.id, 'id');
assert.equal(bySource.hostname, 'hostname');
assert.equal(bySource.os, 'os');
assert.equal(bySource.serialNumber, 'serialNumber');
assert.equal(bySource.status, 'status');
assert.ok(!Object.values(bySource).includes('vulnerability_id'));
assert.ok(!Object.values(bySource).includes('external_id'));
assert.ok(!Object.values(bySource).includes('assignment_group'));

// Form with snake_case labels still maps sensibly
const snakeForm = [
  { name: 'device_id', label: 'Device ID' },
  { name: 'host_name', label: 'Host Name' },
  { name: 'operating_system', label: 'Operating System' },
  { name: 'serial_number', label: 'Serial' },
  { name: 'status', label: 'Status' },
];
const snakeMapped = suggestFieldMappings({
  sourceFields: CROWDSTRIKE_DEVICE_SOURCE_FIELDS,
  targetFields: snakeForm,
});
const snakeBy = Object.fromEntries(snakeMapped.map((m) => [m.sourceField, m.targetField]));
assert.equal(snakeBy.id, 'device_id');
assert.equal(snakeBy.hostname, 'host_name');
assert.equal(snakeBy.os, 'operating_system');
assert.equal(snakeBy.serialNumber, 'serial_number');

assert.equal(pickMatchingTargetField(deviceFormFields), 'id');
assert.equal(pickMatchingTargetField(snakeForm), 'device_id');
assert.equal(isCrowdStrikeDesign({ sourceHints: { system: 'CrowdStrike' } }), true);
assert.equal(isCrowdStrikeDesign({ name: 'ServiceNow Vulnerabilities' }, 'vuln sync'), false);

console.log('vis-crowdstrike-real-form-mapping: ok');
