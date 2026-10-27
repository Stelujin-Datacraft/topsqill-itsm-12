export const RE_PROFILE_TYPES = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller / Owner' },
  { value: 'dealer', label: 'Dealer / Broker' },
  { value: 'builder', label: 'Builder / Developer' },
] as const;

export const RE_LISTING_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'under_offer', label: 'Under offer' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
  { value: 'archived', label: 'Archived' },
] as const;

export const RE_LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'site_visit', label: 'Site visit' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'archived', label: 'Archived' },
] as const;

export const RE_LISTING_KINDS = [
  { value: 'property', label: 'Property' },
  { value: 'project', label: 'Builder project' },
] as const;

export const RE_LISTING_TYPES = [
  { value: 'sale', label: 'Sale' },
  { value: 'rent', label: 'Rent' },
] as const;
