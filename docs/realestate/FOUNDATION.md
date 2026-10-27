# Real Estate Lead Gen — Foundation (safety rules)

**Scope:** fully functional **lead generation** (profiles, listings, leads/CRM, ingest, enrich, dedupe, email follow-ups) **plus** optional **Real Estate Network** (feed, connections, messaging) behind a separate flag.  
**Network details:** [`NETWORK.md`](./NETWORK.md).

## Do-not-break rules

1. **Additive only.** New tables (`re_*`), Nest `ReModule`, FE `/re/*` routes. Do not alter `forms`, `form_fields`, `form_submissions`, `workflows`, or auth helpers unless a later ADR says otherwise.
2. **Soft links to the form engine.** Prefer nullable `form_id` / `form_submission_id` on `re_*` rows. Business records can later be *backed by* forms without rewriting core engines.
3. **Feature flags (fail closed on Prod).**
   - Backend: `RE_LEADGEN_ENABLED` (default: on in `ENVIRONMENT=development`, off in production).
   - Frontend: `VITE_RE_LEADGEN_ENABLED` (same defaults).
   - Network: `RE_NETWORK_ENABLED` / `VITE_RE_NETWORK_ENABLED` (same defaults; requires Lead Gen on).
4. **Nav/routes gated.** Sidebar and `/re` routes hidden when the Lead Gen flag is off so existing TopSqill UX is unchanged. Network shell extras hide when Network flag is off (CRM shell remains).
5. **No workflow executor edits in foundation.** SMS/WhatsApp actions come in a later PR as additive executors.
6. **Migrations are opt-in on VMs.** Applying SQL is a separate ops step; Nest availability reports `schemaReady: false` until tables exist.
7. **Do not edit prior RE migrations.** Network schema is a new migration file only.

## Slices

### Foundation (merged)
- Schema: `re_profiles`, `re_listings`, `re_leads`, `re_lead_activities` + RLS
- Nest: `/api/re/availability`, overview, lead list/create
- FE: gated shell (Dashboard, Leads, Listings, Profiles)

### CRM CRUD (merged)
- Profiles create/update
- Listings create/update (link owner profile)
- Leads: pipeline stage, assignee, linked listing, notes + timeline

### E2E sources + follow-ups (current)
- Webhooks: website, Meta, Google, LinkedIn, portals, call
- Source config UI, ingest audit, email follow-up jobs + cron
- Report: [`LEADGEN_E2E_REPORT.md`](./LEADGEN_E2E_REPORT.md)

See also: [`../realestate-integration-plan.md`](../realestate-integration-plan.md)
