import { stripMarketPrefix } from '@/lib/seo';

/** In-page landing sections that also have dedicated path routes (no hash). */
export const LANDING_SECTION_ROUTES = [
  'features',
  'showcase',
  'roadmap',
  'investors',
  'faq',
] as const;

export type LandingSectionRoute = (typeof LANDING_SECTION_ROUTES)[number];

export type MarketingNavItem = {
  /** Path without market prefix, e.g. `/features` */
  path: string;
  /** i18n key under `nav.*`, or null when using `fallbackLabel` only */
  labelKey: string | null;
  fallbackLabel: string;
  /** DOM id on the home page used for scroll-into-view */
  sectionId?: LandingSectionRoute;
};

export const MARKETING_NAV_ITEMS: MarketingNavItem[] = [
  { path: '/features', labelKey: 'nav.features', fallbackLabel: 'Features', sectionId: 'features' },
  { path: '/showcase', labelKey: 'nav.showcase', fallbackLabel: 'Showcase', sectionId: 'showcase' },
  { path: '/solutions', labelKey: 'nav.solutions', fallbackLabel: 'Solutions' },
  { path: '/pricing', labelKey: 'nav.pricing', fallbackLabel: 'Pricing' },
  { path: '/blog', labelKey: null, fallbackLabel: 'Blog' },
  { path: '/roadmap', labelKey: 'nav.roadmap', fallbackLabel: 'Roadmap', sectionId: 'roadmap' },
  { path: '/investors', labelKey: 'nav.investors', fallbackLabel: 'Investors', sectionId: 'investors' },
  { path: '/faq', labelKey: 'nav.faq', fallbackLabel: 'FAQ', sectionId: 'faq' },
  { path: '/about', labelKey: null, fallbackLabel: 'About Us' },
  { path: '/contact', labelKey: null, fallbackLabel: 'Contact' },
];

export function isLandingSectionRoute(segment: string): segment is LandingSectionRoute {
  return (LANDING_SECTION_ROUTES as readonly string[]).includes(segment);
}

/** Market-prefixed href for a marketing path (`/features` → `/in/features`). */
export function marketingHref(path: string, pathname: string): string {
  const { market } = stripMarketPrefix(pathname);
  const base = market ? `/${market}` : '';
  if (path === '/') return base || '/';
  return `${base}${path}`;
}

/** True when the current URL should highlight this nav item. */
export function isMarketingNavActive(itemPath: string, pathname: string): boolean {
  const { rest: stripped } = stripMarketPrefix(pathname);
  if (itemPath === '/') return stripped === '/' || stripped === '';
  if (itemPath === '/blog') {
    return stripped === '/blog' || stripped.startsWith('/blog/');
  }
  if (itemPath === '/solutions') {
    return stripped === '/solutions' || stripped.startsWith('/solutions/');
  }
  return stripped === itemPath || stripped.startsWith(`${itemPath}/`);
}

/** If pathname is a landing section route, return its section id for scrolling. */
export function landingSectionFromPath(pathname: string): LandingSectionRoute | null {
  const { rest: stripped } = stripMarketPrefix(pathname);
  const segment = stripped.replace(/^\//, '').split('/')[0] || '';
  return isLandingSectionRoute(segment) ? segment : null;
}
