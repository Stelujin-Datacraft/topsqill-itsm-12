#!/usr/bin/env node
/**
 * Post-build SEO generator:
 * 1) Injects crawlable HTML shells into dist/<route>/index.html (SSG-style)
 * 2) Writes dist/404.html with noindex
 * 3) Regenerates dist/sitemap.xml from src/seo/public-routes.json
 * 4) Syncs prerender HTML into seo/edge-worker/prerender for Cloudflare Assets
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const routesPath = path.join(root, 'src/seo/public-routes.json');
const workerPrerenderDir = path.join(root, 'seo/edge-worker/prerender');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadRoutes() {
  return JSON.parse(fs.readFileSync(routesPath, 'utf8'));
}

function absoluteUrl(origin, routePath) {
  if (!routePath || routePath === '/') return origin;
  return `${origin}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function absoluteAssetUrl(origin, pathOrUrl, fallback) {
  if (!pathOrUrl) return fallback;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return absoluteUrl(origin, pathOrUrl);
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

function injectJsonLd(html, objects) {
  const scripts = (objects || [])
    .filter(Boolean)
    .map((obj) => `    <script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');
  if (!scripts) return html;
  return html.replace('</head>', `${scripts}\n  </head>`);
}

function buildBody(route) {
  const sections = (route.sections || [])
    .map(
      (s) => `
    <section>
      <h2>${escapeHtml(s.heading)}</h2>
      <p>${escapeHtml(s.body)}</p>
    </section>`,
    )
    .join('\n');

  const faqItems = normalizeFaqs(route.faqs);
  const faqHtml = faqItems.length
    ? `
    <section id="faq">
      <h2>Frequently asked questions</h2>
      <dl>
        ${faqItems
          .map(
            (f) => `
        <div>
          <dt>${escapeHtml(f.question)}</dt>
          <dd>${escapeHtml(f.answer)}</dd>
        </div>`,
          )
          .join('\n')}
      </dl>
    </section>`
    : '';

  // #app-boot is a brief branded placeholder for humans (no raw SEO copy flash).
  // #seo-prerender stays in the DOM for crawlers but is visually hidden via #seo-boot-style.
  return `
  <div id="app-boot" aria-hidden="true">
    <img
      src="/lovable-uploads/7355d9d6-30ec-4b86-9922-9058a15f6cca.webp"
      alt=""
      width="48"
      height="48"
      decoding="async"
    />
  </div>
  <main id="seo-prerender" data-seo-path="${escapeHtml(route.path)}">
    <header>
      <p><a href="${escapeHtml(absoluteUrl('https://topsqill.com', '/'))}">TopSqill</a></p>
      <h1>${escapeHtml(route.h1)}</h1>
      <p>${escapeHtml(route.lede)}</p>
    </header>
    ${sections}
    ${faqHtml}
    <nav aria-label="Site">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/solutions">Solutions</a></li>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
        <li><a href="/docs">Docs</a></li>
        <li><a href="/in">India</a></li>
        <li><a href="/ae">UAE</a></li>
      </ul>
    </nav>
  </main>`;
}

const SEO_BOOT_STYLE = `
    <style id="seo-boot-style">
      #seo-prerender {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      #app-boot {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
      }
      #app-boot img {
        width: 48px;
        height: 48px;
        object-fit: contain;
      }
    </style>`;

function ensureBootStyle(html) {
  if (/id="seo-boot-style"/i.test(html)) return html;
  return html.replace('</head>', `${SEO_BOOT_STYLE}\n  </head>`);
}

function applyMeta(html, { title, description, canonical, ogImage, noindex = false }) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  if (/rel="canonical"/i.test(out)) {
    out = out.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    );
  } else {
    out = out.replace(
      '</head>',
      `    <link rel="canonical" href="${escapeHtml(canonical)}" />\n  </head>`,
    );
  }
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
  );

  if (noindex) {
    if (/name="robots"/i.test(out)) {
      out = out.replace(
        /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="robots" content="noindex, nofollow" />`,
      );
    } else {
      out = out.replace(
        '</head>',
        `    <meta name="robots" content="noindex, nofollow" />\n  </head>`,
      );
    }
  }
  return out;
}

function injectRootContent(html, bodyInner) {
  // Place crawlable content inside #root so non-JS crawlers see it.
  // React createRoot replaces this when the SPA boots for humans.
  if (/<div id="root"><\/div>/i.test(html)) {
    return html.replace(
      /<div id="root"><\/div>/i,
      `<div id="root">${bodyInner}</div>`,
    );
  }
  if (/<div id="root">[\s\S]*?<\/div>/i.test(html)) {
    return html.replace(
      /<div id="root">[\s\S]*?<\/div>/i,
      `<div id="root">${bodyInner}</div>`,
    );
  }
  return html.replace('</body>', `${bodyInner}\n  </body>`);
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function expandRoutes(cfg) {
  const posts = JSON.parse(
    fs.readFileSync(path.join(root, 'src/content/blog/posts.json'), 'utf8'),
  );
  const markets = JSON.parse(
    fs.readFileSync(path.join(root, 'src/content/markets.json'), 'utf8'),
  );

  const expanded = [...cfg.routes];

  for (const post of posts) {
    expanded.push({
      path: `/blog/${post.slug}`,
      title: `${post.title} | TopSqill Blog`,
      description: post.description,
      h1: post.title,
      lede: post.description,
      ogImage: post.coverImageUrl || undefined,
      faqs: normalizeFaqs(post.faqs),
      sections: post.body.map((p, i) => ({
        heading: i === 0 ? `By ${post.authorName}` : `Section ${i + 1}`,
        body: p,
      })),
      sitemap: true,
      priority: '0.6',
      changefreq: 'monthly',
    });
  }

  for (const market of markets) {
    expanded.push({
      path: `/${market.code}`,
      title: `${market.headline} | TopSqill`,
      description: market.lede,
      h1: market.headline,
      lede: market.lede,
      sections: [
        { heading: market.name, body: market.localeHint },
        { heading: 'Pricing', body: market.currencyNote },
      ],
      sitemap: true,
      priority: '0.8',
      changefreq: 'weekly',
    });
    for (const base of cfg.routes) {
      if (base.path === '/') continue;
      expanded.push({
        ...base,
        path: `/${market.code}${base.path}`,
        title: `${base.title} (${market.name})`,
      });
    }
    for (const post of posts) {
      expanded.push({
        path: `/${market.code}/blog/${post.slug}`,
        title: `${post.title} | TopSqill Blog`,
        description: post.description,
        h1: post.title,
        lede: post.description,
        ogImage: post.coverImageUrl || undefined,
        faqs: normalizeFaqs(post.faqs),
        sections: post.body.map((p, i) => ({
          heading: i === 0 ? `By ${post.authorName}` : `Section ${i + 1}`,
          body: p,
        })),
        sitemap: true,
        priority: '0.5',
        changefreq: 'monthly',
      });
    }
  }

  return expanded;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSitemapXml(routes, siteOrigin, lastmodIso) {
  const lastmod = lastmodIso || new Date().toISOString().slice(0, 10);
  const urls = routes
    .filter((r) => r.sitemap !== false)
    .sort((a, b) => {
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      return a.path.localeCompare(b.path);
    })
    .map((r) => {
      const loc = absoluteUrl(siteOrigin, r.path);
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${escapeXml(r.changefreq || 'monthly')}</changefreq>
    <priority>${escapeXml(r.priority || '0.5')}</priority>
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** Plain URL list (one per line) for Google Search Console / QA. */
function buildSitemapUrlList(routes, siteOrigin) {
  return routes
    .filter((r) => r.sitemap !== false)
    .sort((a, b) => {
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      return a.path.localeCompare(b.path);
    })
    .map((r) => absoluteUrl(siteOrigin, r.path))
    .join('\n') + '\n';
}

