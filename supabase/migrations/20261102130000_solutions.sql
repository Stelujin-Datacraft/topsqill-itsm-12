-- Solutions group the forms of a project (like Archer solutions grouping applications).
-- A solution only says which forms belong together; it does not change form access.
-- Each form belongs to at most one solution, so moving a form is a single update.
--
-- Safe to run more than once. Apply in the Supabase SQL Editor for each environment.

CREATE TABLE IF NOT EXISTS public.solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  color text NOT NULL DEFAULT 'teal',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS solutions_project_name_key
  ON public.solutions (project_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.solution_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id uuid NOT NULL REFERENCES public.solutions(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  added_by uuid DEFAULT auth.uid(),
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solution_forms_form_id_key UNIQUE (form_id)
);

CREATE INDEX IF NOT EXISTS solution_forms_solution_id_idx ON public.solution_forms (solution_id);

CREATE OR REPLACE FUNCTION public.touch_solutions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solutions_touch_updated_at ON public.solutions;
CREATE TRIGGER solutions_touch_updated_at
BEFORE UPDATE ON public.solutions
FOR EACH ROW EXECUTE FUNCTION public.touch_solutions_updated_at();

-- Org admins, the project creator and project admins/editors organise solutions.
CREATE OR REPLACE FUNCTION public.can_manage_project_solutions(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        p.created_by = auth.uid()
        OR public.is_org_admin_of(p.organization_id)
        OR EXISTS (
          SELECT 1 FROM public.project_users pu
          WHERE pu.project_id = p.id
            AND pu.user_id = auth.uid()
            AND pu.role IN ('admin', 'editor')
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_project_solutions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_project_solutions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_project_solutions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_in_organization(_project_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.organization_id = _org_id);
$$;

REVOKE ALL ON FUNCTION public.project_in_organization(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_in_organization(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.project_in_organization(uuid, uuid) TO authenticated, service_role;

-- A form can only join a solution of its own project.
CREATE OR REPLACE FUNCTION public.solution_form_in_project(_solution_id uuid, _form_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.solutions s
    JOIN public.forms f ON f.project_id = s.project_id
    WHERE s.id = _solution_id AND f.id = _form_id
  );
$$;

REVOKE ALL ON FUNCTION public.solution_form_in_project(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solution_form_in_project(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.solution_form_in_project(uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solutions_select ON public.solutions;
CREATE POLICY solutions_select ON public.solutions
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()) OR public.is_org_admin_of(organization_id));

DROP POLICY IF EXISTS solutions_insert ON public.solutions;
CREATE POLICY solutions_insert ON public.solutions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_project_solutions(project_id)
    AND public.project_in_organization(project_id, organization_id)
  );

DROP POLICY IF EXISTS solutions_update ON public.solutions;
CREATE POLICY solutions_update ON public.solutions
  FOR UPDATE TO authenticated
  USING (public.can_manage_project_solutions(project_id))
  WITH CHECK (
    public.can_manage_project_solutions(project_id)
    AND public.project_in_organization(project_id, organization_id)
  );

DROP POLICY IF EXISTS solutions_delete ON public.solutions;
CREATE POLICY solutions_delete ON public.solutions
  FOR DELETE TO authenticated
  USING (public.can_manage_project_solutions(project_id));

DROP POLICY IF EXISTS solution_forms_select ON public.solution_forms;
CREATE POLICY solution_forms_select ON public.solution_forms
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.solutions s
    WHERE s.id = solution_id
      AND (public.can_view_project(s.project_id, auth.uid()) OR public.is_org_admin_of(s.organization_id))
  ));

DROP POLICY IF EXISTS solution_forms_insert ON public.solution_forms;
CREATE POLICY solution_forms_insert ON public.solution_forms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.solution_form_in_project(solution_id, form_id)
    AND EXISTS (SELECT 1 FROM public.solutions s WHERE s.id = solution_id AND public.can_manage_project_solutions(s.project_id))
  );

DROP POLICY IF EXISTS solution_forms_update ON public.solution_forms;
CREATE POLICY solution_forms_update ON public.solution_forms
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solutions s WHERE s.id = solution_id AND public.can_manage_project_solutions(s.project_id)))
  WITH CHECK (
    public.solution_form_in_project(solution_id, form_id)
    AND EXISTS (SELECT 1 FROM public.solutions s WHERE s.id = solution_id AND public.can_manage_project_solutions(s.project_id))
  );

DROP POLICY IF EXISTS solution_forms_delete ON public.solution_forms;
CREATE POLICY solution_forms_delete ON public.solution_forms
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solutions s WHERE s.id = solution_id AND public.can_manage_project_solutions(s.project_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solution_forms TO authenticated;
GRANT ALL ON public.solutions, public.solution_forms TO service_role;
