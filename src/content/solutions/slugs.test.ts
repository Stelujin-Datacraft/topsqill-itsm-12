/**
 * Run: npx tsx --tsconfig tsconfig.app.json src/content/solutions/slugs.test.ts
 */
import assert from 'node:assert/strict';
import { SOLUTION_IDS, isSolutionId, solutionIdFromSlug, solutionPath } from '@/content/solutions/slugs';
import { isKnownPublicPath, isNoIndexPath, isValidSpaPath, sitemapPaths } from '@/lib/seo';

assert.equal(solutionPath('itsm'), '/solutions/itsm');
assert.equal(solutionPath('onboarding'), '/solutions/employee-onboarding');
assert.equal(solutionPath('vendor', 'ae'), '/ae/solutions/vendor-management');

for (const id of SOLUTION_IDS) {
  const slug = solutionPath(id).split('/').pop();
  assert.equal(solutionIdFromSlug(slug), id, `slug for ${id} round-trips`);
  assert.ok(isKnownPublicPath(solutionPath(id)), `${id} has SEO metadata`);
  assert.ok(isKnownPublicPath(solutionPath(id, 'ae')), `${id} has market SEO metadata`);
  assert.equal(isNoIndexPath(solutionPath(id)), false, `${id} is indexable`);
  assert.ok(sitemapPaths().includes(solutionPath(id)), `${id} is in the sitemap`);
}

assert.equal(solutionPath('grc'), '/solutions/governance-risk-compliance');
assert.equal(solutionIdFromSlug('GOVERNANCE-RISK-COMPLIANCE'), 'grc');
assert.equal(solutionIdFromSlug('grc'), 'grc', 'old GRC slug still resolves');
assert.ok(!isKnownPublicPath('/solutions/grc'), 'old GRC slug is not a separate SEO page');
assert.equal(solutionIdFromSlug('vendor'), null, 'tab ids are not slugs');
assert.equal(solutionIdFromSlug('unknown'), null);
assert.equal(solutionIdFromSlug(undefined), null);
assert.ok(isSolutionId('vendor'));
assert.ok(!isSolutionId('vendor-management'));
assert.ok(!isSolutionId('toString'));

assert.equal(isNoIndexPath('/solutions/unknown'), true, 'unknown solution slugs stay noindex');
assert.ok(isValidSpaPath('/solutions/unknown'));

console.log('solution slug tests passed');
