-- Append-only history of configuration package actions (export now; install, upgrade,
-- rollback and uninstall in later releases). Written by the backend with the service role.
-- Organisation admins read their own organisation's history; platform admins read all.
-- Requires 20261102150000_module_entitlements.sql (is_platform_admin).
-- Safe to run more than once. Apply in the Supabase SQL Editor for each environment.

CREATE TABLE IF NOT EXISTS public.package_audit_log (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  project_id uuid,
  actor_id uuid,
  action text NOT NULL,
  package_key text NOT NULL,
  package_version text NOT NULL,
  checksum text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS package_audit_log_org_idx ON public.package_audit_log (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS package_audit_log_package_idx ON public.package_audit_log (package_key, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.package_audit_log_is_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'package_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS package_audit_log_append_only ON public.package_audit_log;
CREATE TRIGGER package_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.package_audit_log
FOR EACH ROW EXECUTE FUNCTION public.package_audit_log_is_append_only();

ALTER TABLE public.package_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_audit_log_read ON public.package_audit_log;
CREATE POLICY package_audit_log_read ON public.package_audit_log FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND public.is_org_admin_of(organization_id))
    OR public.is_platform_admin()
  );

REVOKE ALL ON public.package_audit_log FROM anon, authenticated;
GRANT SELECT ON public.package_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.package_audit_log TO service_role;
GRANT USAGE ON SEQUENCE public.package_audit_log_id_seq TO service_role;
