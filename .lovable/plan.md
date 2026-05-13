## Goal

Extend the current LDAP/AD module so the same UI and authentication flow can also connect to **Azure Entra ID (OIDC)**, **Google Workspace Identity (OIDC)**, **Okta (OIDC)**, and **AWS Directory Service / Simple AD (LDAPS)** — keeping classic on-prem LDAP/AD working.

## Changes

### 1. Database (one migration)

Add columns to `ldap_configurations` (kept for backward compatibility, but the module is now an "Identity Provider" config):

- `provider_type text not null default 'ldap'` — one of: `ldap`, `active_directory`, `azure_entra`, `google_workspace`, `okta`, `aws_directory`
- `oidc_issuer_url text` — discovery URL (e.g. `https://login.microsoftonline.com/{tenantId}/v2.0`)
- `oidc_client_id text`
- `oidc_client_secret_encrypted text`
- `oidc_tenant_id text` — Azure tenant / Okta domain / Google customer ID
- `oidc_redirect_uri text`
- `oidc_scopes text[] default '{openid,email,profile}'`
- `oidc_groups_claim text default 'groups'`
- `provider_metadata jsonb default '{}'` — provider-specific extras (e.g. AWS region, directory_id)

All LDAP-specific columns become nullable (already are).
Add a `CHECK` constraint: when `provider_type` is `ldap`/`active_directory`/`aws_directory` → `server_url` and `base_dn` required; when OIDC-based → `oidc_issuer_url` and `oidc_client_id` required.

### 2. Provider abstraction (edge functions)

Refactor authentication into a provider-strategy pattern in `supabase/functions/_shared/idp/`:

- `types.ts` — `IdpProvider` interface: `authenticate()`, `testConnection()`, `syncUsers()`, `getAuthorizationUrl()`, `handleCallback()`
- `ldap.ts` — existing LDAP/AD logic (Deno.connect)
- `azure-entra.ts` — OIDC via `https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration`, Microsoft Graph for group sync
- `google-workspace.ts` — OIDC via Google Identity, Admin SDK for groups
- `okta.ts` — OIDC via `https://{domain}/.well-known/openid-configuration`, Okta Users/Groups API
- `aws-directory.ts` — LDAPS to AWS Managed Microsoft AD (reuses `ldap.ts` with AWS-specific defaults)
- `factory.ts` — `getProvider(config)` returns the right strategy

### 3. Edge functions

- Rename intent of existing functions (keep names for compatibility):
  - `ldap-authenticate` → routes to provider strategy based on `provider_type`
  - `ldap-test-connection` → same
  - `ldap-sync` → same
- Add **new** function: `idp-oauth-callback` (verify_jwt = false) — handles OIDC redirect, exchanges code for tokens, validates ID token, provisions/links user, signs them into Supabase Auth.

### 4. Frontend

- `src/pages/LdapSettings.tsx` → rename concept to "Identity Provider Settings" (keep route): add provider type selector at top, conditionally render either LDAP fields or OIDC fields (issuer, client ID/secret, tenant, redirect URI).
- `src/components/idp/` (new folder, leave `ldap/` for back-compat re-exports):
  - `ProviderTypeSelector.tsx` — cards for the 6 provider types with logos/descriptions
  - `OidcConfigForm.tsx` — OIDC fields with per-provider helpers (Azure shows tenant ID input + auto-builds issuer URL; Okta shows domain; Google shows customer ID)
  - `LdapConfigForm.tsx` — extracted existing LDAP fields
- `src/components/ldap/LdapLoginForm.tsx` → becomes `IdpLoginForm.tsx`: when provider is OIDC, renders a "Sign in with {Provider}" button that triggers `supabase.auth.signInWithOAuth` (for Azure/Google) or redirects to `idp-oauth-callback` for Okta/custom. When LDAP, keeps current username/password form.
- `useLdapConfiguration.ts` → extend type with new OIDC fields; add helper `isOidcProvider(config)`.

### 5. Group / role mapping

`ldap_group_mappings` already supports group-DN → role/group. Reuse as-is — for OIDC providers we store group display name or object ID instead of a DN; the existing matching logic (`includes(ldap_group_dn)`) already works.

### 6. Config defaults helper

Add `src/lib/idp/providerDefaults.ts` exporting per-provider sensible defaults (e.g. Azure: scopes `openid email profile User.Read GroupMember.Read.All`, groups claim `groups`; Google: scopes include `https://www.googleapis.com/auth/admin.directory.group.readonly`).

## Out of scope

- SAML providers (can be added later via the same strategy pattern)
- SCIM provisioning
- Replacing the existing simulated LDAP bind with a real production LDAP client (already a known limitation in the codebase comment)

## Validation

- Provider selector switches form fields correctly
- Saving a config of each type persists with correct CHECK constraints
- Test Connection button calls the right strategy and returns provider-specific success/error messages
- OIDC login button on `Auth` page redirects to provider when configured
- Existing LDAP configs keep working (`provider_type` defaults to `ldap`)
