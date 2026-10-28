import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseGdprHtml } from '../../src/regulatory/parse-gdpr';
import { assignCommencement, parseCommencementNotice, parseDpdp } from '../../src/regulatory/parse-dpdp';
import { explicitShallSentences } from '../../src/regulatory/text-utils';

const sources = join(dirname(fileURLToPath(import.meta.url)), '../../src/regulatory/sources');

const gdpr = parseGdprHtml(readFileSync(join(sources, 'gdpr.xhtml'), 'utf8'));
const articles = gdpr.clauses.filter((clause) => clause.clauseType === 'article');
assert.equal(articles.length, 99, 'GDPR article count');
assert.equal(articles[0].officialIdentifier, 'Article 1');
assert.equal(articles[98].officialIdentifier, 'Article 99');
assert.equal(gdpr.standard.publicationDate, '2016-05-04');
assert.equal(gdpr.standard.effectiveDate, '2018-05-25');
assert.match(gdpr.standard.commencementStatus, /twentieth day/);
const article5 = gdpr.clauses.find((clause) => clause.sourceKey.endsWith(':art:5'));
assert.ok(article5);
assert.match(article5.title, /Principles relating to processing of personal data/);
const article5p1 = gdpr.clauses.find((clause) => clause.sourceKey.endsWith(':art:5:p:1'));
assert.ok(article5p1);
assert.match(article5p1.text, /Personal data shall be/);
assert.equal(article5p1.parentSourceKey, article5.sourceKey);
assert.ok(gdpr.requirements.some((item) => item.primaryClauseSourceKey === article5p1.sourceKey));
assert.ok(gdpr.requirements.every((item) => item.requirementType === 'Candidate explicit shall'));
assert.equal(gdpr.clauses.filter((clause) => clause.clauseType === 'recital').length, 173);
assert.ok(!gdpr.requirements.some((item) => item.primaryClauseSourceKey.includes(':rct:')));

const act = readFileSync(join(sources, 'dpdp-act.txt'), 'utf8');
const notice = readFileSync(join(sources, 'dpdp-commencement.txt'), 'utf8');
const rules = parseCommencementNotice(notice);
assert.equal(rules.reference, 'G.S.R. 843(E)');
assert.equal(rules.publicationDate, '2025-11-13');
assert.match(rules.buckets[0].raw, /section 2/);
assert.match(rules.buckets[1].raw, /one year/i);
assert.match(rules.buckets[2].raw, /eighteen months/i);

assert.equal(assignCommencement(rules, 2).effectiveDate, '2025-11-13');
assert.equal(assignCommencement(rules, 1, 1).effectiveDate, null);
assert.equal(assignCommencement(rules, 1, 2).effectiveDate, '2025-11-13');
assert.equal(assignCommencement(rules, 6, 9).effectiveDate, '2026-11-13');
assert.equal(assignCommencement(rules, 6, 1).effectiveDate, '2027-05-13');
assert.equal(assignCommencement(rules, 3).effectiveDate, '2027-05-13');
assert.equal(assignCommencement(rules, 18).effectiveDate, '2025-11-13');
assert.equal(assignCommencement(rules, 35).effectiveDate, '2025-11-13');
assert.equal(assignCommencement(rules, 27, 1, 'd').effectiveDate, '2026-11-13');
assert.equal(assignCommencement(rules, 27).effectiveDate, null);
assert.match(assignCommencement(rules, 27).status, /Split/);
assert.equal(assignCommencement(rules, 44, 2).effectiveDate, '2027-05-13');
assert.equal(assignCommencement(rules, 44, 1).effectiveDate, '2025-11-13');

const dpdp = parseDpdp(act, notice);
const sections = dpdp.clauses.filter((clause) => clause.clauseType === 'section');
assert.equal(sections.length, 44);
for (let n = 1; n <= 44; n++) {
  assert.ok(sections.some((clause) => clause.officialIdentifier === `Section ${n}`), `missing section ${n}`);
}
assert.equal(dpdp.standard.effectiveDate, null);
assert.match(dpdp.standard.legalStatus, /11 August 2023/);
assert.match(dpdp.standard.commencementStatus, /not appointed/i);
assert.equal(dpdp.clauses.find((clause) => clause.officialIdentifier === 'Section 1(1)')?.effectiveDate, null);
assert.equal(dpdp.clauses.find((clause) => clause.officialIdentifier === 'Section 2')?.effectiveDate, '2025-11-13');
assert.ok(dpdp.requirements.length > 0);
assert.ok(dpdp.requirements.every((item) => item.statement.toLowerCase().includes('shall')));
assert.equal(explicitShallSentences('“personal data” means any data.').length, 0);

console.log(JSON.stringify({
  gdprClauses: gdpr.clauses.length,
  gdprArticles: articles.length,
  gdprRequirements: gdpr.requirements.length,
  dpdpClauses: dpdp.clauses.length,
  dpdpSections: sections.length,
  dpdpRequirements: dpdp.requirements.length,
}, null, 2));
console.log('regulatory source parse tests passed');
