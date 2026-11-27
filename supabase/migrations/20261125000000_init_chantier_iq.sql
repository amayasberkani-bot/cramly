create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  city text not null default '',
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'on' check (status in ('on', 'delayed', 'complete')),
  start_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'review', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  area text not null,
  activities text not null,
  blockers text not null default '',
  log_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'review')),
  created_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists tasks_user_project_idx on public.tasks (user_id, project_id);
create index if not exists daily_logs_user_project_idx on public.daily_logs (user_id, project_id);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_logs enable row level security;

revoke all on public.projects, public.tasks, public.daily_logs from anon;
grant select, insert, update, delete on public.projects, public.tasks, public.daily_logs to authenticated;

drop policy if exists "Users manage their projects" on public.projects;
create policy "Users manage their projects" on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their tasks" on public.tasks;
create policy "Users manage their tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage their daily logs" on public.daily_logs;
create policy "Users manage their daily logs" on public.daily_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );
