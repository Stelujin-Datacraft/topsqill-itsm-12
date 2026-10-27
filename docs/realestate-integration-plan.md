# Real Estate Platform — Integration Plan on TopSqill

**Status:** Architecture analysis only (no implementation)  
**Repo:** TopSqill ITSM / no-code platform (`topsqill-itsm-12`)  
**Audience:** Engineering / product leadership  
**Date:** 2026-10-27 (Asia/Calcutta)

---

## Executive verdict: does it fit?

**Partial yes — strong fit for the CRM / lead / listing / automation half; weak fit for the social-network half without new product modules.**

| Product area | Fit on TopSqill engines |
|--------------|-------------------------|
| Profile types with different fields & permissions | **Good** — forms + security templates + roles/groups + field permissions |
| Property listings & builder project pages (internal ops) | **Good** — forms, pages, file/image fields, lifecycle Status, reports |
| Lead capture (ads, portals, webhooks, website forms) | **Good** — Form API, Public API, VIS connectors, data feeds, webhooks |
| CRM inbox / pipeline / assignment / notes / timelines | **Good with extension** — forms + lifecycle + workflows + comments; needs CRM UX and lead-specific model |
| Automated follow-ups | **Good** — workflow wait nodes + notifications + email; SMS/WhatsApp need new executors |
| AI ad-campaign assistant | **Partial** — AI assistant/copilot exists; campaign-specific tools & Meta/Google APIs are new |
| LinkedIn-style network (connections, follows, feed) | **Poor as config-only** — needs a new social graph module |
| In-app chat | **Missing** — only AI chatbot + submission comments today |
| WhatsApp / SMS / calling | **Mostly missing** — email is mature; SMS is typed but not executed; WhatsApp/calling absent |
| Public SEO marketplace pages | **Partial** — marketing SEO/prerender exists; authenticated app is SPA; public listing SEO needs deliberate design |

**Recommendation:** Treat TopSqill as the **ops backbone** (tenancy, forms, workflows, reports, integrations, ACL). Build a **Real Estate vertical product shell** (`re-*` modules) that reuses those engines for leads/listings/CRM/automation, and **do not** try to encode social feed, DMs, or WhatsApp as generic form submissions. That hybrid matches how VIS and ITAM were added: Nest modules + migrations + React pages on shared org/project tenancy.

---

## 1. Tech stack summary

| Layer | Choice | Evidence |
|-------|--------|----------|
| Languages | TypeScript (FE + BE) | `/workspace/package.json`, `/workspace/backend/package.json` |
| Package manager | npm (Node 22); leftover `bun.lock` | Dockerfiles, CI `node-version: '22'`, `/workspace/.npmrc` (`legacy-peer-deps=true`) |
| Frontend | React 18 + Vite 5 (SWC), React Router 6, TanStack Query 5 | `/workspace/vite.config.ts`, `/workspace/src/main.tsx`, `/workspace/src/App.tsx` |
| UI | shadcn/ui + Radix + Tailwind 3.4 + lucide-react | `/workspace/components.json`, `/workspace/src/components/ui/` |
| Forms UX libs | react-hook-form, zod, TipTip/Quill, CodeMirror, `@xyflow/react` (workflow canvas), recharts | root `package.json` |
| i18n | i18next (`en/ar/de/es/fr`) | `/workspace/src/i18n/config.ts`, `/workspace/src/locales/` |
| Backend | NestJS 10 (Express), global prefix `/api`, port 3001 | `/workspace/backend/src/main.ts`, `/workspace/backend/README.md` |
| Engines pattern | Ported Deno Edge logic as `*.engine.ts` behind `EngineHostService` | `/workspace/backend/src/engines/`, `/workspace/backend/src/engines/engine-host.service.ts` |
| Database | Supabase-hosted PostgreSQL; ~222 SQL migrations | `/workspace/supabase/migrations/` |
| Query / ORM | **No ORM for core app** — Nest `DatabaseService` + `@supabase/supabase-js` PostgREST; FE `databaseClient` | `/workspace/backend/src/database/database.service.ts`, `/workspace/src/services/api/databaseClient.ts` |
| Optional Prisma | VIS-only / legacy (`VIS_DATABASE_URL`); default `VIS_PERSISTENCE=supabase` | `/workspace/backend/src/vis/prisma/schema.prisma`, `/workspace/backend/.env.vis.example` |
| Auth | Supabase Auth (password, Google OAuth, signup/signin OTP, email MFA) → JWT validated by Nest `SupabaseAuthGuard` | `/workspace/src/contexts/AuthContext.tsx`, `/workspace/backend/src/common/guards/supabase-auth.guard.ts` |
| LDAP / IdP | Nest LDAP module + engines | `/workspace/backend/src/ldap/` |
| File storage | Supabase Storage buckets (`form-attachments`, `organization-logos`, `report-media`, `blog-media`, `email-attachments`, …) | migrations under `/workspace/supabase/migrations/`, FE field uploaders |
| Queues / jobs | `workflow_queue` table + optional Redis/BullMQ; Nest `@Cron` for workflows, data feeds, SLA, policies | `/workspace/backend/src/queue/workflow-queue.service.ts`, `/workspace/backend/src/cron/cron.service.ts` |
| Realtime | Supabase Realtime channels (not Nest WebSockets) | `/workspace/src/hooks/useNotifications.ts`, `/workspace/src/services/api/index.ts` |
| Hosting | Docker Compose on GCP VMs; GitHub Actions Deploy Dev (`develop`) / Deploy Prod (`main`) | `/workspace/docker-compose.yml`, `/workspace/.github/workflows/deploy-dev.yml`, `/workspace/docs/cicd/README.md` |
| SEO edge | Build-time prerender + Cloudflare Worker | `/workspace/docs/SEO_EDGE_SETUP.md`, `/workspace/seo/edge-worker/` |
| Mobile | **None** (web SPA only) | — |
| Shared package | `@vis/core` Zod contracts | `/workspace/packages/vis-core/` |

