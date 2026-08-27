# TopSqill SEO edge setup (SSR-substitute + www redirect + HTTP 404)

This repo is a **Vite SPA published via Lovable**. Search crawlers that do not run JavaScript still see an empty shell unless an edge layer serves pre-rendered HTML.

## Implemented vs hosting activation

| Audit theme | In repo | Needs ops |
|-------------|---------|-----------|
| Per-route meta, sitemap, absolute OG | Yes | Publish |
| JSON-LD (Organization, SoftwareApplication+Offer, FAQ, Breadcrumb, Article) | Yes | Publish |
| Pricing page (USD+INR) + blog + market hubs (`/in` `/ae` `/sa` `/sg` `/ar`) + hreflang | Yes | Publish |
| Build-time prerender HTML for bots | Yes (`npm run build`) | Cloudflare Worker |
| True HTTP 404 + www→apex 301 | Edge worker | Deploy worker + DNS |
| GA4 / GSC / Bing verification | Env-driven (`SiteAnalytics`) | Set secrets + GSC/Bing UI |
| Full Next.js SSR + WebP pipeline | Partial (prerender + lazy routes + font/LCP preload) | Optional later |

## Env vars (frontend)

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXX
VITE_GSC_VERIFICATION=google-site-verification-token
VITE_BING_VERIFICATION=bing-msvalidate-token
```

In GA4 Admin, create a **custom channel group** matching referrers: `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai` (the app also fires `ai_referral` events).

## Cloudflare Worker

1. Remove Lovable custom-domain claim for `topsqill.com` / `www`
2. Point DNS through Cloudflare (proxied)
3. `npm run build` then `cd seo/edge-worker && wrangler deploy`

```bash
curl -sI https://www.topsqill.com/pricing
curl -sA "Googlebot" https://topsqill.com/blog | head
curl -sI https://topsqill.com/no-such-page
```
