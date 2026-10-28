import assert from 'node:assert/strict';
import { getRegulatoryAccessState } from '../../src/regulatory/regulatory-access';
import { extractClauseCandidates, runRegulatoryAiAction } from '../../src/regulatory/ai-actions';

const prodOff = getRegulatoryAccessState({ NODE_ENV: 'production' });
assert.equal(prodOff.enabled, false);
const prodOn = getRegulatoryAccessState({ NODE_ENV: 'production', REGULATORY_ENABLED: 'true' });
assert.equal(prodOn.enabled, true);
const devOn = getRegulatoryAccessState({ NODE_ENV: 'development' });
assert.equal(devOn.enabled, true);
const devOff = getRegulatoryAccessState({ NODE_ENV: 'development', REGULATORY_ENABLED: 'false' });
assert.equal(devOff.enabled, false);

const extracted = extractClauseCandidates('Article 5 Principles\nPersonal data shall be processed lawfully.\nNo heading here.');
assert.equal(extracted.structures[0].identifier, 'Article 5');
assert.equal(extracted.obligations.length, 1);
assert.ok(!extracted.structures.some((item) => item.identifier === 'Article 6'));

async function main() {
const refused = await runRegulatoryAiAction('regulatory-plain-language', { submissionId: 'other-org' }, () => undefined);
assert.equal(refused.available, false);
assert.match(refused.reason || '', /user token/);

const noChange = await runRegulatoryAiAction('regulatory-change-analysis', { leftKeys: ['a'] }, () => undefined);
assert.equal(noChange.available, false);

const changed = await runRegulatoryAiAction('regulatory-change-analysis', {
  leftKeys: ['art:1', 'art:2'],
  rightKeys: ['art:2', 'art:3'],
}, () => undefined);
assert.equal(changed.available, true);
const diff = changed.result as { added: string[]; removed: string[] };
assert.deepEqual(diff.added, ['art:3']);
assert.deepEqual(diff.removed, ['art:1']);

const evidence = await runRegulatoryAiAction('regulatory-evidence-suggestions', {
  statement: 'The controller shall maintain a record of processing.',
  policies: [
    { id: 'policy-1', name: 'Record of processing activities', reference: 'Article 30' },
    { id: 'policy-2', name: 'Unrelated facilities policy', reference: 'none' },
  ],
}, () => undefined);
const policies = (evidence.result as { policies: Array<{ id: string }>; controls: unknown[] }).policies;
assert.deepEqual(policies.map((policy) => policy.id), ['policy-1']);
assert.deepEqual((evidence.result as { controls: unknown[] }).controls, []);

console.log('regulatory access and AI guard tests passed');
}

main();
