# Real Estate Lead Generation — End-to-End Report

**Product scope:** Full lead generation (profiles, listings, CRM, multi-source ingest, email follow-ups, Meta enrichment, normalisation, de-dupe).  
**Deferred:** LinkedIn-style social network (connections / feed / chat).  
**Safety:** Additive `re_*` module only — Forms, Workflows, Access Control engines unchanged.  
**Feature flags** (fail closed on Prod unless explicitly set):

| Flag | Purpose | Dev default |
|------|---------|-------------|
| `RE_LEADGEN_ENABLED` / `VITE_RE_LEADGEN_ENABLED` | Module + UI | on |
| `RE_LEADGEN_META_ENRICH` | Meta Graph enrichment jobs + backfill | on |
| `RE_LEADGEN_DEDUPE` | Phone/email de-dupe + re-enquiry | on |

---

## 1. What was created

### Database (Supabase migrations)

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/20261027120000_re_leadgen_foundation.sql` | `re_profiles`, `re_listings`, `re_leads`, `re_lead_activities` + RLS |
| `supabase/migrations/20261027130000_re_leadgen_ingest_followups.sql` | `re_lead_source_configs`, `re_ingest_events`, `re_follow_up_rules`, `re_follow_up_jobs` + RLS |
| `supabase/migrations/20261027140000_re_leadgen_enrich_dedupe.sql` | Org settings, enrichment jobs, source touches, merges, lead/source enrich columns |

### Nest backend (`backend/src/re/`)

| Piece | Role |
|-------|------|
| `re.module.ts` | Wires CRM + ingest + follow-ups + enrich + dedupe |
| `re.service.ts` | Profiles / listings / leads CRM CRUD |
| `re-providers.ts` | Payload adapters (website, Meta, Google, LinkedIn, portals, call) |
| `re-normalize.ts` | Shared E.164 / email / name / budget normalisation |
| `re-dedupe.ts` / `re-dedupe.service.ts` | Exact match, re-enquiry, fuzzy possibles, merge, multi-touch |
| `re-meta-enrich.service.ts` | Signature verify, enqueue Graph jobs, field mapping, backfill |
| `re-ingest.service.ts` | Source configs, webhook auth, accept → dedupe pipeline |
| `re-ingest.controller.ts` | **Public** webhook HTTP endpoints (GET verify + POST) |
| `re-followup.service.ts` | Rules, schedule jobs, send via org SMTP |
| `re-sources.controller.ts` | Sources / events / enrich / org-settings / merge admin APIs |
| Cron `processReFollowups` | Every minute, due email jobs |
| Cron `processReMetaEnrichment` | Every minute, due Graph enrichment jobs |

### Frontend (`src/pages/re/`, `src/lib/re/`)

| Route | UI |
|-------|----|
| `/re` | Dashboard counts |
| `/re/leads` | Lead inbox + stage / assignee / notes / timeline + **possible duplicates / merge** + re-enquiry badge |
| `/re/listings` | Property / project inventory CRUD |
| `/re/profiles` | Buyer / Seller / Dealer / Builder CRUD |
| `/re/sources` | Webhooks, Meta enrich config / field mapping / fetch missed, enrichment status on events, org normalise/dedupe settings, follow-ups |

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
   (+ X-Re-Ingest-Key; Meta: X-Hub-Signature-256)
        │
        ▼  (Meta only when RE_LEADGEN_META_ENRICH)
   Persist ingest event → enqueue re_enrichment_jobs → 200 OK
        │  cron fetches Graph /{leadgen_id}
        ▼
Shared normalizer (re-normalize) → E.164 / email / name / budget INR
        │
        ▼  (when RE_LEADGEN_DEDUPE)
Exact match phone OR email within org window (default 90d)
   ├─ match → re-enquiry activity + merge empty fields + bump inbox
   │           (follow-up NOT restarted if past first-touch)
   └─ no match → insert re_leads + first/latest source touch
        │
        ▼
Schedule re_follow_up_jobs (if rule enabled + lead has email + new lead / first-touch)
        │
        ▼
CRM UI /re/leads  (stage, assign, notes, timeline, duplicates merge)
```

Manual leads created in the CRM UI use `createLead` and also schedule follow-ups.

---

## 3. Source integrations — how to connect

Open **Real Estate → Sources**, then for each provider:

1. Toggle **On**  
2. Copy **Webhook URL** and **Ingest key** (Meta also uses **Verify token**)  
3. Paste into the external console  
4. Use **Send test lead** to verify without the external network  

| Provider | Endpoint pattern | Auth |
|----------|------------------|------|
| Website | `POST /api/re/ingest/website/:pathToken` | Header `X-Re-Ingest-Key` or `?key=` |
| Meta | `GET` verify + `POST /api/re/ingest/meta_ads/:pathToken` | `hub.verify_token` on GET; `X-Hub-Signature-256` on POST |
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

---

## 4. Meta Lead Ads setup checklist

### 4.1 Meta App & permissions

