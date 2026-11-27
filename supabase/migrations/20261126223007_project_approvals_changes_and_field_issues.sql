-- Local workflow additions identified in the competitor gap review.
-- All project rows stay tenant-scoped; mutable state changes go through checked RPCs.

create table public.project_submittals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  reference_code text not null check (length(btrim(reference_code)) between 1 and 40),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  reviewer_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','approved','revise_resubmit','rejected','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_submittals_project_workspace_fk foreign key (project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);

create unique index project_submittals_project_ref_unique
  on public.project_submittals(project_id,lower(reference_code));
create index project_submittals_workspace_status_due_idx
  on public.project_submittals(workspace_id,status,due_date);
create index project_submittals_project_id_idx on public.project_submittals(project_id);

create table public.project_submittal_events (
  id uuid primary key default gen_random_uuid(),
  submittal_id uuid not null references public.project_submittals(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','reviewed')),
  previous_status text,
  new_status text,
  comment text check (comment is null or length(comment) <= 3000),
  created_at timestamptz not null default now()
);
create index project_submittal_events_history_idx
  on public.project_submittal_events(submittal_id,created_at);

alter table public.project_submittals enable row level security;
alter table public.project_submittal_events enable row level security;
revoke all on public.project_submittals,public.project_submittal_events from anon,authenticated;
grant select on public.project_submittals,public.project_submittal_events to authenticated;
create policy project_submittals_member_read on public.project_submittals
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy project_submittal_events_member_read on public.project_submittal_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

create table public.project_change_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  reference_code text not null check (length(btrim(reference_code)) between 1 and 40),
  title text not null check (length(btrim(title)) between 1 and 200),
  reason text not null check (length(btrim(reason)) between 1 and 5000),
  amount numeric(14,2) not null check (amount >= 0),
  schedule_days integer not null default 0 check (schedule_days between 0 and 3650),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','cancelled')),
  decision_note text check (decision_note is null or length(decision_note) <= 3000),
  created_by uuid not null default auth.uid() references auth.users(id),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_change_orders_project_workspace_fk foreign key (project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);
create unique index project_change_orders_project_ref_unique
  on public.project_change_orders(project_id,lower(reference_code));
create index project_change_orders_workspace_status_idx
  on public.project_change_orders(workspace_id,status,created_at desc);
create index project_change_orders_project_id_idx on public.project_change_orders(project_id);

create table public.project_change_order_events (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null references public.project_change_orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('submitted','approved','rejected')),
  previous_status text,
  new_status text,
  comment text check (comment is null or length(comment) <= 3000),
  created_at timestamptz not null default now()
);
create index project_change_order_events_history_idx
  on public.project_change_order_events(change_order_id,created_at);

alter table public.project_change_orders enable row level security;
alter table public.project_change_order_events enable row level security;
revoke all on public.project_change_orders,public.project_change_order_events from anon,authenticated;
grant select on public.project_change_orders,public.project_change_order_events to authenticated;
create policy project_change_orders_member_read on public.project_change_orders
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy project_change_order_events_member_read on public.project_change_order_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

create table public.project_field_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  issue_type text not null check (issue_type in ('quality','safety','punch')),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  location text not null default '' check (length(location) <= 240),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  due_date date,
  assignee_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','verified')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_field_issues_project_workspace_fk foreign key (project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);
create index project_field_issues_workspace_status_due_idx
  on public.project_field_issues(workspace_id,status,due_date);
create index project_field_issues_project_id_idx on public.project_field_issues(project_id);

create table public.project_field_issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.project_field_issues(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','status_changed')),
  previous_status text,
  new_status text,
  comment text check (comment is null or length(comment) <= 3000),
  created_at timestamptz not null default now()
);
create index project_field_issue_events_history_idx
  on public.project_field_issue_events(issue_id,created_at);

alter table public.project_field_issues enable row level security;
alter table public.project_field_issue_events enable row level security;
revoke all on public.project_field_issues,public.project_field_issue_events from anon,authenticated;
grant select on public.project_field_issues,public.project_field_issue_events to authenticated;
create policy project_field_issues_member_read on public.project_field_issues
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy project_field_issue_events_member_read on public.project_field_issue_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

