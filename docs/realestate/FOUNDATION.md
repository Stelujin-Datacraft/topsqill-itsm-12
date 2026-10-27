# Real Estate Lead Gen — Foundation (safety rules)

**Scope locked:** fully functional **lead generation** (profiles, listings, leads/CRM, ingest, email/SMS/WhatsApp follow-ups, AI campaigns).  
**Deferred:** LinkedIn-style network (connections, follows, feed, in-app social chat).

## Do-not-break rules

1. **Additive only.** New tables (`re_*`), Nest `ReModule`, FE `/re/*` routes. Do not alter `forms`, `form_fields`, `form_submissions`, `workflows`, or auth helpers unless a later ADR says otherwise.
2. **Soft links to the form engine.** Prefer nullable `form_id` / `form_submission_id` on `re_*` rows. Business records can later be *backed by* forms without rewriting core engines.
3. **Feature flags (fail closed on Prod).**
   - Backend: `RE_LEADGEN_ENABLED` (default: on in `ENVIRONMENT=development`, off in production).
   - Frontend: `VITE_RE_LEADGEN_ENABLED` (same defaults).
4. **Nav/routes gated.** Sidebar and `/re` routes hidden when the flag is off so existing TopSqill UX is unchanged.
5. **No workflow executor edits in foundation.** SMS/WhatsApp actions come in a later PR as additive executors.
6. **Migrations are opt-in on VMs.** Applying SQL is a separate ops step; Nest availability reports `schemaReady: false` until tables exist.

## First slice (this PR)

- Schema: `re_profiles`, `re_listings`, `re_leads`, `re_lead_activities` + RLS
- Nest: `/api/re/availability`, overview counts, basic lead list/create
- FE: gated shell (Dashboard, Leads, Listings, Profiles)
- Tests for access flags + controller availability

See also: [`../realestate-integration-plan.md`](../realestate-integration-plan.md)
