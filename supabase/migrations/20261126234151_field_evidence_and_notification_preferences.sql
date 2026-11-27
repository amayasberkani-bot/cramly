-- Private photo evidence for quality/safety/punch issues, stored in the existing
-- private bucket. Metadata is registered only after the Storage object exists.
alter table public.project_field_issues add constraint project_field_issues_tenant_key unique(id,workspace_id,project_id);
alter table public.rfis add column source_issue_id uuid;
alter table public.rfis add constraint rfis_source_issue_tenant_fk
  foreign key(source_issue_id,workspace_id,project_id)
  references public.project_field_issues(id,workspace_id,project_id) on delete set null (source_issue_id);
create unique index rfis_source_issue_unique on public.rfis(source_issue_id) where source_issue_id is not null;

create table public.project_field_issue_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  issue_id uuid not null references public.project_field_issues(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (length(btrim(file_name)) between 1 and 240),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint project_field_issue_attachments_project_workspace_fk foreign key(project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);
create index project_field_issue_attachments_issue_idx on public.project_field_issue_attachments(issue_id,created_at);
alter table public.project_field_issue_attachments enable row level security;
revoke all on public.project_field_issue_attachments from anon,authenticated;
grant select on public.project_field_issue_attachments to authenticated;
create policy project_field_issue_attachments_member_read on public.project_field_issue_attachments
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy chantier_issue_evidence_read on storage.objects
  for select to authenticated using (
    bucket_id='chantier-documents' and exists(
      select 1 from public.project_field_issue_attachments a
      where a.storage_path=storage.objects.name and public.is_workspace_member(a.workspace_id)
    )
  );
create policy chantier_issue_evidence_pending_read on storage.objects
  for select to authenticated using (
    bucket_id='chantier-documents' and array_length(storage.foldername(name),1)=3
    and exists(
      select 1 from public.projects p
      where p.id::text=(storage.foldername(name))[2]
        and p.workspace_id::text=(storage.foldername(name))[1]
        and public.can_edit_workspace(p.workspace_id)
    )
  );

create or replace function public.register_project_field_issue_attachment(
  p_workspace_id uuid,p_project_id uuid,p_issue_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.can_edit_workspace(p_workspace_id) then raise exception 'workspace editor access required' using errcode='42501'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') or p_size_bytes not between 1 and 10485760 then raise exception 'unsupported evidence file' using errcode='22023'; end if;
  if p_storage_path !~* ('^'||p_workspace_id::text||'/'||p_project_id::text||'/'||p_issue_id::text||'/[0-9a-f-]{36}-[^/]{1,180}$') then raise exception 'invalid evidence path' using errcode='22023'; end if;
  if not exists(select 1 from public.project_field_issues i where i.id=p_issue_id and i.project_id=p_project_id and i.workspace_id=p_workspace_id) then raise exception 'issue not found' using errcode='42501'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='chantier-documents' and o.name=p_storage_path and o.owner_id=auth.uid()::text) then raise exception 'uploaded file not found' using errcode='42501'; end if;
  insert into public.project_field_issue_attachments(id,workspace_id,project_id,issue_id,storage_path,file_name,mime_type,size_bytes,uploaded_by)
  values(v_id,p_workspace_id,p_project_id,p_issue_id,p_storage_path,left(btrim(p_file_name),240),p_mime_type,p_size_bytes,auth.uid());
  return v_id;
end $$;
revoke all on function public.register_project_field_issue_attachment(uuid,uuid,uuid,text,text,text,bigint) from public,anon;
grant execute on function public.register_project_field_issue_attachment(uuid,uuid,uuid,text,text,text,bigint) to authenticated;

-- Per-user notification controls. Muting inbox event categories also suppresses
-- durable inbox rows; it does not claim to send email digests.
create table public.workspace_notification_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_event_kinds text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id),
  constraint workspace_notification_preferences_allowed_kinds check (
    muted_event_kinds <@ array['task_created','task_overdue','log_blocker','submittal_created','submittal_reviewed','change_order_submitted','change_order_decided','field_issue_created','field_issue_updated','commitment_submitted','commitment_decided']::text[]
  )
);
alter table public.workspace_notification_preferences enable row level security;
revoke all on public.workspace_notification_preferences from anon,authenticated;
grant select,insert,update on public.workspace_notification_preferences to authenticated;
create policy workspace_notification_preferences_own_select on public.workspace_notification_preferences
  for select to authenticated using(user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
create policy workspace_notification_preferences_own_insert on public.workspace_notification_preferences
  for insert to authenticated with check(user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
create policy workspace_notification_preferences_own_update on public.workspace_notification_preferences
  for update to authenticated using(user_id=(select auth.uid()) and public.is_workspace_member(workspace_id))
  with check(user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));

create or replace function public.notify_project_workflow_members()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := to_jsonb(new); v_old jsonb; v_workspace_id uuid; v_project_id uuid; v_actor uuid; v_entity uuid; v_type text; v_event text; v_title text;
begin
  if tg_op='UPDATE' then v_old:=to_jsonb(old); if v_row->>'status' is not distinct from v_old->>'status' then return new; end if; end if;
  v_workspace_id:=(v_row->>'workspace_id')::uuid; v_project_id:=(v_row->>'project_id')::uuid; v_actor:=auth.uid(); v_entity:=(v_row->>'id')::uuid;
  if tg_table_name='project_submittals' then v_type:='submittal';v_event:=case when tg_op='INSERT' then 'submittal_created' else 'submittal_reviewed' end;v_title:=coalesce(v_row->>'title','');
  elsif tg_table_name='project_change_orders' then v_type:='change_order';v_event:=case when tg_op='INSERT' then 'change_order_submitted' else 'change_order_decided' end;v_title:=coalesce(v_row->>'title','');
  elsif tg_table_name='project_field_issues' then v_type:='field_issue';v_event:=case when tg_op='INSERT' then 'field_issue_created' else 'field_issue_updated' end;v_title:=coalesce(v_row->>'title','');
  elsif tg_table_name='project_commitments' then v_type:='commitment';v_event:=case when tg_op='INSERT' then 'commitment_submitted' else 'commitment_decided' end;v_title:=coalesce(v_row->>'vendor_name','');
  else return new; end if;
  insert into public.project_notifications(workspace_id,project_id,recipient_id,entity_type,entity_id,event_kind,title_key,body)
  select v_workspace_id,v_project_id,m.user_id,v_type,v_entity,v_event,v_event,v_title from public.workspace_members m
  left join public.workspace_notification_preferences pref on pref.workspace_id=m.workspace_id and pref.user_id=m.user_id
  where m.workspace_id=v_workspace_id and m.user_id<>coalesce(v_actor,(v_row->>'created_by')::uuid)
    and not(v_event=any(coalesce(pref.muted_event_kinds,'{}'::text[])));
  return new;
end $$;

create or replace function public.notify_task_and_report_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid; v_workspace_id uuid; v_event text; v_entity text; v_entity_id uuid; v_body text; v_actor uuid:=auth.uid();
begin
  v_project_id:=(to_jsonb(new)->>'project_id')::uuid;select p.workspace_id into v_workspace_id from public.projects p where p.id=v_project_id;
  if v_workspace_id is null then return new; end if;v_entity_id:=(to_jsonb(new)->>'id')::uuid;
  if tg_table_name='tasks' then v_event:='task_created';v_entity:='task';v_body:=coalesce(to_jsonb(new)->>'title','');
  elsif tg_table_name='daily_logs' and length(btrim(coalesce(to_jsonb(new)->>'blockers','')))>0 then v_event:='log_blocker';v_entity:='daily_log';v_body:=left(to_jsonb(new)->>'blockers',500);
  else return new; end if;
  insert into public.project_notifications(workspace_id,project_id,recipient_id,entity_type,entity_id,event_kind,title_key,body)
  select v_workspace_id,v_project_id,m.user_id,v_entity,v_entity_id,v_event,v_event,v_body from public.workspace_members m
  left join public.workspace_notification_preferences pref on pref.workspace_id=m.workspace_id and pref.user_id=m.user_id
  where m.workspace_id=v_workspace_id and m.user_id<>coalesce(v_actor,(to_jsonb(new)->>'user_id')::uuid)
    and not(v_event=any(coalesce(pref.muted_event_kinds,'{}'::text[])));
  return new;
end $$;
revoke all on function public.notify_project_workflow_members() from public,anon,authenticated;
revoke all on function public.notify_task_and_report_activity() from public,anon,authenticated;

create trigger project_commitments_notify after insert or update of status on public.project_commitments
  for each row execute function public.notify_project_workflow_members();
