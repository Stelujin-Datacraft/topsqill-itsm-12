/**
 * TopSqill SEO edge gateway (Cloudflare Worker)
 *
 * - 301 www → apex (topsqill.com)
 * - Bots get build-time prerendered HTML (ASSETS)
 * - Unknown paths return HTTP 404
 * - Humans / app routes proxy to Lovable origin
 *
 * Deploy: see docs/SEO_EDGE_SETUP.md
 */

const BOT_UA =
  /Googlebot|Google-InspectionTool|AdsBot-Google|Google-Extended|Storebot-Google|GoogleOther|Bingbot|DuckDuckBot|DuckAssistBot|Slurp|YandexBot|Applebot|Applebot-Extended|PetalBot|Baiduspider/i;
const LLM_UA =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Meta-ExternalAgent|Meta-ExternalFetcher|Bytespider|CCBot|cohere-ai|Amazonbot|YouBot|DeepSeekBot|AI2Bot|Diffbot|ImagesiftBot|Omgilibot/i;
const SOCIAL_UA =
  /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot|Embedly/i;

function isBot(ua) {
  return BOT_UA.test(ua) || LLM_UA.test(ua) || SOCIAL_UA.test(ua);
}

const APEX_DOMAIN = 'topsqill.com';
const ORIGIN_HOST = 'topsqill-itsm-12.lovable.app';

const PUBLIC_PATHS = new Set([
  '/',
  '/about',
  '/contact',
  '/solutions',
  '/docs',
  '/privacy',
  '/terms',
]);

const SPA_EXACT = new Set([
  '/auth',
  '/login',
  '/forgot-password',
  '/accept-invitation',
  '/change-password',
  '/auth/callback',
]);

const SPA_PREFIXES = [
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
  '/solutions/',
];

const LLMS_TXT = `# TopSqill

> Enterprise form platform with AI-powered workflows, SQL querying, and governed automation.

TopSqill helps organizations build forms, automate approvals and workflows, query submission data with SQL, and run connected solutions for onboarding, ITSM, GRC, vendor management, security, and HR.

## Pages

- [Home](https://topsqill.com/): Product overview and platform capabilities
- [Solutions](https://topsqill.com/solutions): Industry and operational solution scenarios
- [About](https://topsqill.com/about): Company and platform overview
- [Contact](https://topsqill.com/contact): Talk to the TopSqill team
- [Docs](https://topsqill.com/docs): API documentation
- [Privacy](https://topsqill.com/privacy): Privacy policy
- [Terms](https://topsqill.com/terms): Terms & conditions
`;

function isAssetPath(pathname) {
  return (
    pathname.startsWith('/assets/')
    || pathname.startsWith('/lovable-uploads/')
    || pathname === '/favicon.ico'
    || pathname.startsWith('/~')
    || /\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|woff2?|ttf|eot|json|xml|txt)$/i.test(pathname)
  );
}

function isValidSpaPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (SPA_EXACT.has(pathname)) return true;
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/llms.txt') {
    return true;
  }
  return SPA_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}

function pathToPrerenderKey(pathname) {
  let p = pathname.split('?')[0].split('#')[0];
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/') return 'index.html';
  return `${p.replace(/^\//, '')}.html`;
}

async function fetchFromOrigin(request) {
  const url = new URL(request.url);
  url.hostname = ORIGIN_HOST;
  url.protocol = 'https:';

  const headers = new Headers(request.headers);
  headers.set('Host', ORIGIN_HOST);
  headers.set('X-Forwarded-Host', APEX_DOMAIN);

  const originRequest = new Request(url.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const response = await fetch(originRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('x-topsqill-edge', 'proxy');
  return newResponse;
}

async function serveAsset(env, key, contentType, status = 200) {
  if (!env.ASSETS) return null;
  const assetReq = new Request(`https://assets.local/${key}`);
  const res = await env.ASSETS.fetch(assetReq);
  if (!res.ok) return null;
  const headers = new Headers(res.headers);
  if (contentType) headers.set('content-type', contentType);
  headers.set('x-topsqill-edge', 'prerender');
  headers.set('cache-control', 'public, max-age=300');
  return new Response(res.body, { status, headers });
}

function robotsTxt() {
  return `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Allow: /

# Preferred host is non-www.
Sitemap: https://${APEX_DOMAIN}/sitemap.xml
`;
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page Not Found — TopSqill</title>
  <meta name="description" content="The page you requested could not be found on TopSqill." />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="canonical" href="https://${APEX_DOMAIN}/404" />
</head>
<body>
  <main>
    <h1>404 — Page not found</h1>
    <p>The page you requested does not exist on TopSqill.</p>
    <p><a href="/">Return to homepage</a></p>
  </main>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // www → apex 301
    if (url.hostname === `www.${APEX_DOMAIN}`) {
      const target = new URL(url);
      target.hostname = APEX_DOMAIN;
      return Response.redirect(target.toString(), 301);
    }

    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/robots.txt') {
      return new Response(robotsTxt(), {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=86400',
          'x-topsqill-edge': 'robots',
        },
      });
    }

    if (pathname === '/llms.txt') {
      return new Response(LLMS_TXT, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=86400',
          'x-topsqill-edge': 'llms',
        },
      });
    }

    if (pathname === '/sitemap.xml') {
      const fromAssets = await serveAsset(env, 'sitemap.xml', 'application/xml; charset=utf-8');
      if (fromAssets) return fromAssets;
    }

    // Static assets always proxy / pass through ASSETS then origin
    if (isAssetPath(pathname)) {
      return fetchFromOrigin(request);
    }

    // True HTTP 404 for unknown routes
    if (!isValidSpaPath(pathname)) {
      const prerendered404 = await serveAsset(env, '404.html', 'text/html; charset=utf-8', 404);
      if (prerendered404) return prerendered404;
      return new Response(notFoundHtml(), {
        status: 404,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-topsqill-edge': '404',
        },
      });
    }

    // Bots on public marketing pages → prerendered HTML
    const ua = request.headers.get('user-agent') || '';
    if (isBot(ua) && PUBLIC_PATHS.has(pathname)) {
      const key = pathToPrerenderKey(pathname);
      const prerendered = await serveAsset(env, key, 'text/html; charset=utf-8');
      if (prerendered) return prerendered;
    }

    return fetchFromOrigin(request);
  },
};