function writeSitemapArtifacts(routes, cfg) {
  const sitemap = buildSitemapXml(routes, cfg.siteOrigin);
  const urlList = buildSitemapUrlList(routes, cfg.siteOrigin);
  fs.mkdirSync(workerPrerenderDir, { recursive: true });
  writeFile(path.join(workerPrerenderDir, 'sitemap.xml'), sitemap);
  writeFile(path.join(root, 'public/sitemap.xml'), sitemap);
  writeFile(path.join(root, 'public/sitemap-urls.txt'), urlList);
  if (fs.existsSync(distDir)) {
    writeFile(path.join(distDir, 'sitemap.xml'), sitemap);
    writeFile(path.join(distDir, 'sitemap-urls.txt'), urlList);
  }
  const count = routes.filter((r) => r.sitemap !== false).length;
  console.log(`[seo] sitemap.xml + sitemap-urls.txt (${count} URLs) → public/ & edge-worker`);
  return count;
}

function build404Html(template, cfg) {
  const body = `
  <main id="seo-prerender">
    <h1>404 — Page not found</h1>
    <p>The page you requested does not exist on TopSqill.</p>
    <p><a href="/">Return to homepage</a></p>
  </main>`;
  let html = applyMeta(template, {
    title: 'Page Not Found — TopSqill',
    description: 'The page you requested could not be found on TopSqill.',
    canonical: `${cfg.siteOrigin}/404`,
    ogImage: cfg.defaultOgImage,
    noindex: true,
  });
  html = injectRootContent(html, body);
  return html;
}

function main() {
  const cfg = loadRoutes();
  const routes = expandRoutes(cfg);
  const sitemapOnly = process.argv.includes('--sitemap-only');

  if (sitemapOnly) {
    writeSitemapArtifacts(routes, cfg);
    return;
  }

  const hasDist = fs.existsSync(distDir);
  const templatePath = hasDist
    ? path.join(distDir, 'index.html')
    : path.join(root, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.error('[seo] No index.html found (run vite build first for dist output).');
    process.exit(1);
  }

  const template = ensureBootStyle(fs.readFileSync(templatePath, 'utf8'));
  fs.mkdirSync(workerPrerenderDir, { recursive: true });

  for (const route of routes) {
    const canonical = absoluteUrl(cfg.siteOrigin, route.path);
    const ogImage = absoluteAssetUrl(cfg.siteOrigin, route.ogImage, cfg.defaultOgImage);
    let html = applyMeta(template, {
      title: route.title,
      description: route.description,
      canonical,
      ogImage,
    });
    html = injectRootContent(html, buildBody(route));
    html = injectJsonLd(html, [faqPageJsonLd(route.faqs)]);

    const workerKey = route.path === '/' ? 'index.html' : `${route.path.replace(/^\//, '')}.html`;
    writeFile(path.join(workerPrerenderDir, workerKey), html);

    if (hasDist) {
      if (route.path === '/') {
        writeFile(path.join(distDir, 'index.html'), html);
      } else {
        const rel = route.path.replace(/^\//, '');
        writeFile(path.join(distDir, rel, 'index.html'), html);
      }
    }
    console.log(`[seo] prerender ${route.path}`);
  }

  const count = writeSitemapArtifacts(routes, cfg);
  const notFound = build404Html(template, cfg);
  writeFile(path.join(workerPrerenderDir, '404.html'), notFound);
  if (hasDist) {
    writeFile(path.join(distDir, '404.html'), notFound);
  }

  console.log(`[seo] Wrote ${routes.length} prerender pages, 404.html, sitemap (${count} URLs).`);
}

main();
