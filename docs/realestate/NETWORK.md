# TopSqill Real Estate Network — Implementation Plan

**Status:** Foundation vertical slice (in progress)  
**Safety:** Additive `re_*` only. Existing Lead Gen CRM / ingest / enrich / dedupe **unchanged**.  
**Visual reference:** LinkedIn-style three-column desktop shell (inspiration, not a clone).

## Audit summary (existing TopSqill)

| Capability | Reuse |
|------------|--------|
| Auth / org tenancy | Supabase Auth + Nest `SupabaseAuthGuard` + org membership |
| Forms / submissions | Soft-link via nullable `form_id` / `form_submission_id` (no engine edits) |
| Workflows / cron | Existing Nest cron; RE follow-ups already hooked |
| Dashboards / reports | Link out to existing engines; CRM metrics stay on `re_*` |
| Storage | Supabase Storage buckets (reuse pattern; network media paths TBD) |
| Realtime | Supabase Realtime preferred for messages; polling fallback |
| Lead Gen (shipped) | Profiles, listings, leads, sources, Meta enrich, normalise, dedupe |

**Conflict resolved:** Social graph cannot be “forms only.” New `re_posts` / connections / messaging tables; CRM continues on `re_leads`.

## Feature flags (fail closed on Prod)

| Flag | Role |
|------|------|
| `RE_LEADGEN_ENABLED` | Master RE module (existing) |
| `RE_NETWORK_ENABLED` / `VITE_RE_NETWORK_ENABLED` | Social shell, feed, network, messaging |
| Existing `RE_LEADGEN_META_ENRICH` / `RE_LEADGEN_DEDUPE` | Unchanged |

Network requires Lead Gen master flag on. When Network is off, `/re` keeps the current CRM shell.

## Schema (new migration only)

- Extend `re_profiles` with social fields (headline, bio, cover, avatar, location, service areas, visibility).
- `re_posts`, `re_post_media`, `re_post_reactions`, `re_comments`
- `re_connections`, `re_follows`
- `re_conversations`, `re_conversation_members`, `re_messages`
- `re_notifications`
- `re_listing_media` (gallery for marketplace cards)
- Soft FKs only; RLS org-scoped + author membership checks

## Vertical slice (this PR) — implemented

1. LinkedIn-inspired app shell (top nav + 3-column home) when `RE_NETWORK_ENABLED`.
2. Feed: create text posts, list, react, comment (`/re/home`).
3. Network: search profiles, connect / accept, message (`/re/network`).
4. Messaging drawer + full inbox (`/re/messages`) with polling.
5. Properties marketplace view over existing `re_listings` (`/re/properties`).
6. Public profile page with editable social fields (`/re/u/:id`).
7. Notifications center (`/re/notifications`).
8. CRM routes preserved (`/re/leads|listings|profiles|sources`) and linked from nav.
9. Migration `20261027150000_re_network_social.sql` (additive only).

When Network flag is **off**, the previous CRM-only shell remains unchanged.

## Deferred / credentials required

- WhatsApp Business API (connection UI stub only)
- Live Meta/Google/99acres beyond existing Lead Gen adapters
- Full kanban pipeline redesign (CRM stages already exist)
- SEO public marketplace pages
- Video processing / CDN transforms

## Do-not-break

- No edits to forms / workflows / auth helpers.
- No edits to prior RE migrations.
- Nav/routes for Network hidden when flag off.
