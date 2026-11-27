-- Shared workspaces for CHANTIER IQ.
-- Owners manage membership; editors update work records; viewers are read-only.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'CHANTIER IQ',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor', 'viewer')),
  token_hash bytea not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id, workspace_id);
create index if not exists workspace_invites_workspace_idx on public.workspace_invites (workspace_id, created_at desc);
create unique index if not exists workspace_invites_pending_email_idx
  on public.workspace_invites (workspace_id, lower(email)) where accepted_at is null;

alter table public.projects add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
create index if not exists projects_workspace_id_idx on public.projects (workspace_id);

-- Preserve access to existing projects by assigning each current owner a workspace.
insert into public.workspaces (owner_id, name)
select distinct p.user_id,
       coalesce(nullif(u.raw_user_meta_data ->> 'company', ''), nullif(split_part(u.email, '@', 1), ''), 'CHANTIER IQ')
from public.projects p
join auth.users u on u.id = p.user_id
on conflict (owner_id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner' from public.workspaces w
on conflict (workspace_id, user_id) do update set role = 'owner';

update public.projects p set workspace_id = w.id
from public.workspaces w
where p.user_id = w.owner_id and p.workspace_id is null;
alter table public.projects alter column workspace_id set not null;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_workspace(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.ensure_my_workspace()
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select w.id into v_workspace_id from public.workspaces w where w.owner_id = v_user_id;
  if v_workspace_id is null then
    select m.workspace_id into v_workspace_id
    from public.workspace_members m where m.user_id = v_user_id
    order by m.created_at limit 1;
  end if;

  if v_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    select v_workspace_id, v_user_id, 'owner'
    where exists (select 1 from public.workspaces w where w.id = v_workspace_id and w.owner_id = v_user_id)
    on conflict (workspace_id, user_id) do nothing;
    return v_workspace_id;
  end if;

  select coalesce(nullif(u.raw_user_meta_data ->> 'company', ''), nullif(split_part(u.email, '@', 1), ''), 'CHANTIER IQ')
  into v_name from auth.users u where u.id = v_user_id;

  insert into public.workspaces (owner_id, name)
  values (v_user_id, coalesce(v_name, 'CHANTIER IQ'))
  on conflict (owner_id) do update set owner_id = excluded.owner_id
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';

  return v_workspace_id;
end;
$$;

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (user_id uuid, email text, display_name text, role text, created_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'workspace access denied' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text,
      coalesce(nullif(u.raw_user_meta_data ->> 'company', ''), split_part(u.email, '@', 1))::text,
      m.role, m.created_at
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
    order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, m.created_at;
end;
$$;

create or replace function public.create_workspace_invite(p_workspace_id uuid, p_email text, p_role text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_email text := lower(trim(p_email));
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'only the workspace owner can invite members' using errcode = '42501';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'valid email required' using errcode = '22023';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invalid member role' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and lower(u.email) = v_email
  ) then
    raise exception 'user is already a workspace member' using errcode = '23505';
  end if;

  insert into public.workspace_invites (workspace_id, email, role, token_hash, created_by)
  values (p_workspace_id, v_email, p_role, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), auth.uid())
  on conflict (workspace_id, lower(email)) where accepted_at is null
  do update set role = excluded.role, token_hash = excluded.token_hash, expires_at = now() + interval '7 days', created_by = excluded.created_by, created_at = now();

  return v_token;
end;
$$;

create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_workspace_id uuid;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select lower(u.email) into v_email from auth.users u
  where u.id = v_user_id and u.email_confirmed_at is not null;
  if v_email is null then
    raise exception 'verified email required' using errcode = '28000';
  end if;
  if p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'invitation is invalid, expired, or belongs to another email' using errcode = '22023';
  end if;
  select i.workspace_id, i.role into v_workspace_id, v_role
  from public.workspace_invites i
  where i.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    and lower(i.email) = v_email and i.accepted_at is null and i.expires_at > now()
  for update;
  if v_workspace_id is null then
    raise exception 'invitation is invalid, expired, or belongs to another email' using errcode = '22023';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, v_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  update public.workspace_invites set accepted_at = now()
  where token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
  return v_workspace_id;
end;
$$;

create or replace function public.remove_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'only the workspace owner can remove members' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'workspace owner cannot remove themselves' using errcode = '22023';
  end if;
  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id and role <> 'owner';
  delete from public.workspace_invites
  where workspace_id = p_workspace_id and lower(email) = (select lower(email) from auth.users where id = p_user_id);
end;
$$;

create or replace function public.prevent_project_scope_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then
    raise exception 'project workspace and owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_record_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'record owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_project_scope_change on public.projects;
create trigger prevent_project_scope_change before update on public.projects
for each row execute function public.prevent_project_scope_change();

drop trigger if exists prevent_task_owner_change on public.tasks;
create trigger prevent_task_owner_change before update on public.tasks
for each row execute function public.prevent_record_owner_change();

drop trigger if exists prevent_daily_log_owner_change on public.daily_logs;
create trigger prevent_daily_log_owner_change before update on public.daily_logs
for each row execute function public.prevent_record_owner_change();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

revoke all on public.workspaces, public.workspace_members, public.workspace_invites from anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects, public.tasks, public.daily_logs to authenticated;

drop policy if exists "Users manage their projects" on public.projects;
create policy "Workspace members read projects" on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "Workspace editors create projects" on public.projects for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_edit_workspace(workspace_id));
create policy "Workspace editors update projects" on public.projects for update to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));
create policy "Workspace owners delete projects" on public.projects for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

drop policy if exists "Users manage their tasks" on public.tasks;
create policy "Workspace members read tasks" on public.tasks for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));
create policy "Workspace members create tasks" on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)));
create policy "Workspace members update tasks" on public.tasks for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)));
create policy "Workspace editors delete tasks" on public.tasks for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)));

drop policy if exists "Users manage their daily logs" on public.daily_logs;
create policy "Workspace members read daily logs" on public.daily_logs for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));
create policy "Workspace members create daily logs" on public.daily_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)));
create policy "Workspace members update daily logs" on public.daily_logs for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)));
create policy "Workspace editors delete daily logs" on public.daily_logs for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.can_edit_workspace(p.workspace_id)));

drop policy if exists "Workspace members can read workspace" on public.workspaces;
create policy "Workspace members can read workspace" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
drop policy if exists "Workspace members can read member list" on public.workspace_members;
create policy "Workspace members can read member list" on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_owner(uuid) from public, anon;
revoke all on function public.can_edit_workspace(uuid) from public, anon;
revoke all on function public.prevent_project_scope_change() from public, anon, authenticated;
revoke all on function public.prevent_record_owner_change() from public, anon, authenticated;
revoke all on function public.ensure_my_workspace() from public, anon;
revoke all on function public.list_workspace_members(uuid) from public, anon;
revoke all on function public.create_workspace_invite(uuid, text, text) from public, anon;
revoke all on function public.accept_workspace_invite(text) from public, anon;
revoke all on function public.remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.can_edit_workspace(uuid) to authenticated;
grant execute on function public.ensure_my_workspace() to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.create_workspace_invite(uuid, text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;

comment on table public.workspace_invites is 'Invitations are email-bound and can only be inspected or accepted through security-definer RPCs.';
