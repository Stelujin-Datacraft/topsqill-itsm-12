create or replace function public.user_has_dashboard_role_permission(_dashboard_id uuid, _user_id uuid, _permission_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dashboards d
    join public.user_role_assignments ura
      on ura.user_id = _user_id
    join public.role_permissions rp
      on rp.role_id = ura.role_id
    where d.id = _dashboard_id
      and rp.permission_type = _permission_type
      and (
        (rp.resource_type = 'dashboard' and rp.resource_id = d.id)
        or (rp.resource_type = 'project' and rp.resource_id = d.project_id)
      )
  );
$$;

create or replace function public.user_has_report_role_permission(_report_id uuid, _user_id uuid, _permission_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    join public.user_role_assignments ura
      on ura.user_id = _user_id
    join public.role_permissions rp
      on rp.role_id = ura.role_id
    where r.id = _report_id
      and rp.permission_type = _permission_type
      and (
        (rp.resource_type = 'report' and rp.resource_id = r.id)
        or (rp.resource_type = 'project' and rp.resource_id = r.project_id)
      )
  );
$$;

create or replace function public.user_has_policy_role_permission(_policy_id uuid, _user_id uuid, _permission_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.policies p
    join public.user_role_assignments ura
      on ura.user_id = _user_id
    join public.role_permissions rp
      on rp.role_id = ura.role_id
    where p.id = _policy_id
      and rp.permission_type = _permission_type
      and (
        (rp.resource_type = 'policy' and rp.resource_id = p.id)
        or (rp.resource_type = 'project' and rp.resource_id = p.project_id)
      )
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
    join public.role_permissions rp
      on rp.role_id = ura.role_id
    where ura.user_id = _user_id
      and (
        (rp.resource_type = 'project' and rp.resource_id = _project_id)
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
    join public.role_permissions rp
      on rp.role_id = ura.role_id
    where ura.user_id = _user_id
      and (
        (rp.resource_type = 'project' and rp.resource_id = _project_id)
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
    join public.role_permissions rp
      on rp.role_id = ura.role_id
    where ura.user_id = _user_id
      and (
        (rp.resource_type = 'project' and rp.resource_id = _project_id)
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

create or replace function public.user_can_create_dashboard_in_project(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_project(_project_id, _user_id)
    and exists (
      select 1
      from public.user_role_assignments ura
      join public.role_permissions rp
        on rp.role_id = ura.role_id
      where ura.user_id = _user_id
        and rp.permission_type = 'create'
        and (
          (rp.resource_type = 'dashboard' and rp.resource_id is null)
          or (rp.resource_type = 'project' and rp.resource_id = _project_id)
        )
    );
$$;

create or replace function public.user_can_create_policy_in_project(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_project(_project_id, _user_id)
    and exists (
      select 1
      from public.user_role_assignments ura
      join public.role_permissions rp
        on rp.role_id = ura.role_id
      where ura.user_id = _user_id
        and rp.permission_type = 'create'
        and (
          (rp.resource_type = 'policy' and rp.resource_id is null)
          or (rp.resource_type = 'project' and rp.resource_id = _project_id)
        )
    );
$$;

drop policy if exists "Role-based users can create dashboards" on public.dashboards;
create policy "Role-based users can create dashboards"
on public.dashboards
for insert
to authenticated
with check (
  created_by = (auth.uid())::text
  and public.user_can_create_dashboard_in_project(project_id, auth.uid())
);

drop policy if exists "Role-based users can update dashboards" on public.dashboards;
create policy "Role-based users can update dashboards"
on public.dashboards
for update
to authenticated
using (public.user_has_dashboard_role_permission(id, auth.uid(), 'update'))
with check (public.user_has_dashboard_role_permission(id, auth.uid(), 'update'));

drop policy if exists "Role-based users can delete dashboards" on public.dashboards;
create policy "Role-based users can delete dashboards"
on public.dashboards
for delete
to authenticated
using (public.user_has_dashboard_role_permission(id, auth.uid(), 'delete'));

drop policy if exists "Role-based users can create policies" on public.policies;
create policy "Role-based users can create policies"
on public.policies
for insert
to authenticated
with check (public.user_can_create_policy_in_project(project_id, auth.uid()));

drop policy if exists "Role-based users can update policies" on public.policies;
create policy "Role-based users can update policies"
on public.policies
for update
to authenticated
using (public.user_has_policy_role_permission(id, auth.uid(), 'update'))
with check (public.user_has_policy_role_permission(id, auth.uid(), 'update'));

drop policy if exists "Role-based users can delete policies" on public.policies;
create policy "Role-based users can delete policies"
on public.policies
for delete
to authenticated
using (public.user_has_policy_role_permission(id, auth.uid(), 'delete'));

drop policy if exists "Role-based users can update reports" on public.reports;
create policy "Role-based users can update reports"
on public.reports
for update
to authenticated
using (public.user_has_report_role_permission(id, auth.uid(), 'update'))
with check (public.user_has_report_role_permission(id, auth.uid(), 'update'));

drop policy if exists "Role-based users can delete reports" on public.reports;
create policy "Role-based users can delete reports"
on public.reports
for delete
to authenticated
using (public.user_has_report_role_permission(id, auth.uid(), 'delete'));

notify pgrst, 'reload schema';