drop policy if exists "Project members can create dashboards" on public.dashboards;

drop policy if exists "Users can create reports" on public.reports;
drop policy if exists "Users can create reports in their organization" on public.reports;

create or replace function public.user_can_create_report_in_project(_project_id uuid, _user_id uuid)
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
          (rp.resource_type = 'report' and rp.resource_id is null)
          or (rp.resource_type = 'dashboard' and rp.resource_id is null)
          or (rp.resource_type = 'project' and rp.resource_id = _project_id)
        )
    );
$$;

drop policy if exists "Role-based users can create reports" on public.reports;
create policy "Role-based users can create reports"
on public.reports
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.user_can_create_report_in_project(project_id, auth.uid())
);

notify pgrst, 'reload schema';