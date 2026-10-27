# Real Estate Lead Generation — End-to-End Report

**Product scope:** Full lead generation (profiles, listings, CRM, multi-source ingest, email follow-ups).  
**Deferred:** LinkedIn-style social network (connections / feed / chat).  
**Safety:** Additive `re_*` module only — Forms, Workflows, Access Control engines unchanged.  
**Feature flags:** `RE_LEADGEN_ENABLED` / `VITE_RE_LEADGEN_ENABLED` (on by default in Dev, off in Prod unless set).

---

## 1. What was created

### Database (Supabase migrations)

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/20261027120000_re_leadgen_foundation.sql` | `re_profiles`, `re_listings`, `re_leads`, `re_lead_activities` + RLS |
| `supabase/migrations/20261027130000_re_leadgen_ingest_followups.sql` | `re_lead_source_configs`, `re_ingest_events`, `re_follow_up_rules`, `re_follow_up_jobs` + RLS |

### Nest backend (`backend/src/re/`)

| Piece | Role |
|-------|------|
| `re.module.ts` | Wires CRM + ingest + follow-ups (+ EmailModule) |
| `re.service.ts` | Profiles / listings / leads CRM CRUD |
| `re-providers.ts` | Payload normalizers (website, Meta, Google, LinkedIn, portals, call) |
| `re-ingest.service.ts` | Source configs, webhook auth, accept → `re_leads` |
| `re-ingest.controller.ts` | **Public** webhook HTTP endpoints |
| `re-followup.service.ts` | Rules, schedule jobs, send via org SMTP |
| `re-sources.controller.ts` | Authenticated Sources / events / follow-up admin APIs |
| Cron `processReFollowups` | Every minute, processes due email jobs |

### Frontend (`src/pages/re/`, `src/lib/re/`)

| Route | UI |
|-------|----|
| `/re` | Dashboard counts |
| `/re/leads` | Lead inbox + stage / assignee / listing / notes / timeline |
| `/re/listings` | Property / project inventory CRUD |
| `/re/profiles` | Buyer / Seller / Dealer / Builder CRUD |
| `/re/sources` | Enable sources, copy webhook URLs & keys, test ingest, follow-up rule, event/job logs |

Sidebar shows **Real Estate** when the FE flag is on.

### Docs

- `docs/realestate-integration-plan.md` — architecture / reuse map  
- `docs/realestate/FOUNDATION.md` — safety rules  
- `docs/realestate/LEADGEN_E2E_REPORT.md` — this report  

---

## 2. How end-to-end lead flow works

```
External source (website / Meta / Google / LinkedIn / portal / call)
        │
        ▼
POST /api/re/ingest/<provider>/<webhook_path_token>
   (+ X-Re-Ingest-Key or Meta verify_token)
        │
        ▼
Normalizer (re-providers.ts) → contact name/email/phone + raw_payload
        │
        ▼
Insert re_leads  +  re_ingest_events(status=accepted)
        │
        ▼
Schedule re_follow_up_jobs (if rule enabled + lead has email)
        │
        ▼
Cron / manual "Process due follow-ups"
        │
        ▼
EmailService (org SMTP) → re_lead_activities(type=email)
        │
        ▼
CRM UI /re/leads  (stage, assign, notes, timeline)
```

Manual leads created in the CRM UI use the same `createLead` path and also schedule follow-ups.

---

## 3. Source integrations — how to connect

Open **Real Estate → Sources**, click ensure/load (automatic), then for each provider:

1. Toggle **On**  
2. Copy **Webhook URL** and **Ingest key** (Meta also uses **Verify token**)  
3. Paste into the external console  
4. Use **Send test lead** to verify without the external network  

| Provider | Endpoint pattern | Auth |
|----------|------------------|------|
| Website | `POST /api/re/ingest/website/:pathToken` | Header `X-Re-Ingest-Key` or `?key=` |
| Meta | `GET` verify + `POST /api/re/ingest/meta/:pathToken` | `hub.verify_token` on GET |
| Google Ads | `POST /api/re/ingest/google_ads/:pathToken` | Ingest key |
| LinkedIn | `POST /api/re/ingest/linkedin/:pathToken` | Ingest key |
| 99acres / MagicBricks / Housing | `POST /api/re/ingest/portal_*:pathToken` | Ingest key |
| Portal email parse | `POST /api/re/ingest/portal_email/:pathToken` | Ingest key; body `{ subject, body, from_email… }` |
| Call | `POST /api/re/ingest/call/:pathToken` | Ingest key |

**Website JSON example**

```json
{
  "name": "Priya Shah",
  "email": "priya@example.com",
  "phone": "+919876543210",
  "message": "Interested in 3BHK Andheri"
}
```

**You still must create** Meta / Google / LinkedIn apps (and portal mail routing) in those vendors’ consoles and paste secrets into Sources (access tokens can be saved via API `PATCH /api/re/sources` with `accessToken` for future Graph enrichment).

---

## 4. CRM & follow-ups

- **Pipeline stages:** new → contacted → qualified → site_visit → negotiation → won / lost / archived  
- **Assignment:** org `user_profiles`  
- **Notes / timeline:** `re_lead_activities`  
- **Follow-up email:** default rule “First-touch email” (delay configurable). Requires SMTP under **Email configuration**. Jobs run every minute via Nest cron.

WhatsApp / SMS / voice dialers are **not** live channels yet (schema allows future `channel` values; email is implemented).

---

## 5. Ops checklist (Dev)

1. Apply both SQL migrations on Dev Supabase.  
2. Deploy Nest + FE (`develop` / Deploy Dev).  
3. Confirm Real Estate appears in sidebar (Dev flag default).  
4. Open **Sources** → enable Website → **Send test lead** → see lead in **Leads**.  
5. Configure SMTP → set follow-up delay to `0` → process jobs → confirm activity “Follow-up email sent”.  
6. Point Meta/Google/LinkedIn webhooks at the copied URLs when credentials are ready.

---

## 6. What is intentionally not in this drop

- Social graph / in-app chat / activity feed  
- Live Meta Graph “fetch lead by id” enrichment (webhook payload is stored; token field reserved)  
- Native WhatsApp / SMS / CPaaS calling  
- Public SEO marketplace pages for listings  
- Mobile push  

---

## 7. API map (quick)

**Public ingest:** `/api/re/ingest/...`  
**Auth CRM:** `/api/re/leads|profiles|listings|overview|assignees`  
**Auth sources:** `/api/re/sources`, `/api/re/ingest-events`, `/api/re/follow-up-rules`, `/api/re/follow-up-jobs`  
**Probe:** `GET /api/re/availability`

---

## 8. Verdict

End-to-end **lead generation plumbing is in the product**: capture from all planned source types (via webhooks/JSON), land in CRM, assign/stage/note, and auto email follow-up.  

**Go-live for each external ads/portal source** still needs that vendor’s app credentials and webhook registration — the TopSqill side is ready to receive and process them.