create table public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  event_kind text not null,
  title_key text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint project_notifications_project_workspace_fk foreign key(project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);
create index project_notifications_recipient_unread_idx
  on public.project_notifications(recipient_id,created_at desc) where read_at is null;
create index project_notifications_workspace_idx
  on public.project_notifications(workspace_id,created_at desc);
alter table public.project_notifications enable row level security;
revoke all on public.project_notifications from anon,authenticated;
grant select on public.project_notifications to authenticated;
create policy project_notifications_read_own on public.project_notifications
  for select to authenticated using (
    recipient_id = (select auth.uid()) and public.is_workspace_member(workspace_id)
  );
create or replace function public.mark_project_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  update public.project_notifications n set read_at=coalesce(n.read_at,now())
  where n.id=p_notification_id and n.recipient_id=auth.uid() and public.is_workspace_member(n.workspace_id);
  if not found then raise exception 'notification not found or access denied' using errcode='42501'; end if;
end $$;
revoke all on function public.mark_project_notification_read(uuid) from public,anon;
grant execute on function public.mark_project_notification_read(uuid) to authenticated;

create or replace function public.create_project_submittal(
  p_workspace_id uuid,p_project_id uuid,p_reference_code text,p_title text,p_description text,p_reviewer_id uuid,p_due_date date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_ref text;
begin
  if auth.uid() is null or not public.can_edit_workspace(p_workspace_id) then
    raise exception 'workspace editor access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.workspace_id=p_workspace_id) then
    raise exception 'project not found' using errcode='42501';
  end if;
  if p_reviewer_id is not null and not exists(
    select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_reviewer_id
  ) then raise exception 'reviewer must belong to this workspace' using errcode='22023'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'title required' using errcode='22023'; end if;
  v_ref := coalesce(nullif(left(btrim(coalesce(p_reference_code,'')),40),''),'SUB-'||upper(left(v_id::text,8)));
  insert into public.project_submittals(id,workspace_id,project_id,reference_code,title,description,reviewer_id,due_date,created_by)
  values(v_id,p_workspace_id,p_project_id,v_ref,btrim(p_title),left(coalesce(p_description,''),5000),p_reviewer_id,p_due_date,auth.uid());
  insert into public.project_submittal_events(submittal_id,workspace_id,actor_id,event_type,new_status)
  values(v_id,p_workspace_id,auth.uid(),'created','submitted');
  return v_id;
end $$;

create or replace function public.review_project_submittal(p_submittal_id uuid,p_decision text,p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.project_submittals%rowtype; v_status text := lower(btrim(coalesce(p_decision,'')));
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if v_status not in ('approved','revise_resubmit','rejected') then raise exception 'invalid review decision' using errcode='22023'; end if;
  select * into v_item from public.project_submittals where id=p_submittal_id for update;
  if not found or not public.can_edit_workspace(v_item.workspace_id) then raise exception 'submittal not found or access denied' using errcode='42501'; end if;
  if v_item.reviewer_id is not null and v_item.reviewer_id<>auth.uid() and not public.is_workspace_owner(v_item.workspace_id) then
    raise exception 'only the assigned reviewer or workspace owner may review' using errcode='42501';
  end if;
  if v_item.status not in ('submitted','under_review','revise_resubmit') then raise exception 'submittal is not awaiting review' using errcode='22023'; end if;
  if length(btrim(coalesce(p_comment,''))) not between 1 and 3000 then raise exception 'review comment required' using errcode='22023'; end if;
  insert into public.project_submittal_events(submittal_id,workspace_id,actor_id,event_type,previous_status,new_status,comment)
  values(v_item.id,v_item.workspace_id,auth.uid(),'reviewed',v_item.status,v_status,btrim(p_comment));
  update public.project_submittals set status=v_status,updated_at=now() where id=v_item.id;
end $$;

create or replace function public.create_project_change_order(
  p_workspace_id uuid,p_project_id uuid,p_reference_code text,p_title text,p_reason text,p_amount numeric,p_schedule_days integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_ref text;
begin
  if auth.uid() is null or not public.can_edit_workspace(p_workspace_id) then raise exception 'workspace editor access required' using errcode='42501'; end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.workspace_id=p_workspace_id) then raise exception 'project not found' using errcode='42501'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 200 or length(btrim(coalesce(p_reason,''))) not between 1 and 5000 then raise exception 'title and reason required' using errcode='22023'; end if;
  if p_amount is null or p_amount<0 or p_schedule_days is null or p_schedule_days not between 0 and 3650 then raise exception 'invalid cost or schedule impact' using errcode='22023'; end if;
  v_ref := coalesce(nullif(left(btrim(coalesce(p_reference_code,'')),40),''),'CO-'||upper(left(v_id::text,8)));
  insert into public.project_change_orders(id,workspace_id,project_id,reference_code,title,reason,amount,schedule_days,created_by)
  values(v_id,p_workspace_id,p_project_id,v_ref,btrim(p_title),btrim(p_reason),p_amount,p_schedule_days,auth.uid());
  insert into public.project_change_order_events(change_order_id,workspace_id,actor_id,event_type,new_status)
  values(v_id,p_workspace_id,auth.uid(),'submitted','submitted');
  return v_id;
end $$;

create or replace function public.review_project_change_order(p_change_order_id uuid,p_decision text,p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.project_change_orders%rowtype; v_status text := lower(btrim(coalesce(p_decision,'')));
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_item from public.project_change_orders where id=p_change_order_id for update;
  if not found or not public.is_workspace_owner(v_item.workspace_id) then raise exception 'only workspace owner can approve or reject' using errcode='42501'; end if;
  if v_status not in ('approved','rejected') or v_item.status<>'submitted' then raise exception 'invalid decision or change order is closed' using errcode='22023'; end if;
  update public.project_change_orders set status=v_status,decision_note=nullif(btrim(coalesce(p_comment,'')),''),decided_by=auth.uid(),decided_at=now(),updated_at=now() where id=v_item.id;
  insert into public.project_change_order_events(change_order_id,workspace_id,actor_id,event_type,previous_status,new_status,comment)
  values(v_item.id,v_item.workspace_id,auth.uid(),v_status,v_item.status,v_status,nullif(btrim(coalesce(p_comment,'')),''));
end $$;

create or replace function public.create_project_field_issue(
  p_workspace_id uuid,p_project_id uuid,p_issue_type text,p_title text,p_description text,p_location text,p_severity text,p_due_date date,p_assignee_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := extensions.gen_random_uuid(); v_type text := lower(btrim(coalesce(p_issue_type,''))); v_severity text := lower(btrim(coalesce(p_severity,'')));
begin
  if auth.uid() is null or not public.can_edit_workspace(p_workspace_id) then raise exception 'workspace editor access required' using errcode='42501'; end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.workspace_id=p_workspace_id) then raise exception 'project not found' using errcode='42501'; end if;
  if v_type not in ('quality','safety','punch') or v_severity not in ('low','medium','high','critical') then raise exception 'invalid issue type or severity' using errcode='22023'; end if;
  if length(btrim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'title required' using errcode='22023'; end if;
  if p_assignee_id is not null and not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace_id and m.user_id=p_assignee_id) then raise exception 'assignee must belong to this workspace' using errcode='22023'; end if;
  insert into public.project_field_issues(workspace_id,project_id,issue_type,title,description,location,severity,due_date,assignee_id,created_by)
  values(p_workspace_id,p_project_id,v_type,btrim(p_title),left(coalesce(p_description,''),5000),left(coalesce(p_location,''),240),v_severity,p_due_date,p_assignee_id,auth.uid())
  returning id into v_id;
  insert into public.project_field_issue_events(issue_id,workspace_id,actor_id,event_type,new_status)
  values(v_id,p_workspace_id,auth.uid(),'created','open');
  return v_id;
end $$;

create or replace function public.update_project_field_issue(p_issue_id uuid,p_status text,p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.project_field_issues%rowtype; v_status text := lower(btrim(coalesce(p_status,'')));
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if v_status not in ('open','in_progress','resolved','verified') then raise exception 'invalid status' using errcode='22023'; end if;
  select * into v_item from public.project_field_issues where id=p_issue_id for update;
  if not found or not public.can_edit_workspace(v_item.workspace_id) then raise exception 'issue not found or access denied' using errcode='42501'; end if;
  if v_item.status='verified' then raise exception 'verified issues are closed' using errcode='22023'; end if;
  if v_status='verified' and not public.is_workspace_owner(v_item.workspace_id) then raise exception 'only workspace owner can verify closure' using errcode='42501'; end if;
  update public.project_field_issues set status=v_status,updated_at=now() where id=v_item.id;
  insert into public.project_field_issue_events(issue_id,workspace_id,actor_id,event_type,previous_status,new_status,comment)
  values(v_item.id,v_item.workspace_id,auth.uid(),'status_changed',v_item.status,v_status,nullif(btrim(coalesce(p_comment,'')),''));
end $$;

create or replace function public.notify_project_workflow_members()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := to_jsonb(new); v_old jsonb; v_workspace_id uuid; v_project_id uuid; v_actor uuid; v_entity uuid; v_type text; v_event text; v_title text; v_status text;
begin
  if tg_op='UPDATE' then
    v_old := to_jsonb(old);
    if v_row->>'status' is not distinct from v_old->>'status' then return new; end if;
  end if;
  v_workspace_id := (v_row->>'workspace_id')::uuid;
  v_project_id := (v_row->>'project_id')::uuid;
  v_actor := auth.uid();
  v_entity := (v_row->>'id')::uuid;
  v_status := v_row->>'status';
  if tg_table_name='project_submittals' then
    v_type := 'submittal';
    v_event := case when tg_op='INSERT' then 'submittal_created' else 'submittal_reviewed' end;
    v_title := coalesce(v_row->>'title','');
  elsif tg_table_name='project_change_orders' then
    v_type := 'change_order';
    v_event := case when tg_op='INSERT' then 'change_order_submitted' else 'change_order_decided' end;
    v_title := coalesce(v_row->>'title','');
  elsif tg_table_name='project_field_issues' then
    v_type := 'field_issue';
    v_event := case when tg_op='INSERT' then 'field_issue_created' else 'field_issue_updated' end;
    v_title := coalesce(v_row->>'title','');
  else return new;
  end if;
  insert into public.project_notifications(workspace_id,project_id,recipient_id,entity_type,entity_id,event_kind,title_key,body)
  select v_workspace_id,v_project_id,m.user_id,v_type,v_entity,v_event,v_event,v_title
  from public.workspace_members m
  where m.workspace_id=v_workspace_id and m.user_id<>coalesce(v_actor,(v_row->>'created_by')::uuid);
  return new;
end $$;

create trigger project_submittals_notify after insert or update of status on public.project_submittals
  for each row execute function public.notify_project_workflow_members();
create trigger project_change_orders_notify after insert or update of status on public.project_change_orders
  for each row execute function public.notify_project_workflow_members();
create trigger project_field_issues_notify after insert or update of status on public.project_field_issues
  for each row execute function public.notify_project_workflow_members();

revoke all on function public.create_project_submittal(uuid,uuid,text,text,text,uuid,date) from public,anon;
revoke all on function public.review_project_submittal(uuid,text,text) from public,anon;
revoke all on function public.create_project_change_order(uuid,uuid,text,text,text,numeric,integer) from public,anon;
revoke all on function public.review_project_change_order(uuid,text,text) from public,anon;
revoke all on function public.create_project_field_issue(uuid,uuid,text,text,text,text,text,date,uuid) from public,anon;
revoke all on function public.update_project_field_issue(uuid,text,text) from public,anon;
revoke all on function public.notify_project_workflow_members() from public,anon,authenticated;
grant execute on function public.create_project_submittal(uuid,uuid,text,text,text,uuid,date) to authenticated;
grant execute on function public.review_project_submittal(uuid,text,text) to authenticated;
grant execute on function public.create_project_change_order(uuid,uuid,text,text,text,numeric,integer) to authenticated;
grant execute on function public.review_project_change_order(uuid,text,text) to authenticated;
grant execute on function public.create_project_field_issue(uuid,uuid,text,text,text,text,text,date,uuid) to authenticated;
grant execute on function public.update_project_field_issue(uuid,text,text) to authenticated;

-- Read-only client/subcontractor portal: the bearer secret is stored only as a hash.
create table public.project_portal_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  include_daily_logs boolean not null default true,
  include_documents boolean not null default true,
  include_budget boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint project_portal_shares_project_workspace_fk foreign key(project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade,
  constraint project_portal_expiry_range check(expires_at <= created_at + interval '90 days')
);
create index project_portal_shares_project_idx on public.project_portal_shares(project_id,created_at desc);
alter table public.project_portal_shares enable row level security;
revoke all on public.project_portal_shares from anon,authenticated;

create or replace function public.create_project_portal_link(
  p_project_id uuid,p_expires_days integer,p_include_logs boolean,p_include_documents boolean,p_include_budget boolean default false
) returns text language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid; v_token text := encode(extensions.gen_random_bytes(32),'hex');
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_expires_days not between 1 and 90 then raise exception 'expiry must be 1 to 90 days' using errcode='22023'; end if;
  select p.workspace_id into v_workspace_id from public.projects p where p.id=p_project_id;
  if v_workspace_id is null or not public.is_workspace_owner(v_workspace_id) then
    raise exception 'only workspace owner can create a portal link' using errcode='42501';
  end if;
  insert into public.project_portal_shares(workspace_id,project_id,token_hash,expires_at,include_daily_logs,include_documents,include_budget,created_by)
  values(v_workspace_id,p_project_id,extensions.digest(convert_to(v_token,'UTF8'),'sha256'),now()+make_interval(days=>p_expires_days),coalesce(p_include_logs,true),coalesce(p_include_documents,true),coalesce(p_include_budget,false),auth.uid());
  return v_token;
end $$;

create or replace function public.revoke_project_portal_link(p_share_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select s.workspace_id into v_workspace_id from public.project_portal_shares s where s.id=p_share_id;
  if v_workspace_id is null or not public.is_workspace_owner(v_workspace_id) then raise exception 'access denied' using errcode='42501'; end if;
  update public.project_portal_shares set revoked_at=now() where id=p_share_id and revoked_at is null;
end $$;

create or replace function public.revoke_project_portal_token(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid; v_hash bytea;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'invalid portal token' using errcode='22023'; end if;
  v_hash := extensions.digest(convert_to(p_token,'UTF8'),'sha256');
  select s.workspace_id into v_workspace_id from public.project_portal_shares s where s.token_hash=v_hash;
  if v_workspace_id is null or not public.is_workspace_owner(v_workspace_id) then raise exception 'access denied' using errcode='42501'; end if;
  update public.project_portal_shares set revoked_at=now() where token_hash=v_hash and revoked_at is null;
end $$;

create or replace function public.view_project_portal(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_share public.project_portal_shares%rowtype; v_project jsonb; v_logs jsonb := '[]'::jsonb; v_documents jsonb := '[]'::jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'portal link is invalid or expired' using errcode='28000'; end if;
  select * into v_share from public.project_portal_shares s
  where s.token_hash=extensions.digest(convert_to(p_token,'UTF8'),'sha256')
    and s.revoked_at is null and s.expires_at>now();
  if not found then raise exception 'portal link is invalid or expired' using errcode='28000'; end if;
  select jsonb_build_object(
    'name',p.name,'city',p.city,'progress',p.progress,'status',p.status,'start_date',p.start_date,'end_date',p.end_date,
    'planned_budget',case when v_share.include_budget then p.planned_budget else null end,'updated_at',p.created_at
  ) into v_project from public.projects p where p.id=v_share.project_id and p.workspace_id=v_share.workspace_id;
  if v_share.include_daily_logs then
    select coalesce(jsonb_agg(jsonb_build_object(
      'area',l.area,'activities',l.activities,'blockers',l.blockers,'log_date',l.log_date,'status',l.status,'workforce_count',l.workforce_count
    ) order by l.log_date desc),'[]'::jsonb) into v_logs
    from (select dl.* from public.daily_logs dl where dl.project_id=v_share.project_id order by dl.log_date desc limit 30) l;
  end if;
  if v_share.include_documents then
    select coalesce(jsonb_agg(jsonb_build_object(
      'title',d.title,'description',d.description,'file_name',latest.file_name,'version_number',latest.version_number,'created_at',latest.created_at
    ) order by d.created_at desc),'[]'::jsonb) into v_documents
    from public.project_documents d
    left join lateral (
      select v.file_name,v.version_number,v.created_at from public.project_document_versions v
      where v.document_id=d.id order by v.version_number desc limit 1
    ) latest on true
    where d.project_id=v_share.project_id and d.workspace_id=v_share.workspace_id;
  end if;
  return jsonb_build_object('project',v_project,'logs',v_logs,'documents',v_documents,'expires_at',v_share.expires_at,'view_only',true);
end $$;

revoke all on function public.create_project_portal_link(uuid,integer,boolean,boolean,boolean) from public,anon;
revoke all on function public.revoke_project_portal_link(uuid) from public,anon;
revoke all on function public.revoke_project_portal_token(text) from public,anon;
revoke all on function public.view_project_portal(text) from public,authenticated;
grant execute on function public.create_project_portal_link(uuid,integer,boolean,boolean,boolean) to authenticated;
grant execute on function public.revoke_project_portal_link(uuid) to authenticated;
grant execute on function public.revoke_project_portal_token(text) to authenticated;
grant execute on function public.view_project_portal(text) to anon,authenticated;

-- Saved report reminders. The browser creates the export; cadence is advanced
-- only when a team member confirms a report run. No email provider is assumed.
create table public.project_report_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  name text not null check(length(btrim(name)) between 1 and 120),
  report_kind text not null check(report_kind in ('overview','tasks','daily_logs','budget','field_issues','submittals','change_orders')),
  frequency text not null check(frequency in ('weekly','monthly')),
  next_run_date date not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  last_run_at timestamptz,
  active boolean not null default true,
  constraint project_report_schedule_project_workspace_fk foreign key(project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);
create index project_report_schedules_workspace_due_idx
  on public.project_report_schedules(workspace_id,next_run_date) where active;
alter table public.project_report_schedules enable row level security;
revoke all on public.project_report_schedules from anon,authenticated;
grant select,insert on public.project_report_schedules to authenticated;
grant update(active) on public.project_report_schedules to authenticated;
create policy project_report_schedules_member_read on public.project_report_schedules
  for select to authenticated using(public.is_workspace_member(workspace_id));
create policy project_report_schedules_editor_insert on public.project_report_schedules
  for insert to authenticated with check(created_by=(select auth.uid()) and public.can_edit_workspace(workspace_id));
create policy project_report_schedules_editor_update on public.project_report_schedules
  for update to authenticated using(public.can_edit_workspace(workspace_id))
  with check(public.can_edit_workspace(workspace_id));
create policy project_report_schedules_owner_delete on public.project_report_schedules
  for delete to authenticated using(public.is_workspace_owner(workspace_id));

create or replace function public.advance_project_report_schedule(p_schedule_id uuid)
returns date language plpgsql security definer set search_path = '' as $$
declare v_schedule public.project_report_schedules%rowtype; v_next date;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_schedule from public.project_report_schedules where id=p_schedule_id for update;
  if not found or not public.can_edit_workspace(v_schedule.workspace_id) then raise exception 'schedule not found or access denied' using errcode='42501'; end if;
  v_next := case v_schedule.frequency when 'weekly' then greatest(v_schedule.next_run_date,current_date)+7 else (greatest(v_schedule.next_run_date,current_date)+interval '1 month')::date end;
  update public.project_report_schedules set next_run_date=v_next,last_run_at=now() where id=v_schedule.id;
  return v_next;
end $$;
revoke all on function public.advance_project_report_schedule(uuid) from public,anon;
grant execute on function public.advance_project_report_schedule(uuid) to authenticated;

-- Lightweight schedule links: a task can depend on another task in the same project.
alter table public.tasks add column depends_on_task_id uuid;
create unique index tasks_id_project_unique on public.tasks(id,project_id);
alter table public.tasks add constraint tasks_dependency_same_project_fk
  foreign key(depends_on_task_id,project_id) references public.tasks(id,project_id) on delete set null (depends_on_task_id);
alter table public.tasks add constraint tasks_cannot_depend_on_self check(depends_on_task_id is null or depends_on_task_id<>id);
create index tasks_dependency_project_idx on public.tasks(project_id,depends_on_task_id);

-- Append-only workforce time entries for job-cost visibility and field timesheets.
create table public.project_time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  task_id uuid,
  worker_name text not null check(length(btrim(worker_name)) between 1 and 120),
  entry_date date not null default current_date,
  hours numeric(5,2) not null check(hours>0 and hours<=24),
  notes text not null default '' check(length(notes)<=1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint project_time_entries_project_workspace_fk foreign key(project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade,
  constraint project_time_entries_task_project_fk foreign key(task_id,project_id)
    references public.tasks(id,project_id) on delete set null (task_id)
);
create index project_time_entries_workspace_date_idx
  on public.project_time_entries(workspace_id,entry_date desc);
create index project_time_entries_project_date_idx
  on public.project_time_entries(project_id,entry_date desc);
alter table public.project_time_entries enable row level security;
revoke all on public.project_time_entries from anon,authenticated;
grant select,insert on public.project_time_entries to authenticated;
create policy project_time_entries_member_read on public.project_time_entries
  for select to authenticated using(public.is_workspace_member(workspace_id));
create policy project_time_entries_editor_insert on public.project_time_entries
  for insert to authenticated with check(
    created_by=(select auth.uid()) and public.can_edit_workspace(workspace_id)
  );

create or replace function public.notify_task_and_report_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid; v_workspace_id uuid; v_event text; v_entity text; v_entity_id uuid; v_body text; v_actor uuid := auth.uid();
begin
  v_project_id := (to_jsonb(new)->>'project_id')::uuid;
  select p.workspace_id into v_workspace_id from public.projects p where p.id=v_project_id;
  if v_workspace_id is null then return new; end if;
  v_entity_id := (to_jsonb(new)->>'id')::uuid;
  if tg_table_name='tasks' then
    v_event := 'task_created'; v_entity := 'task'; v_body := coalesce(to_jsonb(new)->>'title','');
  elsif tg_table_name='daily_logs' and length(btrim(coalesce(to_jsonb(new)->>'blockers',''))) > 0 then
    v_event := 'log_blocker'; v_entity := 'daily_log'; v_body := left(to_jsonb(new)->>'blockers',500);
  else return new;
  end if;
  insert into public.project_notifications(workspace_id,project_id,recipient_id,entity_type,entity_id,event_kind,title_key,body)
  select v_workspace_id,v_project_id,m.user_id,v_entity,v_entity_id,v_event,v_event,v_body
  from public.workspace_members m where m.workspace_id=v_workspace_id and m.user_id<>coalesce(v_actor,(to_jsonb(new)->>'user_id')::uuid);
  return new;
end $$;
create trigger tasks_notify_workspace after insert on public.tasks
  for each row execute function public.notify_task_and_report_activity();
create trigger daily_logs_notify_blocker after insert on public.daily_logs
  for each row execute function public.notify_task_and_report_activity();
revoke all on function public.notify_task_and_report_activity() from public,anon,authenticated;
