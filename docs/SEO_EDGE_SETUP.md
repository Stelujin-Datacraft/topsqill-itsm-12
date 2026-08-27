# TopSqill SEO edge setup (SSR-substitute + www redirect + HTTP 404)

This repo is a **Vite SPA published via Lovable**. Search crawlers that do not run JavaScript still see an empty shell unless an edge layer serves pre-rendered HTML.

The remaining SEO audit items are implemented as:

| Item | Implementation |
|------|----------------|
| CSR → crawlable HTML | Build-time prerender (`npm run build` → `scripts/generate-seo-pages.mjs`) + Cloudflare Worker serves those pages to bots |
| True HTTP 404 | Edge worker returns **status 404** for unknown paths |
| www → non-www 301 | Edge worker redirects `www.topsqill.com` → `topsqill.com` |

## What ships in the repo

- `src/seo/public-routes.json` — public page titles, descriptions, and prerender copy
- `scripts/generate-seo-pages.mjs` — writes `dist/<route>/index.html`, `dist/404.html`, and `seo/edge-worker/prerender/*`
- `seo/edge-worker/` — Cloudflare Worker (`topsqill-seo-edge`)

## One-time Cloudflare activation

Lovable’s custom-domain integration can intercept traffic before a Worker route runs. Follow this order:

1. Create a Cloudflare account and add **topsqill.com** (update nameservers at your registrar).
2. In **Lovable → Settings → Domains**, remove custom domains for `topsqill.com` / `www` (keep `topsqill-itsm-12.lovable.app` as the upstream origin).
3. In Cloudflare DNS (proxied / orange cloud):
   - `topsqill.com` CNAME → `topsqill-itsm-12.lovable.app` (or Worker Custom Domain once attached)
   - `www` CNAME → `topsqill-itsm-12.lovable.app` (Worker will 301 to apex)
4. Install and log in:

```bash
npm i -g wrangler
wrangler login
cd seo/edge-worker
```

5. Generate prerender assets (from repo root):

```bash
npm run build
# or without a full Vite build:
node scripts/generate-seo-pages.mjs
```

6. Edit `seo/edge-worker/wrangler.toml`: set `account_id`, uncomment `routes`, set `workers_dev = false`.

7. Deploy:

```bash
cd seo/edge-worker
wrangler deploy
```

8. Verify:

```bash
# www redirect
curl -sI https://www.topsqill.com/about | head -n 5

# bot prerender (should include page H1 in raw HTML)
curl -sA "Googlebot" https://topsqill.com/about | head -n 40

# true 404
curl -sI https://topsqill.com/this-page-does-not-exist | head -n 5
```

Expect: `301` for www, prerender HTML for Googlebot on public pages, `404` for unknown paths.

## Without Cloudflare

- Build still emits `dist/about/index.html` (etc.) and `dist/404.html` for hosts that serve directory indexes / custom 404 pages.
- Lovable’s default SPA publish **cannot** emit true HTTP 404 or www 301 by itself — the edge worker is required for those two audit items on the live domain.

## Updating prerender copy

Edit `src/seo/public-routes.json`, then run `npm run build` (or `npm run seo:prerender`) and redeploy the worker.
