# TopSqill NestJS Backend

NestJS API server that replaces Supabase Edge Functions and routes database operations through a secure backend layer.

## Architecture

```
React SPA  →  NestJS API (port 3001)  →  PostgreSQL (via Supabase)
                ├── Auth validation (JWT)
                ├── Database API (CRUD + RPC)
                ├── Workflows, Email, LDAP, AI, SLA, etc.
                └── Cron jobs (scheduled tasks)
```

## Quick Start

```bash
# Install dependencies
cd backend && npm install

# Configure the server-only credential
cp .env.example .env
# Edit backend/.env and set SUPABASE_SERVICE_ROLE_KEY. The Supabase URL and
# anon key are loaded automatically from either backend/.env or the root .env.

# Development
npm run start:dev

# Production build
npm run build && npm run start:prod
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `CORS_ORIGIN` | Allowed frontend origin |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key (for JWT validation) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for privileged DB ops) |
| `LOVABLE_API_KEY` | Optional AI API key |

Environment loading is independent of the command's working directory, so
both `cd backend && npm run start:dev` and
`npm --prefix backend run start:dev` use the same configuration.

## API Endpoints

All endpoints are prefixed with `/api`.

### Core
- `GET /api/health` — Health check
- `POST /api/database/query` — Database SELECT
- `POST /api/database/insert` — Database INSERT
- `POST /api/database/update` — Database UPDATE
- `POST /api/database/delete` — Database DELETE
- `POST /api/database/rpc` — Call PostgreSQL functions

### Auth & Security
- `POST /api/mfa/send-code` — Send MFA code
- `POST /api/mfa/verify-code` — Verify MFA code
- `POST /api/sessions/terminate` — Terminate user session
- `POST /api/users/send-password-reset` — Password reset email
- `POST /api/auth/accept-invitation` — Accept org invitation

### Workflows
- `POST /api/workflows/enqueue` — Enqueue workflow execution
- `POST /api/workflows/execute` — Execute workflow
- `POST /api/workflows/process-queue` — Process workflow queue
- `POST /api/workflows/resume-waiting` — Resume paused workflows

### External APIs
- `/api/public-api/*` — Public REST API (API key auth)
- `/api/form-api/*` — Form records API

## Frontend Integration

The React frontend automatically routes database and edge function calls through this API when `VITE_USE_BACKEND_API=true` (default). See `src/integrations/supabase/client.ts` for the proxy implementation.

## Migrated Edge Functions

All 36 Supabase Edge Functions have been migrated to NestJS modules:

| Edge Function | NestJS Module |
|---------------|---------------|
| send-mfa-code, verify-mfa-code | MfaModule |
| terminate-session | SessionsModule |
| send-password-reset, delete-user, admin-change-password | UsersModule |
| accept-user-invitation, send-welcome-email, send-user-invitation | AuthModule |
| test-smtp-connection, send-template-email, send-delegation-email, send-kb-notification-email | EmailModule |
| ldap-authenticate, idp-oauth-callback, ldap-test-connection, ldap-sync | LdapModule |
| enqueue-workflow, execute-workflow, process-workflow-queue, resume-waiting-workflows, notify-failure | WorkflowsModule |

## Scalability configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKFLOW_EXECUTOR_MODE` | `edge` | `edge` invokes Supabase `execute-workflow` function for full workflow logic |
| `WORKFLOW_QUEUE_BATCH_SIZE` | `20` | Jobs claimed per queue run |
| `WORKFLOW_QUEUE_CONCURRENCY` | `10` | Parallel workers per batch |
| `REDIS_URL` | _(unset)_ | Optional Redis + BullMQ for distributed queue across pods |

Apply DB migration `20260724120000_scalability_indexes_and_queue_rpc.sql` for atomic queue claiming and combination-key RPC.
| execute-data-feed, discover-external-fields, run-scheduled-data-feeds | DataFeedsModule |
| ai-assistant, ai-copilot-action | AiModule |
| predict-sla-breach, process-sla-escalations | SlaModule |
| analyze-performance | PerformanceModule |
| asset-agent-report | ItamModule |
| policy-preview, policy-review-reminders | PoliciesModule |
| public-api | PublicApiModule |
| form-api | FormApiModule |
