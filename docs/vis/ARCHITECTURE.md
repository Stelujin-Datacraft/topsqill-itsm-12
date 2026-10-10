# Versatile Integration Studio — Architecture

## Principle

VIS is an **orchestration platform**, not the system of record for target applications.
Internal Forms are discovered and written **only through configurable APIs**.

## Layout

- `packages/vis-core` — shared types, Zod `IntegrationDesign` / `AiDesignProposal`, connector & AI interfaces, mapping engine, OpenAPI discovery
- `backend/src/vis` — NestJS `VisModule` (`/api/vis/*`), connectors, mock AI, file store (core mirrored from `packages/vis-core`)
- `supabase/migrations/20261010120000_vis_supabase_persistence.sql` — VIS tables on the existing Supabase project
- `src/pages/vis` — Prompt-first UI under `/vis`
- `src/lib/vis` — Nest-first client with sticky browser fallback engine

## Phase 1 runtime

- Persistence: Supabase in production (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). File-backed `VisStore` remains for local tests.
- AI: `MockAIProvider` + `VisAssistant` (structured, Zod-validated)
- Mocks: `/api/vis/mocks/vulnerabilities`, `/api/vis/mocks/forms/...`
- Workers / OAuth refresh lock / circuit breaker: interfaces & data model ready; not live

## Phase 2 — AI designer + schema + smart mapping

- Structured `AiDesignProposalSchema` → validated `IntegrationDesign` (invalid AI output is rejected)
- Clarification questions when source/frequency missing (selectable answers)
- Recommendation cards (recommendation / reason / confidence)
- OpenAPI discovery (`OpenApiDiscovery`) + Internal Application form/schema discovery
- Schema cache with refresh + field-level diff (does not silently clear mappings)
- Mapping engine: confidence %, transforms, reference lookups, NL mapping edits, dry run
- CREATE/UPDATE matching (single + composite)
- Design validation PASS/WARNING/ERROR + explicit **Approve Design** (no production activation)
- Version stores `aiProposal`, `userChanges`, `finalConfiguration` for audit

### Wizard UI flow (`/vis/new` → `/vis/integrations/:id`)

1. Describe requirement (+ clarification if needed)
2. AI design + language
3. Connections / OpenAPI / sample JSON
4. Discover forms + schema
5. AI mapping + NL edits
6. Transformations
7. Matching strategy
8. Validation
9. Dry run
10. Save draft / Validate / Approve + audit

## Acceptance path

1. Open `/vis`
2. **New Integration** → describe → Analyze (answer clarifications if asked)
3. Walk wizard: design → connections → schema → mappings → validate → dry run → approve
4. Confirm audit trail shows AI + user actions

## Security

- Secret handles only (`CredentialReference`); API masks secrets
- SSRF URL checks (`assertSafeOutboundUrl`); private hosts require `allowPrivateNetwork`
- AI never receives secrets and never activates production integrations
- Dry run never writes target records

## Tests

```bash
npx tsx backend/test/vis/vis.phase1.test.ts
npx tsx backend/test/vis/vis.phase2.test.ts
```