**Client/backend split (important for RE work):** Nest handles DB CRUD/RPC and function invoke; Supabase raw client remains for **auth, realtime, storage** (`/workspace/src/services/api/index.ts`).

---

## 2. Existing engines and how they work

### 2.1 Form engine

**Definition storage**

| Artifact | Storage | Paths |
|----------|---------|-------|
| Form metadata | `forms` (`name`, `status`, `project_id`, `organization_id`, JSON: `pages`, `field_rules`, `form_rules`, `layout`, `permissions`, `share_settings`, `is_public`) | types in `/workspace/src/integrations/supabase/types.ts`; app types `/workspace/src/types/form.ts` |
| Fields | `form_fields` rows (`field_type`, `options` JSON, `validation` JSON, `custom_config` JSON, `permissions`, `triggers`, order/visibility) | `/workspace/src/hooks/useFieldMutations.ts` |
| Records | `form_submissions.submission_data` (JSON keyed by field id) | `/workspace/src/hooks/useFormSubmissionHandler.ts` |
| Lifecycle audit | `lifecycle_stage_history` | `/workspace/src/hooks/useLifecycleHistory.ts` |
| Access | `form_user_access` + ACL UI | Form access management components |

There are **no** separate tables for pages/options/actions — those live in JSON on `forms` / `form_fields`.

**Render & validation**

- Widgets: `/workspace/src/components/FormFieldsRenderer.tsx`, `/workspace/src/components/form-fields/*` (includes `GeoLocationField`, files, address, phone, cross-reference, approval, …)
- Layout: `SmartFormLayoutRenderer`, `FormViewLayoutRenderer`, builder `FieldLayoutRenderer`
- Validation: `/workspace/src/utils/fieldValidation.ts`, mandatory checks `/workspace/src/lib/formMandatoryValidation.ts`
- Field/form rules: `/workspace/src/utils/ruleProcessor.ts`; builders under `/workspace/src/components/rules/`
- On submit: insert submission → workflow enqueue (`WorkflowExecutionService`) + form-rule triggers (`/workspace/src/services/formRuleWorkflowTrigger.ts`)

**Lifecycle / pipeline-like Status**

- System Status select field with `customConfig.displayAsLifecycle`, `transitionRules` — `/workspace/src/lib/systemStatusField.ts`, UI `/workspace/src/components/LifecycleStatusBar.tsx`
- Useful as a **CRM stage bar** if lead forms use Status + transition rules

**Machine write path**

- Nest Form API: `/workspace/backend/src/form-api/` + `/workspace/backend/src/engines/form-api.engine.ts`
- Public/API-key path: `/workspace/backend/src/public-api/`

**AI form builder**

- `/workspace/src/components/ai/AIFormGenerator.tsx`, `/workspace/src/lib/createFormFromAiGeneration.ts`, Nest `/workspace/backend/src/ai/`

