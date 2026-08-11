-- Fix signup: organizations INSERT was blocked after
-- "Allow organization creation" was dropped (20260608041111).
-- Provide a secure RPC that creates org + admin profile + default project,
-- and restore minimal SELECT policies so members can load their org.

-- Members can view their own organization
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = public.get_current_user_organization_id()
  OR EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.organization_id = organizations.id
      AND uo.user_id = auth.uid()
  )
  OR admin_email = (auth.jwt() ->> 'email')
);

-- Allow users to insert their own profile row (id must match auth.uid())
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Secure signup bootstrap: bypass RLS only inside this function
CREATE OR REPLACE FUNCTION public.register_new_organization(
  p_name text,
  p_domain text,
  p_description text DEFAULT NULL,
  p_admin_first_name text DEFAULT NULL,
  p_admin_last_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_org_id uuid;
  v_project_id uuid;
  v_first text := NULLIF(trim(COALESCE(p_admin_first_name, '')), '');
  v_last text := NULLIF(trim(COALESCE(p_admin_last_name, '')), '');
  v_domain text := NULLIF(trim(LOWER(COALESCE(p_domain, ''))), '');
  v_name text := NULLIF(trim(COALESCE(p_name, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register an organization';
  END IF;

  IF v_email IS NULL OR length(v_email) = 0 THEN
    RAISE EXCEPTION 'Authenticated user email is required';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  IF v_domain IS NULL THEN
    v_domain := regexp_replace(LOWER(v_name), '[^a-z0-9]+', '-', 'g');
    v_domain := trim(BOTH '-' FROM v_domain);
    IF v_domain IS NULL OR length(v_domain) = 0 THEN
      v_domain := 'org';
    END IF;
    v_domain := v_domain || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;

  -- If this user already has an organization, return it (idempotent)
  SELECT organization_id INTO v_org_id
  FROM public.user_profiles
  WHERE id = v_user_id
    AND organization_id IS NOT NULL;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  INSERT INTO public.organizations (
    name,
    domain,
    description,
    admin_email,
    status
  )
  VALUES (
    v_name,
    v_domain,
    NULLIF(trim(COALESCE(p_description, '')), ''),
    v_email,
    'active'
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.user_profiles (
    id,
    email,
    first_name,
    last_name,
    organization_id,
    role,
    status
  )
  VALUES (
    v_user_id,
    v_email,
    COALESCE(v_first, split_part(v_email, '@', 1)),
    COALESCE(v_last, COALESCE(v_first, split_part(v_email, '@', 1))),
    v_org_id,
    'admin',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.user_profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.user_profiles.last_name),
    organization_id = EXCLUDED.organization_id,
    role = 'admin',
    status = 'active';

  -- Membership sync trigger should also run; upsert for safety
  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'admin')
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET role = 'admin';

  -- Default project so form creation works immediately
  INSERT INTO public.projects (
    name,
    description,
    organization_id,
    created_by,
    status
  )
  VALUES (
    'Default Project',
    'Auto-created project for ' || v_name,
    v_org_id,
    v_user_id,
    'active'
  )
  RETURNING id INTO v_project_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.project_users
    WHERE project_id = v_project_id AND user_id = v_user_id
  ) THEN
    INSERT INTO public.project_users (project_id, user_id, role, assigned_by)
    VALUES (v_project_id, v_user_id, 'admin', v_user_id);
  END IF;

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_new_organization(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_new_organization(text, text, text, text, text) TO authenticated;
