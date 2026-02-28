
-- =============================================
-- 1. Enhance policies table with ServiceNow-style fields
-- =============================================
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS next_review_date DATE,
  ADD COLUMN IF NOT EXISTS review_cycle_days INTEGER DEFAULT 365,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS policy_number TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgment_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exception_allowed BOOLEAN DEFAULT true;

-- =============================================
-- 2. Policy Acknowledgments (Attestation)
-- =============================================
CREATE TABLE public.policy_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_acknowledged INTEGER NOT NULL DEFAULT 1,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  comments TEXT
);

ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own acknowledgments"
  ON public.policy_acknowledgments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge policies"
  ON public.policy_acknowledgments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins can view all acknowledgments"
  ON public.policy_acknowledgments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.user_profiles up ON up.organization_id = p.organization_id
      WHERE p.id = policy_id AND up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Unique constraint: one ack per user per policy version
CREATE UNIQUE INDEX idx_policy_ack_unique ON public.policy_acknowledgments (policy_id, user_id, version_acknowledged);

-- =============================================
-- 3. Policy Exceptions
-- =============================================
CREATE TABLE public.policy_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reason TEXT NOT NULL,
  justification TEXT,
  risk_assessment TEXT,
  compensating_controls TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.policy_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exceptions"
  ON public.policy_exceptions FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "Users can create exceptions"
  ON public.policy_exceptions FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Org admins can manage all exceptions"
  ON public.policy_exceptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.user_profiles up ON up.organization_id = p.organization_id
      WHERE p.id = policy_id AND up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- =============================================
-- 4. Policy Review Schedules
-- =============================================
CREATE TABLE public.policy_review_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  reviewer_id UUID,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'overdue')),
  findings TEXT,
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('no_change', 'minor_update', 'major_revision', 'retire')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.policy_review_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view review cycles"
  ON public.policy_review_cycles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.project_users pu ON pu.project_id = p.project_id
      WHERE p.id = policy_id AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage review cycles"
  ON public.policy_review_cycles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.policies p
      JOIN public.user_profiles up ON up.organization_id = p.organization_id
      WHERE p.id = policy_id AND up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- =============================================
-- 5. Auto-generate policy number
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_policy_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.policy_number IS NULL THEN
    prefix := 'POL';
    SELECT COALESCE(MAX(
      CASE WHEN policy_number ~ '^POL-[0-9]+$'
        THEN SUBSTRING(policy_number FROM 5)::INTEGER
        ELSE 0
      END
    ), 0) + 1 INTO seq_num FROM policies;
    NEW.policy_number := prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_policy_number
  BEFORE INSERT ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_policy_number();
