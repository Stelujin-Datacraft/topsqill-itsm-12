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
  '/pricing',
  '/blog',
]);

function isPublicOrMarketPath(pathname) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/blog/')) return true;
  if (/^\/(in|ae|sa|sg|ar)(\/|$)/.test(pathname)) return true;
  return false;
}
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
  if (isPublicOrMarketPath(pathname)) return true;
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
  return `# TopSqill — single UA block; AI crawlers allowed.
User-agent: *
Allow: /

Disallow: /dashboard
Disallow: /build
Disallow: /forms
Disallow: /form-builder
Disallow: /workflows
Disallow: /reports
Disallow: /settings
Disallow: /users
Disallow: /projects
Disallow: /organizations
Disallow: /api/
Disallow: /auth
Disallow: /login
Disallow: /forgot-password
Disallow: /accept-invitation
Disallow: /change-password
Disallow: /signup-success

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

const DEFAULT_OG_IMAGE =
  `https://${APEX_DOMAIN}/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.png`;

/** Public anon key — same as the SPA; used only to read published blog meta for share previews. */
const SUPABASE_URL = 'https://fnmkczsvwpzpxyklztkt.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubWtjenN2d3B6cHh5a2x6dGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNzU1OTUsImV4cCI6MjA2NDg1MTU5NX0.bSLI8JUAIry3mC6cxBt5sF7r-gyelR63Emdoe7siNjQ';
const BLOG_BUCKETS = ['report-media', 'form-attachments', 'organization-logos', 'blog-media'];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteAssetUrl(pathOrUrl) {
  if (!pathOrUrl) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (String(pathOrUrl).startsWith('/')) return `https://${APEX_DOMAIN}${pathOrUrl}`;
  return pathOrUrl;
}

function blogSlugFromPath(pathname) {
  const m = pathname.match(/^(?:\/(?:in|ae|sa|sg|ar))?\/blog\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchBlogPostMeta(slug) {
  try {
    const restUrl =
      `${SUPABASE_URL}/rest/v1/blog_posts`
      + `?slug=eq.${encodeURIComponent(slug)}`
      + '&published=eq.true'
      + '&select=slug,title,description,cover_image_url,faqs'
      + '&limit=1';
    const res = await fetch(restUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  } catch {
    /* fall through to storage */
  }

  for (const bucket of BLOG_BUCKETS) {
    try {
      const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/blog/cms-posts.json`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const posts = await res.json();
      if (!Array.isArray(posts)) continue;
      const post = posts.find((p) => p && p.slug === slug && p.published);
      if (post) {
        return {
          slug: post.slug,
          title: post.title,
          description: post.description || '',
          cover_image_url: post.cover_image_url || null,
          faqs: Array.isArray(post.faqs) ? post.faqs : [],
        };
      }
    } catch {
      /* try next bucket */
    }
  }
  return null;
}

function applyShareMeta(html, { title, description, canonical, ogImage }) {
  let out = html;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description || '');
  const safeCanon = escapeHtml(canonical);
  const safeImage = escapeHtml(ogImage);

  if (/<title>[^<]*<\/title>/i.test(out)) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);
  }
  if (/name="description"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`,
    );
  }
  if (/rel="canonical"/i.test(out)) {
    out = out.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${safeCanon}" />`,
    );
  }
  if (/property="og:title"/i.test(out)) {
    out = out.replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`,
    );
  }
  if (/property="og:description"/i.test(out)) {
    out = out.replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`,
    );
  }
  if (/property="og:url"/i.test(out)) {
    out = out.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${safeCanon}" />`,
    );
  }
  if (/property="og:type"/i.test(out)) {
    out = out.replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:type" content="article" />`,
    );
  }
  if (/property="og:image"/i.test(out)) {
    out = out.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${safeImage}" />`,
    );
  } else {
    out = out.replace(
      '</head>',
      `    <meta property="og:image" content="${safeImage}" />\n  </head>`,
    );
  }
  if (/name="twitter:title"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`,
    );
  }
  if (/name="twitter:description"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${safeDesc}" />`,
    );
  }
  if (/name="twitter:image"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${safeImage}" />`,
    );
  } else {
    out = out.replace(
      '</head>',
      `    <meta name="twitter:image" content="${safeImage}" />\n  </head>`,
    );
  }
  if (/name="twitter:card"/i.test(out)) {
    out = out.replace(
      /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:card" content="summary_large_image" />`,
    );
  }
  return out;
}

function normalizeFaqs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    }))
    .filter((f) => f.question && f.answer);
}

function faqPageJsonLd(faqs) {
  const items = normalizeFaqs(faqs);
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

function injectFaqJsonLd(html, faqs) {
  const schema = faqPageJsonLd(faqs);
  if (!schema) return html;
  const script = `    <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  // Replace an existing FAQPage block if present, otherwise append before </head>
  if (/@type"\s*:\s*"FAQPage"/i.test(html) || /"@type":"FAQPage"/i.test(html)) {
    return html.replace(
      /<script\s+type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"FAQPage"[\s\S]*?\}\s*<\/script>/i,
      script,
    );
  }
  return html.replace('</head>', `${script}\n  </head>`);
}

async function serveBlogShareHtml(request, env, pathname, slug) {
  const post = await fetchBlogPostMeta(slug);
  const key = pathToPrerenderKey(pathname);
  let base = await serveAsset(env, key, 'text/html; charset=utf-8');
  if (!base) {
    // Fall back to SPA shell (has default OG tags we can rewrite)
    base = await fetchFromOrigin(request);
  }
  if (!base || !base.ok) return base;

  if (!post) return base;

  const html = await base.text();
  const title = `${post.title || 'Blog'} | TopSqill Blog`;
  const description = post.description || '';
  const canonical = `https://${APEX_DOMAIN}${pathname}`;
  const ogImage = absoluteAssetUrl(post.cover_image_url);
  let enriched = applyShareMeta(html, { title, description, canonical, ogImage });
  enriched = injectFaqJsonLd(enriched, post.faqs);

  const headers = new Headers(base.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=300');
  headers.set('x-topsqill-edge', 'blog-og');
  return new Response(enriched, { status: base.status, headers });
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

    // Bots on public / market / blog pages → prerendered HTML
    const ua = request.headers.get('user-agent') || '';
    if (isBot(ua) && isPublicOrMarketPath(pathname)) {
      const blogSlug = blogSlugFromPath(pathname);
      if (blogSlug) {
        const enriched = await serveBlogShareHtml(request, env, pathname, blogSlug);
        if (enriched) return enriched;
      }
      const key = pathToPrerenderKey(pathname);
      const prerendered = await serveAsset(env, key, 'text/html; charset=utf-8');
      if (prerendered) return prerendered;
    }

    return fetchFromOrigin(request);
  },
};