### 2.2 Workflow engine

**Definition**

| Table | Role |
|-------|------|
| `workflows` | Header (project, enrollment, failure notify) |
| `workflow_nodes` | Graph nodes (`node_type`, `config` JSON) |
| `workflow_connections` | Edges / condition handles |
| `workflow_triggers` | Optional form→workflow registry |
| `workflow_executions` / `workflow_queue` / `workflow_node_executions` / `workflow_instance_logs` | Runtime |

Types: `/workspace/src/types/workflow.ts`, `workflowConfig.ts`, `conditions.ts`. Designer: `/workspace/src/components/workflows/`, pages `Workflows.tsx`, `WorkflowDesignerPage.tsx`.

**Triggers:** form submission/completion/approval/rejection, rule success/failure, manual, webhook, schedule — matching in `/workspace/src/services/workflow/workflowTrigger.ts` (+ Nest port under `backend/src/workflows/engine/port/`).

**Node types:** `start`, `action`, `condition`, `wait`, `end` (+ approval / notification / form-assignment compat).

**Action types (implemented for execution):** assign form, approve, update lifecycle status, send notification, change field/record status, create/link/update records, combination records — see `/workspace/src/services/workflow/actionExecutors.ts`, `recordActionExecutors.ts`, Nest mirrors.

**Delays:** `wait` node → execution `status='waiting'` + `scheduled_resume_at`; resumed by cron `/workspace/backend/src/cron/cron.service.ts` and `resume-waiting` endpoints.

**Execution path**

```
Trigger → POST /api/workflows/enqueue → workflow_queue
  → (optional BullMQ if REDIS_URL) or DB claim + cron
  → WorkflowExecutorService → NestjsWorkflowEngineService → NodeExecutors
```

Key files: `/workspace/backend/src/workflows/`, `/workspace/backend/src/engines/enqueue-workflow.engine.ts`, legacy Edge still under `/workspace/supabase/functions/enqueue-workflow/` etc.

**Gap note:** `send_sms` appears in workflow **types/UI** (`/workspace/src/types/workflow.ts`, `ActionNode.tsx`) but **no executor case** under `/workspace/src/services/workflow/` — SMS is not a live channel today.

### 2.3 Report engine

- **Sources:** primarily `form_submissions` scoped by form/project; joins / cross-ref configs; optional SQL Query Studio allowlist
- **Config model:** `/workspace/src/types/reports.ts` — chart types (bar/line/area/pie/donut/scatter/bubble/heatmap), aggregations, filters, drilldown/grouping
- **UI:** `/workspace/src/pages/Reports.tsx`, `ReportEditor.tsx`, `ReportViewer.tsx`, `/workspace/src/components/reports/` (~80 files), AI report builder
- **SQL studio:** `/workspace/src/pages/QueryPage.tsx`, `/workspace/src/services/sqlParser.ts`
- **Dashboards:** `/workspace/src/pages/DashboardView.tsx`, `/workspace/src/components/dashboards/`
- **Access:** report/dashboard RLS + `useReportAccess` / access management pages

Fits **lead funnel dashboards, listing inventory, broker performance** when data lives in forms — not a BI warehouse.

### 2.4 API integration framework

| Capability | Role for RE | Paths |
|------------|-------------|-------|
| **VIS** | Orchestrated SaaS sync (ads platforms, portals) with AI mapping → Form API | `/workspace/docs/vis/ARCHITECTURE.md`, `/workspace/backend/src/vis/`, `/workspace/packages/vis-core/`, `/workspace/src/pages/vis/` |
| **Form API** | Ingest leads/listings as form records | `/workspace/backend/src/form-api/` |
| **Public API** | External API-key CRUD | `/workspace/backend/src/public-api/`, `api_keys` migration |
| **Outbound connectors** | generic_http, Salesforce, ServiceNow, Jira, Slack, custom | `/workspace/src/types/outboundConnector.ts`, `/workspace/src/pages/Integrations.tsx` |
| **Data feeds** | Scheduled form↔form / external DB sync | `/workspace/backend/src/data-feeds/` |
| **Webhooks (VIS)** | HMAC / API key / Bearer / Basic verification | `/workspace/backend/src/vis/events/webhook-security.ts`, `event-ingestion.ts` |
| **LDAP** | Enterprise directory (optional for brokerages) | `/workspace/backend/src/ldap/` |

