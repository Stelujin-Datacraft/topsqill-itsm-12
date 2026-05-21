create or replace function public.user_has_any_role_assignment(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = _user_id
  );
$$;

create or replace function public.user_has_project_dashboard_role_permissions(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role_id = ura.role_id
    where ura.user_id = _user_id
      and (
        (rp.resource_type = 'project' and rp.resource_id = _project_id)
        or (rp.resource_type = 'dashboard' and rp.resource_id is null)
        or (
          rp.resource_type = 'dashboard'
          and exists (
            select 1
            from public.dashboards d
            where d.id = rp.resource_id
              and d.project_id = _project_id
          )
        )
      )
  );
$$;

create or replace function public.user_has_project_report_role_permissions(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role_id = ura.role_id
    where ura.user_id = _user_id
      and (
        (rp.resource_type = 'project' and rp.resource_id = _project_id)
        or (rp.resource_type = 'report' and rp.resource_id is null)
        or (
          rp.resource_type = 'report'
          and exists (
            select 1
            from public.reports r
            where r.id = rp.resource_id
              and r.project_id = _project_id
          )
        )
      )
  );
$$;

create or replace function public.user_has_project_policy_role_permissions(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role_id = ura.role_id
    where ura.user_id = _user_id
      and (
        (rp.resource_type = 'project' and rp.resource_id = _project_id)
        or (rp.resource_type = 'policy' and rp.resource_id is null)
        or (
          rp.resource_type = 'policy'
          and exists (
            select 1
            from public.policies p
            where p.id = rp.resource_id
              and p.project_id = _project_id
          )
        )
      )
  );
$$;

drop policy if exists "Users can view reports in their organization" on public.reports;
create policy "Users can view reports in their organization"
on public.reports
for select
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.role = 'admin'
      and up.organization_id = reports.organization_id
  )
  or created_by = auth.uid()
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = reports.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'admin'
  )
  or public.user_has_report_role_permission(reports.id, auth.uid(), 'read')
  or (
    organization_id = (
      select user_profiles.organization_id
      from public.user_profiles
      where user_profiles.id = auth.uid()
    )
    and not public.user_has_any_role_assignment(auth.uid())
  )
);

drop policy if exists "Project members can view dashboards" on public.dashboards;
create policy "Project members can view dashboards"
on public.dashboards
for select
using (
  created_by = (auth.uid())::text
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = dashboards.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'admin'
  )
  or public.user_has_dashboard_role_permission(dashboards.id, auth.uid(), 'read')
  or (
    exists (
      select 1
      from public.project_users pu
      where pu.project_id = dashboards.project_id
        and pu.user_id = auth.uid()
    )
    and not public.user_has_any_role_assignment(auth.uid())
  )
);

drop policy if exists "Users can view policies in their projects" on public.policies;
create policy "Users can view policies in their projects"
on public.policies
for select
using (
  exists (
    select 1
    from public.projects p
    join public.user_profiles up on up.organization_id = p.organization_id
    where p.id = policies.project_id
      and up.id = auth.uid()
      and up.role = 'admin'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = policies.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'admin'
  )
  or public.user_has_policy_role_permission(policies.id, auth.uid(), 'read')
  or (
    public.can_view_project(policies.project_id, auth.uid())
    and not public.user_has_any_role_assignment(auth.uid())
  )
);

drop policy if exists "Users can view KB folders in their org" on public.knowledge_base_folders;
create policy "Users can view KB folders in their org"
on public.knowledge_base_folders
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.role = 'admin'
      and up.organization_id = knowledge_base_folders.organization_id
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = knowledge_base_folders.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'admin'
  )
  or public.user_has_project_policy_role_permissions(knowledge_base_folders.project_id, auth.uid())
  or exists (
    select 1
    from public.policies p
    where p.folder_id = knowledge_base_folders.id
      and public.user_has_policy_role_permission(p.id, auth.uid(), 'read')
  )
  or (
    public.can_view_project(knowledge_base_folders.project_id, auth.uid())
    and not public.user_has_any_role_assignment(auth.uid())
  )
);

notify pgrst, 'reload schema';