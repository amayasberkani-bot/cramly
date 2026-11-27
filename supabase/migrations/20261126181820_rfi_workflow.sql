-- Basic construction RFI workflow: tenant-scoped requests, append-only thread/history.
create unique index if not exists projects_id_workspace_unique
  on public.projects (id, workspace_id);

create table public.rfis (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null,
  reference_code text not null check (length(btrim(reference_code)) between 1 and 40),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  question text not null check (length(btrim(question)) between 1 and 5000),
  area_or_drawing text not null default '' check (length(area_or_drawing) <= 240),
  assigned_to uuid references auth.users (id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'answered', 'closed', 'cancelled')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  constraint rfis_project_workspace_fk foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade
);

create unique index rfis_project_reference_unique
  on public.rfis (project_id, lower(reference_code));

create table public.rfi_messages (
  id uuid primary key default gen_random_uuid(),
  rfi_id uuid not null references public.rfis (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id),
  message_kind text not null check (message_kind in ('comment', 'answer', 'clarification')),
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.rfi_events (
  id uuid primary key default gen_random_uuid(),
  rfi_id uuid not null references public.rfis (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('created', 'answered', 'clarification_requested', 'closed', 'cancelled', 'assignment_changed')),
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create index rfis_workspace_status_created_idx on public.rfis (workspace_id, status, created_at desc);
create index rfis_project_due_date_idx on public.rfis (project_id, due_date) where status in ('open', 'answered');
create index rfi_messages_rfi_created_idx on public.rfi_messages (rfi_id, created_at);
create index rfi_events_rfi_created_idx on public.rfi_events (rfi_id, created_at);

alter table public.rfis enable row level security;
alter table public.rfi_messages enable row level security;
alter table public.rfi_events enable row level security;

revoke all on public.rfis, public.rfi_messages, public.rfi_events from anon;
revoke all on public.rfis, public.rfi_messages, public.rfi_events from authenticated;
grant select, insert on public.rfis to authenticated;
grant select, insert on public.rfi_messages to authenticated;
grant select on public.rfi_events to authenticated;

create policy rfis_workspace_read on public.rfis
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy rfis_editor_create on public.rfis
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_edit_workspace(workspace_id)
    and exists (
      select 1 from public.projects p
      where p.id = rfis.project_id and p.workspace_id = rfis.workspace_id
    )
    and (
      assigned_to is null
      or exists (
        select 1 from public.workspace_members m
        where m.workspace_id = rfis.workspace_id and m.user_id = rfis.assigned_to
      )
    )
  );

create policy rfi_messages_workspace_read on public.rfi_messages
  for select to authenticated
  using (exists (
    select 1 from public.rfis r
    where r.id = rfi_id and public.is_workspace_member(r.workspace_id)
  ));

create policy rfi_messages_editor_comment on public.rfi_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and message_kind = 'comment'
    and exists (
      select 1 from public.rfis r
      where r.id = rfi_id and public.can_edit_workspace(r.workspace_id)
    )
  );