**Adding a new integration today:** prefer VIS design (OpenAPI/sample JSON → mapping → approve → execute) or outbound connector + Form API write. Email-parsing portal leads would be a **new connector/worker**, not config-only.

### 2.5 Multi-tenancy model

```
Organization (organizations, user_organizations, user_profiles.organization_id)
  └── Project (projects, project_users)
        └── Forms / Workflows / Reports / Data feeds / VIS / ITAM …
```

- **No `workspaces` table** — “workspace” is onboarding/UX language (`useOnboardingGate`).
- Scoping: `organization_id` / `project_id` columns + Postgres RLS helpers (`get_current_user_org_id()`, `can_view_project()`, …) e.g. `/workspace/supabase/migrations/20261020140000_dev_repair_08_auth_helpers.sql`
- FE contexts: `/workspace/src/contexts/OrganizationContext.tsx`, `ProjectContext.tsx`

**RE implication:** A brokerage = organization; cities/teams or product lines = projects; **or** a dedicated RE marketplace may need a different public tenancy model (see Gaps).

### 2.6 Roles and permissions model

| Layer | Mechanism | Paths |
|-------|-----------|-------|
| Org role | `user_profiles.role`: `admin` \| `user` | `AuthContext.tsx` |
| Project role | `project_users.role` | projects migration |
| Custom RBAC | `roles`, `role_permissions`, `user_role_assignments`, `groups`, `group_*` | migrations `20250629103337_*`, `20250630132227_*` |
| Top-level CRUD gates | `project_top_level_permissions` | `20250701101826_*` |
| Security templates | password/MFA/lockout/session | `20260116091414_*`, `SecurityTemplatesManager.tsx` |
| Resource ACL | form/report/workflow access matrices | `RolesAndAccess.tsx`, `useUnifiedAccessControl.ts` |
| Enforcement | RLS + client hooks + Nest guards + throttling | `AccessControlGuard.tsx`, `app.module.ts` |

**Profile types (Buyer / Seller / Dealer / Builder)** can map to **custom roles + groups + form field permissions**, but LinkedIn-style **public profiles** need a new profile entity (not only `user_profiles` admin fields).

---

## 3. Reuse map

Legend: **(a)** configure existing engines, no new code · **(b)** extend engines · **(c)** new module

| Feature | Choice | Justification |
|---------|--------|---------------|
| **Profile types (Buyer, Seller/Owner, Dealer/Broker, Builder/Developer) with different fields** | **(b)** primarily; light **(a)** for first MVP | Different field sets ≈ different forms or conditional sections + field `permissions`. Distinct product personas need role/group templates and likely a `re_profiles` (or typed form) with KYC/docs — not pure Access Control “Users” alone. |
| **Profile permissions** | **(a)/(b)** | Roles, groups, security templates, form ACL already exist (`RolesAndAccess.tsx`, RLS). Extend with RE-specific permission keys if needed. |
| **Connections / follows / social graph** | **(c)** | No graph tables, follow model, or feed fan-out. Forcing this into forms would be the wrong abstraction. |
| **Activity feed** | **(c)** (+ optional **(b)** notifications) | In-app `notifications` exist (`useNotifications.ts`) but are event toasts, not a LinkedIn feed. Need feed entities + ranking/privacy. |
| **In-app chat (1:1 / threads)** | **(c)** | Only AI chatbot (`AIChatbot.tsx`) and submission comments. Need messages, rooms, presence; Supabase Realtime can underpin delivery but product is new. |
| **Requirement posts** | **(a)/(b)** | Model as a public/shared form (“Requirements”) with create + list + workflow notify matching dealers — config-first; may need discovery UX **(b)**. |
| **Property listings (seller/dealer)** | **(a)/(b)** | Strong form fit (geo, images, address, currency, Status lifecycle). Marketplace browse/search/map UI is **(b)/(c)** beyond Form Viewer. |
| **Builder project pages** | **(a)/(b)** | Multi-page forms + rich text + images + cross-ref to units/listings. Public marketing page template is **(b)** (blog/SEO patterns exist). |
| **Lead capture — Meta / Google / LinkedIn Lead Gen** | **(b)/(c)** via VIS + Form API | VIS + Form API is the right pipe; each ad platform needs connector auth, webhook verify, and field maps (extend VIS connectors, not invent a parallel bus). |
| **Lead capture — 99acres / MagicBricks / Housing (email parse / webhooks)** | **(c)** | No email-ingress parser today; outbound email exists. New ingest worker + normalize → Form API. |
| **Website forms** | **(a)** | Public forms (`is_public`, `PublicFormView.tsx`) + Form API embeds. |
| **Call leads** | **(c)** | No telephony / CDR / click-to-call integration found. |
| **CRM lead inbox** | **(b)** | Data can be lead form submissions; inbox UX (queues, filters, SLA badges) is a new surface on form data — like ITAM’s specialized UI over synced assets. |
| **Pipeline stages** | **(a)/(b)** | Lifecycle Status + `transitionRules` + workflows updating status. May need multi-pipeline templates per profile type **(b)**. |
| **Assignment** | **(a)/(b)** | Workflow `assign_form` / user-picker fields; round-robin / territory rules need **(b)**. |
| **Notes & timelines** | **(a)/(b)** | Comments exist; full activity timeline (calls, WhatsApp, stage changes) needs a unified activity log **(b)/(c)**. |
| **WhatsApp Business API (1:1, templates, attachments)** | **(c)** | No WhatsApp SDK/module. New Nest module + Storage for media + workflow action executor. |
| **Email messaging** | **(a)/(b)** | Mature: SMTP, templates, invitation/welcome/KB/delegation engines (`backend/src/email/`, `components/email/`). Extend templates for RE. |
| **SMS** | **(b)** | Flagged in types/SLA columns; implement executor + provider (Twilio/etc.) — small extension, not greenfield product. |
| **Calling** | **(c)** | No CPaaS integration. |
| **Automated follow-up sequences** | **(a)/(b)** | Workflow waits + email/notifications already support sequences; WhatsApp/SMS steps need channel executors first. |
| **AI assistant for ad campaigns from profile/listings** | **(b)/(c)** | Reuse AI gateway (`backend/src/ai/`, OpenRouter/Lovable) and copilot UX; add campaign tools, policy prompts, and Meta/Google Marketing APIs — new domain skills on existing AI stack. |
| **Analytics (funnels, listing performance)** | **(a)/(b)** | Reports/dashboards on lead & listing forms; advanced attribution may need **(b)** event tables. |

