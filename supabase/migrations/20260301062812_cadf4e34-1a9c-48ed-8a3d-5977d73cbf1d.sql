
-- Policy Ratings / Feedback
CREATE TABLE public.policy_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(policy_id, user_id)
);

ALTER TABLE public.policy_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings in their org"
  ON public.policy_ratings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.policies p
    JOIN public.user_profiles up ON up.organization_id = p.organization_id
    WHERE p.id = policy_ratings.policy_id AND up.id = auth.uid()
  ));

CREATE POLICY "Authenticated users can rate"
  ON public.policy_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating"
  ON public.policy_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rating"
  ON public.policy_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- Knowledge Base Folder Access Controls
CREATE TABLE public.knowledge_base_folder_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.knowledge_base_folders(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'user' CHECK (access_type IN ('user', 'group')),
  grantee_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(folder_id, access_type, grantee_id)
);

ALTER TABLE public.knowledge_base_folder_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage folder access"
  ON public.knowledge_base_folder_access FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can view their folder access"
  ON public.knowledge_base_folder_access FOR SELECT
  USING (grantee_id = auth.uid());
