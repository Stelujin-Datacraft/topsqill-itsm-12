/** URL slug for each Solutions tab: /solutions/<slug> (and /<market>/solutions/<slug>). */
export const SOLUTION_SLUGS = {
  onboarding: 'employee-onboarding',
  grc: 'governance-risk-compliance',
  itsm: 'itsm',
  vendor: 'vendor-management',
  security: 'security',
  hr: 'hr',
} as const;

export type SolutionId = keyof typeof SOLUTION_SLUGS;

/** Earlier slugs that still resolve; the page redirects them to the current slug. */
const LEGACY_SLUGS: Record<string, SolutionId> = { grc: 'grc' };

export const SOLUTION_IDS = Object.keys(SOLUTION_SLUGS) as SolutionId[];

export const DEFAULT_SOLUTION_ID: SolutionId = 'onboarding';

export function isSolutionId(value: string | null | undefined): value is SolutionId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SOLUTION_SLUGS, value));
}

export function solutionIdFromSlug(slug: string | undefined): SolutionId | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  return SOLUTION_IDS.find((id) => SOLUTION_SLUGS[id] === normalized) ?? LEGACY_SLUGS[normalized] ?? null;
}

/** `/solutions/itsm`, or `/ae/solutions/itsm` when browsing a market. */
export function solutionPath(id: SolutionId, market?: string): string {
  return `${market ? `/${market}` : ''}/solutions/${SOLUTION_SLUGS[id]}`;
}
