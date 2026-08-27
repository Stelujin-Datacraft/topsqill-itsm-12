/** Site-wide SEO helpers — route copy lives in seo/public-routes.json */

import publicRoutes from '@/seo/public-routes.json';
import { BLOG_POSTS } from '@/content/blog/posts';
import { MARKETS, isMarketCode, type MarketCode } from '@/content/markets';

export const SITE_ORIGIN = publicRoutes.siteOrigin as string;
export const APEX_DOMAIN = publicRoutes.apexDomain as string;
export const LOVABLE_ORIGIN = publicRoutes.lovableOrigin as string;

export const DEFAULT_OG_IMAGE = publicRoutes.defaultOgImage as string;
export const DEFAULT_OG_IMAGE_PATH = DEFAULT_OG_IMAGE.replace(SITE_ORIGIN, '') ||
  '/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png';

export type PublicRouteJson = {
  path: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  sections: Array<{ heading: string; body: string }>;
  sitemap?: boolean;
  priority?: string;
  changefreq?: string;
};

export const PUBLIC_ROUTES = publicRoutes.routes as PublicRouteJson[];

export const DEFAULT_TITLE =
  PUBLIC_ROUTES.find((r) => r.path === '/')?.title
  || 'TopSqill BPM - Enterprise Form Platform with AI & Workflow Automation';

export const DEFAULT_DESCRIPTION =
  PUBLIC_ROUTES.find((r) => r.path === '/')?.description
  || 'Build, automate, and analyze enterprise forms with advanced workflows, SQL querying, and AI-powered insights.';

export type PublicSeoEntry = {
  title: string;
  description: string;
  sitemap?: boolean;
};

function buildPublicSeoMap(): Record<string, PublicSeoEntry> {
  const map: Record<string, PublicSeoEntry> = Object.fromEntries(
    PUBLIC_ROUTES.map((r) => [
      r.path,
      { title: r.title, description: r.description, sitemap: r.sitemap !== false },
    ]),
  );

  for (const post of BLOG_POSTS) {
    map[`/blog/${post.slug}`] = {
      title: `${post.title} | TopSqill Blog`,
      description: post.description,
      sitemap: true,
    };
  }

  for (const market of MARKETS) {
    map[`/${market.code}`] = {
      title: `${market.headline} | TopSqill`,
      description: market.lede,
      sitemap: true,
    };
    for (const r of PUBLIC_ROUTES) {
      if (r.path === '/') continue;
      map[`/${market.code}${r.path}`] = {
        title: `${r.title} (${market.name})`,
        description: r.description,
        sitemap: true,
      };
    }
    for (const post of BLOG_POSTS) {
      map[`/${market.code}/blog/${post.slug}`] = {
        title: `${post.title} | TopSqill Blog`,
        description: post.description,
        sitemap: true,
      };
    }
  }

  return map;
}

/** Indexable public marketing pages — path → metadata. */
export const PUBLIC_ROUTE_SEO: Record<string, PublicSeoEntry> = buildPublicSeoMap();

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
  if (pathname.startsWith('/solutions/')) return true;
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}

export function isKnownPublicPath(pathname: string): boolean {
  return Object.prototype.hasOwnProperty.call(PUBLIC_ROUTE_SEO, pathname);
}

export type ResolvedPublicSeo = {
  title: string;
  description: string;
  /** Path without market prefix — used for hreflang pairing */
  hreflangPath: string;
  market?: MarketCode;
};

export function stripMarketPrefix(pathname: string): { market?: MarketCode; rest: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length && isMarketCode(parts[0])) {
    const restParts = parts.slice(1);
    const rest = restParts.length ? `/${restParts.join('/')}` : '/';
    return { market: parts[0], rest };
  }
  return { rest: pathname.replace(/\/$/, '') || '/' };
}

export function resolvePublicSeo(pathname: string): ResolvedPublicSeo | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const entry = PUBLIC_ROUTE_SEO[normalized];
  if (!entry) return null;
  const { market, rest } = stripMarketPrefix(normalized);
  return {
    title: entry.title,
    description: entry.description,
    hreflangPath: rest,
    market,
  };
}

export function sitemapPaths(): string[] {
  return Object.entries(PUBLIC_ROUTE_SEO)
    .filter(([, e]) => e.sitemap !== false)
    .map(([path]) => path)
    .sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });
}

/** True when the edge worker should proxy the SPA (valid app or public path). */
export function isValidSpaPath(pathname: string): boolean {
  if (isKnownPublicPath(pathname)) return true;
  if (NOINDEX_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/solutions/')) return true;
  if (pathname.startsWith('/blog')) return true;
  if (/^\/(in|ae|sa|sg|ar)(\/|$)/.test(pathname)) return true;
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/llms.txt') {
    return true;
  }
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}