create policy rfi_events_workspace_read on public.rfi_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.log_rfi_event()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rfi_events (rfi_id, workspace_id, actor_id, event_type, new_status)
    values (new.id, new.workspace_id, auth.uid(), 'created', new.status);
  elsif new.status is distinct from old.status then
    insert into public.rfi_events (rfi_id, workspace_id, actor_id, event_type, previous_status, new_status)
    values (
      new.id, new.workspace_id, auth.uid(),
      case new.status
        when 'answered' then 'answered'
        when 'closed' then 'closed'
        when 'cancelled' then 'cancelled'
        when 'open' then 'clarification_requested'
      end,
      old.status, new.status
    );
  elsif new.assigned_to is distinct from old.assigned_to then
    insert into public.rfi_events (rfi_id, workspace_id, actor_id, event_type, previous_status, new_status)
    values (new.id, new.workspace_id, auth.uid(), 'assignment_changed', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger rfis_log_events_after_write
  after insert or update of status, assigned_to on public.rfis
  for each row execute function public.log_rfi_event();

create or replace function public.respond_to_rfi(p_rfi_id uuid, p_body text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfi public.rfis%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if length(v_body) not between 1 and 5000 then
    raise exception 'response must contain 1 to 5000 characters' using errcode = '22023';
  end if;
  select * into v_rfi from public.rfis where id = p_rfi_id for update;
  if not found or not public.can_edit_workspace(v_rfi.workspace_id) then
    raise exception 'RFI not found or access denied' using errcode = '42501';
  end if;
  if v_rfi.status not in ('open', 'answered') then
    raise exception 'RFI cannot receive a response in its current status' using errcode = '22023';
  end if;
  if v_rfi.assigned_to is not null and v_rfi.assigned_to <> auth.uid()
     and not public.is_workspace_owner(v_rfi.workspace_id) then
    raise exception 'only the assigned member or workspace owner can respond' using errcode = '42501';
  end if;
  insert into public.rfi_messages (rfi_id, author_id, message_kind, body)
  values (v_rfi.id, auth.uid(), 'answer', v_body);
  update public.rfis set status = 'answered', answered_by = auth.uid(), answered_at = now(), updated_at = now()
  where id = v_rfi.id;
end;
$$;

create or replace function public.request_rfi_clarification(p_rfi_id uuid, p_body text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfi public.rfis%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if length(v_body) not between 1 and 5000 then
    raise exception 'clarification must contain 1 to 5000 characters' using errcode = '22023';
  end if;
  select * into v_rfi from public.rfis where id = p_rfi_id for update;
  if not found or not public.can_edit_workspace(v_rfi.workspace_id) then
    raise exception 'RFI not found or access denied' using errcode = '42501';
  end if;
  if v_rfi.status <> 'answered' or (auth.uid() <> v_rfi.created_by and not public.is_workspace_owner(v_rfi.workspace_id)) then
    raise exception 'only the requester or workspace owner can request clarification after an answer' using errcode = '42501';
  end if;
  insert into public.rfi_messages (rfi_id, author_id, message_kind, body)
  values (v_rfi.id, auth.uid(), 'clarification', v_body);
  update public.rfis set status = 'open', updated_at = now() where id = v_rfi.id;
end;
$$;

create or replace function public.close_rfi(p_rfi_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfi public.rfis%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_rfi from public.rfis where id = p_rfi_id for update;
  if not found or not public.can_edit_workspace(v_rfi.workspace_id) then
    raise exception 'RFI not found or access denied' using errcode = '42501';
  end if;
  if v_rfi.status <> 'answered' or (auth.uid() <> v_rfi.created_by and not public.is_workspace_owner(v_rfi.workspace_id)) then
    raise exception 'only the requester or workspace owner can close an answered RFI' using errcode = '42501';
  end if;
  update public.rfis set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now()
  where id = v_rfi.id;
end;
$$;

create or replace function public.cancel_rfi(p_rfi_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfi public.rfis%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_rfi from public.rfis where id = p_rfi_id for update;
  if not found or not public.can_edit_workspace(v_rfi.workspace_id) then
    raise exception 'RFI not found or access denied' using errcode = '42501';
  end if;
  if v_rfi.status not in ('open', 'answered') or (auth.uid() <> v_rfi.created_by and not public.is_workspace_owner(v_rfi.workspace_id)) then
    raise exception 'only the requester or workspace owner can cancel an open RFI' using errcode = '42501';
  end if;
  update public.rfis set status = 'cancelled', updated_at = now() where id = v_rfi.id;
end;
$$;

revoke all on function public.log_rfi_event() from public, anon, authenticated;
revoke all on function public.respond_to_rfi(uuid, text) from public, anon;
revoke all on function public.request_rfi_clarification(uuid, text) from public, anon;
revoke all on function public.close_rfi(uuid) from public, anon;
revoke all on function public.cancel_rfi(uuid) from public, anon;
grant execute on function public.respond_to_rfi(uuid, text) to authenticated;
grant execute on function public.request_rfi_clarification(uuid, text) to authenticated;
grant execute on function public.close_rfi(uuid) to authenticated;
grant execute on function public.cancel_rfi(uuid) to authenticated;