---

## 4. Gaps and risks

### Gaps (capabilities RE needs that are missing or incomplete)

| Gap | Today | Impact |
|-----|-------|--------|
| User↔user messaging / chat | AI chatbot only | Blocks networking product |
| Social graph & feed | Absent | Blocks LinkedIn-style network |
| WhatsApp Business | Absent | Blocks primary India RE channel |
| SMS execution | Type/UI only | Follow-ups incomplete |
| Voice / calling / CDR | Absent | Call-lead promise unmet |
| Email-to-lead parsing | Absent | Portal lead automation blocked |
| Geo search / map listing browse | Single `GeoLocationField` + performance GIS map widget | Not a property search engine (radius, polygons, indexed geo) |
| Media / video pipelines | Image/file fields + Storage buckets | No video CDN/transcoding product path |
| Mobile app / push | Web only | Agents expect mobile alerts |
| Public SEO listing pages | Marketing SEO for TopSqill.com; app is SPA | Marketplace SEO needs SSR/prerender strategy per listing |
| Rate limiting beyond Nest throttler | Global `ThrottlerGuard` | Ad/webhook bursts need per-tenant/provider limits |
| Dedicated webhook receiver product | VIS event ingestion exists | Need stable public URLs + provider-specific verifiers for Meta/Google/LinkedIn |
| CRM-grade activity model | Notifications + comments | Need immutable lead timeline |
| Dual persona (consumer marketplace vs brokerage ops) | Org/project ITSM tenancy | Product split or “RE Marketplace” tenant mode unclear |

### Architectural risks

1. **Overloading `form_submissions`:** Modeling chat messages, follows, and feed items as form rows will destroy query performance and ACL clarity. Keep forms for **business records** (leads, listings, projects, requirements).
2. **Tenancy mismatch:** TopSqill assumes private org/project workspaces. A public network of buyers/sellers spanning orgs needs either a shared marketplace org, cross-org visibility rules, or a separate public schema — none exist today.
3. **Realtime scale:** Supabase Realtime is fine for notifications; chat + feed fan-out at brokerage scale may need careful channel design or a dedicated message store.
4. **Dual executor legacy:** Edge functions still in `/workspace/supabase/functions/` while Nest is primary — new RE engines must follow Nest `EngineHostService` only to avoid split-brain.
5. **RLS complexity:** ~222 migrations and repair scripts; new RE tables must ship with RLS helpers consistent with `get_current_user_org_id()` patterns or they will fail the same class of bugs as prior CRUD/RLS incidents.
6. **AI cost & compliance:** Campaign generation that posts to Meta/Google needs human approval gates (VIS-style dry-run/approve) and PII handling for lead ads.
7. **Compliance:** Real estate lead ads + WhatsApp templates imply consent, DND, and retention policies not modeled as first-class entities.

