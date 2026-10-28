import assert from 'node:assert/strict';
import { importInstrument, runQuality } from '../../src/regulatory/catalog-engine';
import { loadDpdpCatalog } from '../../src/regulatory/parse-dpdp';
import { loadGdprCatalog } from '../../src/regulatory/parse-gdpr';
import { createMemoryStore } from '../../src/regulatory/store';

async function main() {
const store = createMemoryStore();
const projectId = 'project-1';
const userId = 'user-1';
const gdpr = loadGdprCatalog();
const first = await importInstrument(store, { projectId, userId, catalog: gdpr });
assert.equal(first.standards.created, 1);
assert.equal(first.clauses.created, gdpr.clauses.length);
assert.equal(first.requirements.created + first.requirements.rejected, gdpr.requirements.length);
assert.equal(first.requirements.rejected, 0);

const standard = store.submissions.find((row) => row.sourceKey === gdpr.standard.sourceKey);
const article5 = store.submissions.find((row) => row.sourceKey.endsWith(':art:5'));
const paragraph = store.submissions.find((row) => row.sourceKey.endsWith(':art:5:p:1'));
assert.ok(standard && article5 && paragraph);
const paragraphValues = paragraph.data._regulatory as Record<string, unknown>;
const parentLinks = paragraphValues.parent_clause as Array<{ id: string }>;
assert.equal(parentLinks[0].id, article5.id);
const standardLinks = paragraphValues.regulatory_standard as Array<{ id: string; form_id: string }>;
assert.equal(standardLinks[0].id, standard.id);
assert.equal(standardLinks[0].form_id, standard.formId);

const requirement = store.submissions.find((row) => String(row.sourceKey).includes(':art:5:p:1:shall:'));
assert.ok(requirement);
const requirementValues = requirement.data._regulatory as Record<string, unknown>;
assert.equal(requirementValues.lifecycle_status, 'AI Suggested');
assert.equal(requirementValues.applicability_status, 'Not decided');
assert.notEqual(requirement.approvalStatus, 'approved');
const requirementClause = requirementValues.primary_source_clause as Array<{ id: string }>;
const requirementStandard = requirementValues.regulatory_standard as Array<{ id: string }>;
assert.equal(requirementClause[0].id, paragraph.id);
assert.equal(requirementStandard[0].id, standard.id);

const child = store.fields.find((field) => field.key === 'child:grc.regulatory.clause:regulatory_standard');
assert.ok(child);
assert.equal(child.type, 'child-cross-reference');
assert.equal(child.customConfig.parentFormId, article5.formId);
assert.equal(child.customConfig.targetFormId, article5.formId);

const before = store.submissions.length;
const second = await importInstrument(store, { projectId, userId, catalog: gdpr });
assert.equal(second.standards.created, 0);
assert.equal(second.clauses.created, 0);
assert.equal(second.requirements.created, 0);
assert.equal(store.submissions.length, before);

const dpdp = loadDpdpCatalog();
const importedDpdp = await importInstrument(store, { projectId, userId, catalog: dpdp });
assert.equal(importedDpdp.clauses.created, dpdp.clauses.length);
const section1 = store.submissions.find((row) => row.sourceKey === 'act:india:dpdp:2023:22:s:1:ss:1');
assert.equal((section1?.data._regulatory as { effective_date?: string }).effective_date, '');
const section2 = store.submissions.find((row) => row.sourceKey === 'act:india:dpdp:2023:22:s:2');
assert.equal((section2?.data._regulatory as { effective_date?: string }).effective_date, '2025-11-13');

const findings = await runQuality(store, projectId, userId);
assert.ok(findings.some((finding) => finding.code === 'requirement-awaiting-review'));
assert.ok(findings.some((finding) => finding.code === 'clause-without-requirement'));
assert.ok(!findings.some((finding) => finding.code === 'requirement-standard-conflict'));

console.log(JSON.stringify({
  gdprClauses: first.clauses.created,
  gdprRequirements: first.requirements.created,
  dpdpClauses: importedDpdp.clauses.created,
  dpdpRequirements: importedDpdp.requirements.created,
  submissions: store.submissions.length,
  forms: store.forms.map((form) => ({ name: form.name, id: form.id, referenceId: form.referenceId })),
}, null, 2));
console.log('regulatory import flow tests passed');
}

main();
