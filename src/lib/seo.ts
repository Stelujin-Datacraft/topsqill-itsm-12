/** Site-wide SEO helpers and public marketing route metadata. */

export const SITE_ORIGIN = 'https://topsqill.com';

export const DEFAULT_OG_IMAGE_PATH =
  '/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png';

export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}${DEFAULT_OG_IMAGE_PATH}`;

export const DEFAULT_TITLE =
  'TopSqill BPM - Enterprise Form Platform with AI & Workflow Automation';

export const DEFAULT_DESCRIPTION =
  'Build, automate, and analyze enterprise forms with advanced workflows, SQL querying, and AI-powered insights. Trusted by 500+ organizations worldwide.';

export type PublicSeoEntry = {
  title: string;
  description: string;
  /** Include in sitemap.xml (public, indexable marketing pages only). */
  sitemap?: boolean;
};

/** Indexable public marketing pages — path → metadata. */
export const PUBLIC_ROUTE_SEO: Record<string, PublicSeoEntry> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    sitemap: true,
  },
  '/about': {
    title: 'About TopSqill — Enterprise automation platform',
    description:
      'Learn about TopSqill: an enterprise platform for forms, workflows, SQL analytics, knowledge, IT assets, and governed business automation.',
    sitemap: true,
  },
  '/contact': {
    title: 'Contact TopSqill — Talk to our team',
    description:
      'Get in touch with the TopSqill team by email or LinkedIn for demos, partnerships and enterprise support.',
    sitemap: true,
  },
  '/solutions': {
    title: 'Solutions | TopSqill',
    description:
      'Explore TopSqill solutions: Employee Onboarding, GRC, ITSM, Vendor Management, Information Security, and HR — all on one connected platform.',
    sitemap: true,
  },
  '/docs': {
    title: 'API Documentation — TopSqill',
    description:
      'TopSqill API documentation: authenticate, manage forms, submissions, workflows, and integrate enterprise automation with your stack.',
    sitemap: true,
  },
  '/privacy': {
    title: 'Privacy Policy — TopSqill',
    description:
      'How TopSqill collects, uses, stores and protects personal and organizational data across its enterprise automation platform.',
    sitemap: true,
  },
  '/terms': {
    title: 'Terms & Conditions — TopSqill',
    description:
      'The terms that govern use of the TopSqill enterprise automation platform, including accounts, acceptable use, data ownership and liability.',
    sitemap: true,
  },
};

/** Auth / invite flows — crawlable URL but should not rank. */
const NOINDEX_EXACT = new Set([
  '/auth',
  '/login',
  '/forgot-password',
  '/accept-invitation',
  '/change-password',
  '/auth/callback',
]);

const APP_PREFIXES = [
  '/dashboard',
  '/build',
  '/query',
  '/forms',
  '/form-builder',
  '/form-edit',
  '/form/',
  '/form-submissions',
  '/submission/',
  '/workflows',
  '/workflow-',
  '/workflow/',
  '/reports',
  '/dashboard-view',
  '/report-',
  '/report/',
  '/relationship-map',
  '/knowledge-base',
  '/policies',
  '/policy/',
  '/compliance',
  '/audit-programs',
  '/evidence-locker',
  '/users',
  '/roles-and-access',
  '/projects',
  '/organizations',
  '/settings',
  '/analytics-dashboard',
  '/data-table-builder',
  '/email-config',
  '/email-templates',
  '/data-feeds',
  '/profile',
  '/manage-sessions',
  '/audit-logs',
  '/form-audit-logs',
  '/investigate-access',
  '/ldap-settings',
  '/sla-management',
  '/record-delegations',
  '/api-integration',
  '/api-docs',
  '/it-assets',
  '/project-performance',
  '/public/form',
];

export function absoluteUrl(path: string): string {
  if (!path || path === '/') return SITE_ORIGIN;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export function absoluteAssetUrl(pathOrUrl: string | undefined | null): string {
  if (!pathOrUrl) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return absoluteUrl(pathOrUrl);
}

export function isNoIndexPath(pathname: string): boolean {
  if (NOINDEX_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/solutions/')) return true; // redirects to /solutions?tab=
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}

export function isKnownPublicPath(pathname: string): boolean {
  return Object.prototype.hasOwnProperty.call(PUBLIC_ROUTE_SEO, pathname);
}

export function sitemapPaths(): string[] {
  return Object.entries(PUBLIC_ROUTE_SEO)
    .filter(([, entry]) => entry.sitemap !== false)
    .map(([path]) => path)
    .sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });
}