---

## 5. Recommended folder / module structure

Follow existing conventions: Nest feature modules under `backend/src/<domain>/`, React pages under `src/pages/`, domain UI under `src/components/<domain>/`, hooks `src/hooks/`, shared types `src/types/`, SQL in `supabase/migrations/`, docs in `docs/`, optional shared Zod in `packages/`.

```
docs/
  realestate-integration-plan.md          # this document
  realestate/                             # future ADRs / readiness notes

packages/                                 # only if shared contracts needed
  re-core/                                # optional: Zod schemas for leads, profiles, listings

supabase/migrations/
  YYYYMMDDHHMMSS_re_profiles.sql
  YYYYMMDDHHMMSS_re_social_graph.sql
  YYYYMMDDHHMMSS_re_messaging.sql
  YYYYMMDDHHMMSS_re_lead_activity.sql
  YYYYMMDDHHMMSS_re_channels_whatsapp.sql
  … + RLS policies mirroring auth helpers

backend/src/
  re/                                     # Nest RealEstateModule (facade)
    re.module.ts
    re.controller.ts                      # thin HTTP for RE-specific APIs
    profiles/
    social/                               # connections, follows, feed
    messaging/                            # chat threads/messages
    leads/                                # inbox helpers, assignment strategies
    channels/
      whatsapp/
      sms/
      voice/
    ingest/                               # portal email parse, ad webhooks adapters
  engines/
    re-*.engine.ts                        # only if Edge-parity style helpers needed
  vis/connectors/                         # extend: meta-leads, google-ads, linkedin-leadgen
  workflows/engine/…                      # extend action executors: send_whatsapp, send_sms

src/
  pages/
    re/
      ReHome.tsx
      ReNetwork.tsx
      ReListings.tsx
      ReProjects.tsx
      ReLeadInbox.tsx
      ReChat.tsx
      ReCampaignAssistant.tsx
  components/re/
    profiles/
    network/
    listings/
    crm/
    chat/
    campaigns/
  hooks/
    useReProfiles.ts
    useReLeads.ts
    useReChat.ts
    …
  types/
    re.ts
  lib/re/
    listingFormTemplates.ts               # seed form schemas using form engine
    leadPipelineTemplates.ts
    campaignPrompts.ts
  services/api/                           # extend apiClient routeMap for /re/*
```

**Seed-as-config (reuse forms/workflows):** ship SQL or Nest bootstrap that creates RE form templates, Status lifecycles, and starter workflows inside each org/project — same pattern as system Status field (`/workspace/src/lib/systemStatusField.ts`) and AI form create (`createFormFromAiGeneration.ts`).

**Do not** place RE social/chat tables under `form_fields` / `form_submissions`.

---

## 6. Coding conventions to follow

Observed patterns that future RE code must match:

