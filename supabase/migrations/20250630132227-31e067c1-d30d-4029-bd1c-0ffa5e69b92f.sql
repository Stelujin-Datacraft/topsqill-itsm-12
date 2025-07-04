
-- Create table for groups
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization_id UUID NOT NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, organization_id)
);

-- Create table for group memberships (users and nested groups)
CREATE TABLE public.group_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  member_type TEXT NOT NULL CHECK (member_type IN ('user', 'group')),
  added_by UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, member_id, member_type)
);

-- Enable RLS on groups table
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Enable RLS on group_memberships table
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

-- RLS policies for groups table
CREATE POLICY "Organization admins can manage groups"
  ON public.groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
      AND up.organization_id = groups.organization_id
    )
  );

-- RLS policies for group_memberships table
CREATE POLICY "Organization admins can manage group memberships"
  ON public.group_memberships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.user_profiles up ON up.organization_id = g.organization_id
      WHERE g.id = group_memberships.group_id
      AND up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

-- Function to get group members with details
CREATE OR REPLACE FUNCTION public.get_group_members(_group_id uuid)
RETURNS TABLE(
  member_id uuid,
  member_type text,
  member_name text,
  member_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    gm.member_id,
    gm.member_type,
    CASE 
      WHEN gm.member_type = 'user' THEN 
        COALESCE(up.first_name || ' ' || up.last_name, up.email)
      WHEN gm.member_type = 'group' THEN g.name
    END as member_name,
    CASE 
      WHEN gm.member_type = 'user' THEN up.email
      ELSE NULL
    END as member_email
  FROM public.group_memberships gm
  LEFT JOIN public.user_profiles up ON gm.member_id = up.id AND gm.member_type = 'user'
  LEFT JOIN public.groups g ON gm.member_id = g.id AND gm.member_type = 'group'
  WHERE gm.group_id = _group_id
  ORDER BY gm.member_type, member_name;
$$;
