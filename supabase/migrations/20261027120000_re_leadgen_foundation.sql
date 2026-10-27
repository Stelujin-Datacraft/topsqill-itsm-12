-- Real Estate lead-gen foundation (ADDITIVE ONLY).
-- Does not ALTER forms, workflows, auth helpers, or existing ITSM tables.
-- Soft-links to form engine via nullable form_id / form_submission_id (no FKs
-- onto forms/form_submissions so apply order stays safe and engines stay untouched).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.re_profile_type AS ENUM ('buyer', 'seller', 'dealer', 'builder');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.re_listing_status AS ENUM ('draft', 'active', 'under_offer', 'sold', 'rented', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.re_lead_status AS ENUM (
    'new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'won', 'lost', 'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Profiles (Buyer / Seller / Dealer / Builder) — lead-gen personas, not social
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.re_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_type public.re_profile_type NOT NULL,
  display_name text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  form_id uuid,
  form_submission_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_profiles_org ON public.re_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_re_profiles_project ON public.re_profiles (project_id);
CREATE INDEX IF NOT EXISTS idx_re_profiles_type ON public.re_profiles (organization_id, profile_type);
CREATE INDEX IF NOT EXISTS idx_re_profiles_user ON public.re_profiles (user_id);

-- ---------------------------------------------------------------------------
-- Property listings / builder projects (inventory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.re_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  owner_profile_id uuid REFERENCES public.re_profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  listing_kind text NOT NULL DEFAULT 'property', -- property | project
  listing_type text, -- sale | rent
  status public.re_listing_status NOT NULL DEFAULT 'draft',
  city text,
  locality text,
  latitude double precision,
  longitude double precision,
  price numeric,
  currency text DEFAULT 'INR',
  form_id uuid,
  form_submission_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_listings_org ON public.re_listings (organization_id);
CREATE INDEX IF NOT EXISTS idx_re_listings_status ON public.re_listings (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_re_listings_city ON public.re_listings (organization_id, city);

-- ---------------------------------------------------------------------------
-- Leads (CRM inbox)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.re_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  status public.re_lead_status NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  listing_id uuid REFERENCES public.re_listings(id) ON DELETE SET NULL,
  interested_profile_id uuid REFERENCES public.re_profiles(id) ON DELETE SET NULL,
  form_id uuid,
  form_submission_id uuid,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_leads_org ON public.re_leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_status ON public.re_leads (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_re_leads_assigned ON public.re_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_re_leads_listing ON public.re_leads (listing_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_created ON public.re_leads (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Lead activity timeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.re_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.re_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  body text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_lead_activities_lead ON public.re_lead_activities (lead_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS (org-scoped; uses existing auth helpers — does not replace them)
-- ---------------------------------------------------------------------------
ALTER TABLE public.re_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_lead_activities ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS re_profiles_select_org ON public.re_profiles;
CREATE POLICY re_profiles_select_org ON public.re_profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_profiles_insert_org ON public.re_profiles;
CREATE POLICY re_profiles_insert_org ON public.re_profiles
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_profiles_update_org ON public.re_profiles;
CREATE POLICY re_profiles_update_org ON public.re_profiles
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id())
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_profiles_delete_admin ON public.re_profiles;
CREATE POLICY re_profiles_delete_admin ON public.re_profiles
  FOR DELETE TO authenticated
  USING (public.is_org_admin_of(organization_id));

-- Listings
DROP POLICY IF EXISTS re_listings_select_org ON public.re_listings;
CREATE POLICY re_listings_select_org ON public.re_listings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_listings_insert_org ON public.re_listings;
CREATE POLICY re_listings_insert_org ON public.re_listings
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_listings_update_org ON public.re_listings;
CREATE POLICY re_listings_update_org ON public.re_listings
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id())
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_listings_delete_admin ON public.re_listings;
CREATE POLICY re_listings_delete_admin ON public.re_listings
  FOR DELETE TO authenticated
  USING (public.is_org_admin_of(organization_id));

-- Leads
DROP POLICY IF EXISTS re_leads_select_org ON public.re_leads;
CREATE POLICY re_leads_select_org ON public.re_leads
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_leads_insert_org ON public.re_leads;
CREATE POLICY re_leads_insert_org ON public.re_leads
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_leads_update_org ON public.re_leads;
CREATE POLICY re_leads_update_org ON public.re_leads
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id())
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_leads_delete_admin ON public.re_leads;
CREATE POLICY re_leads_delete_admin ON public.re_leads
  FOR DELETE TO authenticated
  USING (public.is_org_admin_of(organization_id));

-- Activities
DROP POLICY IF EXISTS re_lead_activities_select_org ON public.re_lead_activities;
CREATE POLICY re_lead_activities_select_org ON public.re_lead_activities
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_lead_activities_insert_org ON public.re_lead_activities;
CREATE POLICY re_lead_activities_insert_org ON public.re_lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

DROP POLICY IF EXISTS re_lead_activities_delete_admin ON public.re_lead_activities;
CREATE POLICY re_lead_activities_delete_admin ON public.re_lead_activities
  FOR DELETE TO authenticated
  USING (public.is_org_admin_of(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_lead_activities TO authenticated;

GRANT ALL ON public.re_profiles TO service_role;
GRANT ALL ON public.re_listings TO service_role;
GRANT ALL ON public.re_leads TO service_role;
GRANT ALL ON public.re_lead_activities TO service_role;
