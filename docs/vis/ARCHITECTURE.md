# Versatile Integration Studio — Phase 1 Architecture

## Principle

VIS is an **orchestration platform**, not the system of record for target applications.
Internal Forms are discovered and written **only through configurable APIs**.

## Layout

- `packages/vis-core` — shared types, Zod `IntegrationDesign`, connector & AI interfaces
- `backend/src/vis` — NestJS `VisModule` (`/api/vis/*`), connectors, mock AI, file store
- `backend/src/vis/prisma/schema.prisma` — long-term Postgres contract
- `src/pages/vis` — Prompt-first UI under `/vis`

## Phase 1 runtime

- Persistence: file-backed `VisStore` (`backend/.vis-data/`) so MVP runs without Prisma migrate
- AI: `MockAIProvider` + `VisAssistant` (structured, Zod-validated)
- Mocks: `/api/vis/mocks/vulnerabilities`, `/api/vis/mocks/forms/...`
- Workers / OAuth refresh lock / circuit breaker: interfaces & data model ready; not live

## Acceptance path

1. Open `/vis`
2. **New Integration** → describe requirement → Analyze
3. Review design + override language
4. Create demo connections → discover forms → discover schema → edit mappings → save DRAFT
5. Validate → create execution → view structured logs

## Security

- Secret handles only (`CredentialReference`); API masks secrets
- SSRF URL checks (`assertSafeOutboundUrl`); private hosts require `allowPrivateNetwork`
- AI never activates production integrations
