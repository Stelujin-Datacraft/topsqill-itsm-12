-- 1. Membership table
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON public.user_organizations(organization_id);

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- 2. Helper: is the caller an admin of a given org? (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_admin_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND organization_id = _org_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND role = 'admin'
  );
$$;

-- 3. RLS policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_organizations;
CREATE POLICY "Users can view their own memberships"
  ON public.user_organizations FOR SELECT
  USING (user_id = auth.uid() OR public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS "Org admins can add members" ON public.user_organizations;
CREATE POLICY "Org admins can add members"
  ON public.user_organizations FOR INSERT
  WITH CHECK (public.is_org_admin_of(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins can update members" ON public.user_organizations;
CREATE POLICY "Org admins can update members"
  ON public.user_organizations FOR UPDATE
  USING (public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS "Members can leave or admins can remove" ON public.user_organizations;
CREATE POLICY "Members can leave or admins can remove"
  ON public.user_organizations FOR DELETE
  USING (user_id = auth.uid() OR public.is_org_admin_of(organization_id));

-- 4. Backfill from existing user_profiles
INSERT INTO public.user_organizations (user_id, organization_id, role, joined_at)
SELECT up.id, up.organization_id, COALESCE(up.role,'user'), COALESCE(up.created_at, now())
FROM public.user_profiles up
WHERE up.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- 5. Auto-create membership row whenever user_profiles.organization_id is set
CREATE OR REPLACE FUNCTION public.sync_active_org_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (NEW.id, NEW.organization_id, COALESCE(NEW.role, 'user'))
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_active_org_membership ON public.user_profiles;
CREATE TRIGGER trg_sync_active_org_membership
  AFTER INSERT OR UPDATE OF organization_id ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_active_org_membership();

-- 6. Safe org switcher — validates membership before updating active org
CREATE OR REPLACE FUNCTION public.switch_active_organization(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_member boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _uid AND organization_id = _org_id
  ) INTO _is_member;

  IF NOT _is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a member of this organization');
  END IF;

  UPDATE public.user_profiles
  SET organization_id = _org_id
  WHERE id = _uid;

  RETURN jsonb_build_object('success', true, 'organization_id', _org_id);
END;
$$;

-- 7. Helper to list memberships with org details for the current user
CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS TABLE (
  organization_id uuid,
  name text,
  domain text,
  logo_url text,
  role text,
  is_active boolean,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.domain, o.logo_url, uo.role,
         (o.id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())) AS is_active,
         uo.joined_at
  FROM public.user_organizations uo
  JOIN public.organizations o ON o.id = uo.organization_id
  WHERE uo.user_id = auth.uid()
    AND o.status = 'active'
  ORDER BY is_active DESC, o.name;
$$;

NOTIFY pgrst, 'reload schema';