1. Create a Meta App (Business type) at [developers.facebook.com](https://developers.facebook.com/).  
2. Add **Facebook Login** + **Webhooks** + **Marketing API** / Lead Ads products as required by Meta’s current console.  
3. Request / grant these permissions on the Page token used for enrichment:

   | Permission | Why |
   |------------|-----|
   | `leads_retrieval` | `GET /{leadgen_id}` and `GET /{form_id}/leads` |
   | `pages_show_list` | List pages the user manages |
   | `pages_read_engagement` | Page engagement context |
   | `pages_manage_metadata` | Subscribe the Page to webhook fields |

4. Generate a **Page access token** (long-lived) for the Page that owns the Lead Ad forms.  
5. Copy the App **App Secret** (used for `X-Hub-Signature-256`).

### 4.2 Page webhook subscription

1. In Meta App → Webhooks → subscribe the **Page** object.  
2. Callback URL = the **Webhook URL** shown on TopSqill Sources for `meta_ads`.  
3. Verify token = the **Verify token** shown on that same Sources card (stored per-source; used for `hub.mode` / `hub.verify_token` / `hub.challenge` GET handshake).  
4. Subscribe to the **`leadgen`** field.  
5. Confirm the Page is subscribed to the app (Page settings → subscribed apps / Meta’s leadgen subscription flow).

### 4.3 Paste secrets into TopSqill

On **Real Estate → Sources → Meta Lead Ads enrichment**:

| Field | Where it comes from |
|-------|---------------------|
| Verify token | Shown read-only on the source card — paste into Meta webhook verify token |
| App secret | Meta App → Settings → Basic → App Secret |
| Page access token | Graph API Explorer / Business settings long-lived Page token |
| Page ID | Facebook Page ID |
| Default form ID | Lead form ID (for “Fetch missed leads”) |
| Graph API version | Configurable (default `v21.0`) — not hard-coded in jobs |

Also map custom form questions under **Field mapping** (budget, locality, BHK, timeline → lead fields or `custom:*`).

### 4.4 Runtime behaviour

- **GET** verification handshake returns `hub.challenge` when token matches.  
- **POST** validates `X-Hub-Signature-256`; invalid → **401** + ingest event log.  
- Handler responds **200 quickly**; does **not** call Graph inside the request. Raw payload is stored; `re_enrichment_jobs` are enqueued.  
- Cron (or **Process enrichment jobs now**) calls  
  `GET /{leadgen_id}?fields=created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,is_organic`  
  with exponential backoff (max 5). Token/permission errors mark the source **`needs_reauth`** (warning on Sources UI) and stop endless retries.  
- Same `leadgen_id` never creates two leads (unique index + dedupe path).  
- **Fetch missed leads** uses `GET /{form_id}/leads` (paginated, optional date range) through the same pipeline.

---

## 5. Normalisation & de-dupe

- **Phone:** E.164; org default country code (default `+91`); keep raw + normalised; flag invalid.  
- **Email:** trim + lowercase; flag obviously invalid.  
- **Name:** trim + title-case; missing → `Unknown <source>`.  
- **Budget:** Indian formats (`1.5 Cr`, `80 L`, `₹1,20,00,000`, …) → numeric INR + raw text.  
- All adapters go through `normalizeLeadFields` / `ReDedupeService.acceptLead`.  
- Exact dedupe: normalised phone **OR** email within configurable window (default 90 days) → **re-enquiry** activity, merge empty fields, bump inbox (`is_re_enquiry`), multi-touch in `re_lead_source_touches`.  
- Fuzzy **Possible duplicates** on lead detail (name + locality) with manual **Merge** (timeline + audit in `re_lead_merges`).

---

## 6. CRM & follow-ups

- **Pipeline stages:** new → contacted → qualified → site_visit → negotiation → won / lost / archived  
- **Assignment:** org `user_profiles`  
- **Notes / timeline:** `re_lead_activities` (includes `re_enquiry`, `merge`)  
- **Follow-up email:** default rule “First-touch email”. Re-enquiries do **not** restart follow-ups once the lead is past first-touch. Requires SMTP under **Email configuration**.  

WhatsApp / SMS / voice dialers are **not** live channels yet.

---

## 7. Ops checklist (Dev)

1. Apply all three RE SQL migrations on Dev Supabase (foundation → ingest → enrich/dedupe).  
2. Deploy Nest + FE (`develop` / Deploy Dev).  
3. Confirm Real Estate appears in sidebar (Dev flag default).  
4. Open **Sources** → enable Website → **Send test lead** → see lead in **Leads**.  
5. Configure SMTP → set follow-up delay to `0` → process jobs → confirm activity.  
6. Complete **§4 Meta checklist** when Meta credentials are ready; use **Fetch missed leads** for backfill.  
7. Confirm `RE_LEADGEN_META_ENRICH` / `RE_LEADGEN_DEDUPE` are unset or `true` on Dev; leave unset/`false` on Prod until launch.

---

## 8. What is intentionally not in this drop

- Social graph / in-app chat / activity feed  
- Native WhatsApp / SMS / CPaaS calling  
- Public SEO marketplace pages for listings  
- Mobile push  

---

## 9. API map (quick)

**Public ingest:** `/api/re/ingest/...` (Meta GET verify + POST signed)  
**Auth CRM:** `/api/re/leads|profiles|listings|overview|assignees`  
**Auth sources:** `/api/re/sources`, `/api/re/ingest-events`, `/api/re/follow-up-rules`, `/api/re/follow-up-jobs`  
**Enrich / dedupe:** `/api/re/sources/meta/field-mappings`, `/api/re/sources/meta/fetch-missed`, `/api/re/enrichment/process`, `/api/re/org-settings`, `/api/re/leads/:id/possible-duplicates`, `/api/re/leads/merge`  
**Probe:** `GET /api/re/availability`

---

## 10. Verdict

End-to-end **lead generation plumbing is in the product**: capture from all planned source types, Meta Graph enrichment (flagged), shared normalisation, org-level de-dupe / re-enquiry / merge, CRM, and auto email follow-up.

**Go-live for each external ads/portal source** still needs that vendor’s app credentials and webhook registration — the TopSqill side is ready to receive, enrich, normalise, and de-dupe them.