| Area | Convention | Examples |
|------|------------|----------|
| **FE structure** | Feature folders under `components/` + `pages/`; hooks for data; contexts for org/project/auth | `components/vis/`, `pages/vis/`, `hooks/useDataFeeds.ts` |
| **API access** | Use `backend` / `db` / `api.invoke` — not ad-hoc `fetch` to Supabase PostgREST for app data | `/workspace/src/services/api/index.ts` |
| **Auth header** | Nest `@UseGuards(SupabaseAuthGuard)`; pass `Authorization` into engines that call `ctx.getHeader('Authorization')` | `users.controller.ts` + `AuthHeader` decorator; guard sets `request.authHeader` |
| **Engines** | Prefer Nest modules; heavy business logic in `engines/*.engine.ts` invoked via `EngineHostService` | `delete-user.engine.ts`, form-api engine |
| **Route map** | Register Nest paths in `apiClient` `routeMap` when replacing `functions.invoke` names | `/workspace/src/services/api/apiClient.ts` |
| **Naming** | kebab-case files for Nest/engines; PascalCase React components; `useX` hooks; SQL snake_case | `workflow-queue.service.ts`, `LifecycleStatusBar.tsx` |
| **Validation** | Zod on shared contracts (VIS); Nest `ValidationPipe`; FE fieldValidation / RHF | `packages/vis-core`, `main.ts` |
| **Errors** | Engines often return `{ success, error }`; services map to Nest HTTP exceptions (`BadRequestException`) | `users.service.ts` |
| **Tenancy** | Always scope by `organization_id` / `project_id`; add RLS in same migration as tables | repair migrations under `supabase/migrations/` |
| **Realtime** | Supabase channels for live UI; avoid Nest WebSockets unless justified | `useNotifications.ts` |
| **Storage** | Supabase buckets + RLS; new media types get dedicated buckets | blog-media, form-attachments pattern |
| **Tests** | Backend: `backend/test/<area>/*.test.ts`; FE: colocated `*.test.ts` near utils; CI runs backend unit + frontend build | `backend/test/vis/`, `src/components/reports/utils/*.test.ts` |
| **Docs** | Architecture/readiness markdown under `/workspace/docs/` (domain subfolders for large features) | `docs/vis/ARCHITECTURE.md`, `docs/cicd/README.md` |
| **Promotion** | Cross-env promote via handlers if RE configs must move Dev→Prod | `/workspace/backend/src/promotion/handlers/` |
| **AI safety** | Structured proposals + validate + dry-run/approve (VIS pattern) before side effects | `/workspace/docs/vis/ARCHITECTURE.md` |
| **Commits / branches** | Feature branches `cursor/<name>-e654`; PRs into `develop` for Dev deploy | CI/CD docs |

---

## Suggested implementation phasing (non-binding)

1. **Foundation:** RE Nest module + profile types on forms/roles; listing & lead form templates; lifecycle pipelines; reports.
2. **Ingest:** VIS connectors for Meta/Google/LinkedIn + website Form API; portal email ingest worker.
3. **CRM shell:** Lead inbox UI, assignment rules, activity timeline, workflow follow-ups (email first).
4. **Channels:** SMS executor → WhatsApp module → optional voice.
5. **Network:** Social graph, feed, chat (largest greenfield).
6. **Growth AI:** Campaign assistant with approve-to-publish.

---

## Open questions

1. **Product shape:** Is the primary customer a **brokerage/developer using private org tools**, a **consumer marketplace**, or both? Tenancy design hinges on this.
2. **Identity:** Are Buyers/Sellers end-users with Supabase Auth accounts inside the same org as Dealers, or separate consumer tenancy?
3. **Listings SoR:** Must listings be first-class tables for geo search/SEO, or is form_submissions acceptable for MVP?
4. **Executor mode in Dev/Prod:** Are workflows and data feeds fully Nest (`WORKFLOW_EXECUTOR_MODE` / `DATA_FEED_EXECUTOR_MODE`), or still Edge for some paths?
5. **WhatsApp BSP:** Preferred provider (Meta Cloud API direct vs. Interakt/Wati/Gupshup) and who owns the WABA?
6. **Calling:** Softphone vs. click-to-call bridge vs. out-of-scope for v1?
7. **Portal ingest:** Email parsing vs. paid portal APIs vs. manual CSV — which portals are mandatory for launch?
8. **Mobile:** Is a PWA enough for agents, or is native push required in v1?
9. **Public SEO domain:** Same topsqill.com, subdomain, or white-label per brokerage?
10. **Is `/workspace/bun.lock` still intentional** for any RE packaging, or npm-only?
11. **K8s VIS sketch** (`/workspace/deploy/k8s/vis-platform.yaml`): relevant for RE chat scale, or Compose-on-VM only?
12. **Promotion:** Must RE templates/connectors promote Dev→Prod via existing Promotional Transfer?

---

## Bottom line

TopSqill is a **credible foundation for a real-estate ops & lead platform** (profiles-as-forms, listings, CRM pipelines, multi-channel follow-up once SMS/WhatsApp are added, ad/portal ingest via VIS/Form API, AI assisted by the existing gateway). It is **not**, by configuration alone, a LinkedIn-style networking app with chat and WhatsApp.

**Fit decision:** Proceed with a **hybrid architecture** — reuse Form / Workflow / Report / VIS / ACL / tenancy engines for the CRM and inventory core; invest in **new `re` modules** for social graph, messaging, and messaging channels. Do not attempt to ship the full networking vision as “more forms and workflows” only.
