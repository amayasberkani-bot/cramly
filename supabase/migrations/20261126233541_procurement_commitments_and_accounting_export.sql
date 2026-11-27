-- Purchase commitments and purchase-order approvals. These records do not mutate
-- the original project budget; approved commitments remain a separate forecast.
create table public.project_commitments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  reference_code text not null check (length(btrim(reference_code)) between 1 and 60),
  commitment_type text not null check (commitment_type in ('purchase_order','subcontract')),
  vendor_name text not null check (length(btrim(vendor_name)) between 1 and 200),
  description text not null default '' check (length(description) <= 3000),
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null default 'DZD' check (currency_code ~ '^[A-Z]{3}$'),
  expected_date date,
  status text not null default 'submitted' check (status in ('submitted','approved','received','rejected','cancelled')),
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_commitments_project_workspace_fk foreign key(project_id,workspace_id)
    references public.projects(id,workspace_id) on delete cascade
);
create unique index project_commitments_reference_unique on public.project_commitments(project_id,lower(reference_code));
create index project_commitments_project_status_idx on public.project_commitments(workspace_id,project_id,status,created_at desc);
alter table public.project_commitments enable row level security;
revoke all on public.project_commitments from anon,authenticated;
grant select on public.project_commitments to authenticated;
create policy project_commitments_member_read on public.project_commitments
  for select to authenticated using (public.is_workspace_member(workspace_id));

create table public.project_commitment_events (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.project_commitments(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('submitted','approved','rejected','received','cancelled')),
  previous_status text,
  new_status text not null,
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index project_commitment_events_history_idx on public.project_commitment_events(commitment_id,created_at);
alter table public.project_commitment_events enable row level security;
revoke all on public.project_commitment_events from anon,authenticated;
grant select on public.project_commitment_events to authenticated;
create policy project_commitment_events_member_read on public.project_commitment_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.create_project_commitment(
  p_workspace_id uuid,p_project_id uuid,p_reference_code text,p_commitment_type text,
  p_vendor_name text,p_description text,p_amount numeric,p_currency_code text,p_expected_date date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_ref text; v_currency text;
begin
  if auth.uid() is null or not public.can_edit_workspace(p_workspace_id) then
    raise exception 'workspace editor access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.workspace_id=p_workspace_id) then
    raise exception 'project not found' using errcode='42501';
  end if;
  if p_commitment_type not in ('purchase_order','subcontract') then raise exception 'invalid commitment type' using errcode='22023'; end if;
  if length(btrim(coalesce(p_vendor_name,''))) not between 1 and 200 or coalesce(p_amount,0)<=0 then
    raise exception 'vendor and positive amount required' using errcode='22023';
  end if;
  v_ref := coalesce(nullif(left(btrim(coalesce(p_reference_code,'')),60),''),'PO-'||upper(left(v_id::text,8)));
  v_currency := upper(coalesce(nullif(btrim(p_currency_code),''),'DZD'));
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency' using errcode='22023'; end if;
  insert into public.project_commitments(id,workspace_id,project_id,reference_code,commitment_type,vendor_name,description,amount,currency_code,expected_date,created_by)
  values(v_id,p_workspace_id,p_project_id,v_ref,p_commitment_type,btrim(p_vendor_name),left(coalesce(p_description,''),3000),p_amount,v_currency,p_expected_date,auth.uid());
  insert into public.project_commitment_events(commitment_id,workspace_id,actor_id,event_type,new_status)
  values(v_id,p_workspace_id,auth.uid(),'submitted','submitted');
  return v_id;
end $$;

create or replace function public.decide_project_commitment(p_commitment_id uuid,p_decision text,p_comment text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare v_record public.project_commitments%rowtype; v_next text;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_decision not in ('approved','rejected','received','cancelled') then raise exception 'invalid decision' using errcode='22023'; end if;
  select * into v_record from public.project_commitments where id=p_commitment_id for update;
  if not found or not public.can_edit_workspace(v_record.workspace_id) then raise exception 'access denied' using errcode='42501'; end if;
  if p_decision='received' and v_record.status<>'approved' then raise exception 'only approved commitments can be received' using errcode='22023'; end if;
  if p_decision in ('approved','rejected') and not public.is_workspace_owner(v_record.workspace_id) then
    raise exception 'owner approval required' using errcode='42501';
  end if;
  if v_record.status not in ('submitted','approved') then raise exception 'commitment is already closed' using errcode='22023'; end if;
  v_next := p_decision;
  update public.project_commitments set status=v_next,decision_note=nullif(left(coalesce(p_comment,''),2000),''),
    decided_by=case when p_decision in ('approved','rejected') then auth.uid() else decided_by end,
    decided_at=case when p_decision in ('approved','rejected') then now() else decided_at end,
    received_at=case when p_decision='received' then now() else received_at end,updated_at=now()
  where id=p_commitment_id;
  insert into public.project_commitment_events(commitment_id,workspace_id,actor_id,event_type,previous_status,new_status,comment)
  values(p_commitment_id,v_record.workspace_id,auth.uid(),p_decision,v_record.status,v_next,nullif(left(coalesce(p_comment,''),2000),''));
end $$;

revoke all on function public.create_project_commitment(uuid,uuid,text,text,text,text,numeric,text,date) from public,anon;
revoke all on function public.decide_project_commitment(uuid,text,text) from public,anon;
grant execute on function public.create_project_commitment(uuid,uuid,text,text,text,text,numeric,text,date) to authenticated;
grant execute on function public.decide_project_commitment(uuid,text,text) to authenticated;
