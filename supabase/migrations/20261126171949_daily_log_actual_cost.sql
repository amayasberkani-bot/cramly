-- Track actual site costs beside each daily report, so project spend can be
-- compared with the planned budgets already recorded on projects.
alter table public.daily_logs
  add column if not exists actual_cost numeric(14, 2) not null default 0
  check (actual_cost >= 0);

-- Index foreign keys used by project, workspace-invitation, and report views.
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists daily_logs_project_id_idx on public.daily_logs (project_id);
create index if not exists workspace_invites_created_by_idx on public.workspace_invites (created_by);
