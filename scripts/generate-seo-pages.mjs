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

  return `
  <main id="seo-prerender" data-seo-path="${escapeHtml(route.path)}">
    <header>
      <p><a href="${escapeHtml(absoluteUrl('https://topsqill.com', '/'))}">TopSqill</a></p>
      <h1>${escapeHtml(route.h1)}</h1>
      <p>${escapeHtml(route.lede)}</p>
    </header>
    ${sections}
    <nav aria-label="Site">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/solutions">Solutions</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
        <li><a href="/docs">Docs</a></li>
      </ul>
    </nav>
  </main>`;
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

function buildSitemapXml(cfg) {
  const urls = cfg.routes
    .filter((r) => r.sitemap !== false)
    .map((r) => {
      const loc = absoluteUrl(cfg.siteOrigin, r.path);
      return `  <url>
    <loc>${loc}</loc>
    <changefreq>${r.changefreq || 'monthly'}</changefreq>
    <priority>${r.priority || '0.5'}</priority>
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
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
  const hasDist = fs.existsSync(distDir);
  const templatePath = hasDist
    ? path.join(distDir, 'index.html')
    : path.join(root, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.error('[seo] No index.html found (run vite build first for dist output).');
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  fs.mkdirSync(workerPrerenderDir, { recursive: true });

  for (const route of cfg.routes) {
    const canonical = absoluteUrl(cfg.siteOrigin, route.path);
    let html = applyMeta(template, {
      title: route.title,
      description: route.description,
      canonical,
      ogImage: cfg.defaultOgImage,
    });
    html = injectRootContent(html, buildBody(route));

    // Worker asset key: index.html or about.html etc.
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
    console.log(`[seo] prerender ${route.path} → ${workerKey}`);
  }

  const notFound = build404Html(template, cfg);
  writeFile(path.join(workerPrerenderDir, '404.html'), notFound);
  if (hasDist) {
    writeFile(path.join(distDir, '404.html'), notFound);
    writeFile(path.join(distDir, 'sitemap.xml'), buildSitemapXml(cfg));
  }
  // Always refresh public/sitemap.xml source of truth for Lovable static publish
  writeFile(path.join(root, 'public/sitemap.xml'), buildSitemapXml(cfg));
  writeFile(path.join(workerPrerenderDir, 'sitemap.xml'), buildSitemapXml(cfg));

  console.log('[seo] Wrote 404.html, sitemap.xml, and edge-worker prerender assets.');
}

main();
