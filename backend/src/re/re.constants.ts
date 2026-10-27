export const RE_PROFILE_TYPES = ['buyer', 'seller', 'dealer', 'builder'] as const;
export type ReProfileType = (typeof RE_PROFILE_TYPES)[number];

export const RE_LISTING_STATUSES = [
  'draft',
  'active',
  'under_offer',
  'sold',
  'rented',
  'archived',
] as const;
export type ReListingStatus = (typeof RE_LISTING_STATUSES)[number];

export const RE_LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'site_visit',
  'negotiation',
  'won',
  'lost',
  'archived',
] as const;
export type ReLeadStatus = (typeof RE_LEAD_STATUSES)[number];

export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
