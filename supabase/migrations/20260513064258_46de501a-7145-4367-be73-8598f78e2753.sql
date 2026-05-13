
ALTER TABLE public.ldap_configurations
  ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'ldap',
  ADD COLUMN IF NOT EXISTS oidc_issuer_url text,
  ADD COLUMN IF NOT EXISTS oidc_client_id text,
  ADD COLUMN IF NOT EXISTS oidc_client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS oidc_tenant_id text,
  ADD COLUMN IF NOT EXISTS oidc_redirect_uri text,
  ADD COLUMN IF NOT EXISTS oidc_scopes text[] DEFAULT ARRAY['openid','email','profile'],
  ADD COLUMN IF NOT EXISTS oidc_groups_claim text DEFAULT 'groups',
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ldap_configurations
  ALTER COLUMN server_url DROP NOT NULL,
  ALTER COLUMN base_dn DROP NOT NULL;

ALTER TABLE public.ldap_configurations
  DROP CONSTRAINT IF EXISTS ldap_configurations_provider_type_check;
ALTER TABLE public.ldap_configurations
  ADD CONSTRAINT ldap_configurations_provider_type_check
  CHECK (provider_type IN ('ldap','active_directory','azure_entra','google_workspace','okta','aws_directory'));

ALTER TABLE public.ldap_configurations
  DROP CONSTRAINT IF EXISTS ldap_configurations_provider_fields_check;
ALTER TABLE public.ldap_configurations
  ADD CONSTRAINT ldap_configurations_provider_fields_check
  CHECK (
    (provider_type IN ('ldap','active_directory','aws_directory')
       AND server_url IS NOT NULL AND base_dn IS NOT NULL)
    OR
    (provider_type IN ('azure_entra','google_workspace','okta')
       AND oidc_issuer_url IS NOT NULL AND oidc_client_id IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';
