-- Private, workspace-scoped project document library with immutable versions.
create table public.project_documents (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 1000),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  constraint project_documents_project_workspace_fk foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id) on delete cascade,
  constraint project_documents_tenant_key unique (id, workspace_id, project_id)
);

create table public.project_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  version_number integer not null check (version_number > 0),
  file_name text not null check (length(btrim(file_name)) between 1 and 240),
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  constraint project_document_versions_parent_fk foreign key (document_id, workspace_id, project_id)
    references public.project_documents (id, workspace_id, project_id) on delete cascade,
  constraint project_document_versions_number_unique unique (document_id, version_number)
);

create index project_documents_workspace_project_created_idx
  on public.project_documents (workspace_id, project_id, created_at desc);
create index project_document_versions_document_created_idx
  on public.project_document_versions (document_id, version_number desc);

alter table public.project_documents enable row level security;
alter table public.project_document_versions enable row level security;
revoke all on public.project_documents, public.project_document_versions from anon, authenticated;
grant select on public.project_documents, public.project_document_versions to authenticated;

create policy project_documents_workspace_read on public.project_documents
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy project_document_versions_workspace_read on public.project_document_versions
  for select to authenticated using (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chantier-documents', 'chantier-documents', false, 26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
);

create policy chantier_documents_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chantier-documents'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^/]{1,180}$'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.workspace_id::text = (storage.foldername(name))[1]
        and public.can_edit_workspace(p.workspace_id)
    )
  );

create policy chantier_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chantier-documents'
    and exists (
      select 1 from public.project_document_versions v
      where v.storage_path = storage.objects.name
        and public.is_workspace_member(v.workspace_id)
    )
  );

create policy chantier_documents_cleanup_unregistered on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chantier-documents'
    and array_length(storage.foldername(name), 1) = 3
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^/]{1,180}$'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.workspace_id::text = (storage.foldername(name))[1]
        and public.can_edit_workspace(p.workspace_id)
    )
    and not exists (
      select 1 from public.project_document_versions v
      where v.storage_path = storage.objects.name
    )
  );

create or replace function public.register_project_document(
  p_document_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_title text,
  p_description text,
  p_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint
)
returns table (document_id uuid, version_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_file_name text := btrim(coalesce(p_file_name, ''));
  v_expected_prefix text := p_workspace_id::text || '/' || p_project_id::text || '/' || p_document_id::text || '/';
  v_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if length(v_title) not between 1 and 200 or length(v_file_name) not between 1 and 240
     or length(coalesce(p_description, '')) > 1000
     or p_size_bytes not between 1 and 26214400
     or p_mime_type not in (
       'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     ) then
    raise exception 'document metadata is invalid' using errcode = '22023';
  end if;
  if not public.can_edit_workspace(p_workspace_id) or not exists (
    select 1 from public.projects p where p.id = p_project_id and p.workspace_id = p_workspace_id
  ) then
    raise exception 'project not found or access denied' using errcode = '42501';
  end if;
  select o.metadata into v_metadata from storage.objects o
  where o.bucket_id = 'chantier-documents' and o.name = p_storage_path and o.owner_id = auth.uid()::text;
  if left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix
     or v_metadata is null
     or lower(coalesce(v_metadata->>'mimetype', '')) <> lower(p_mime_type)
     or coalesce(nullif(v_metadata->>'size', '')::bigint, -1) <> p_size_bytes then
    raise exception 'uploaded object not found in project path' using errcode = '22023';
  end if;
  insert into public.project_documents (id, workspace_id, project_id, title, description, created_by)
  values (p_document_id, p_workspace_id, p_project_id, v_title, coalesce(p_description, ''), auth.uid());
  insert into public.project_document_versions (
    document_id, workspace_id, project_id, version_number, file_name, storage_path, mime_type, size_bytes, uploaded_by
  ) values (
    p_document_id, p_workspace_id, p_project_id, 1, v_file_name, p_storage_path, p_mime_type, p_size_bytes, auth.uid()
  );
  return query select p_document_id, 1;
end;
$$;

create or replace function public.append_project_document_version(
  p_document_id uuid,
  p_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.project_documents%rowtype;
  v_file_name text := btrim(coalesce(p_file_name, ''));
  v_version integer;
  v_expected_prefix text;
  v_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_document from public.project_documents d where d.id = p_document_id for update;
  if not found or not public.can_edit_workspace(v_document.workspace_id) then
    raise exception 'document not found or access denied' using errcode = '42501';
  end if;
  if length(v_file_name) not between 1 and 240 or p_size_bytes not between 1 and 26214400
     or p_mime_type not in (
       'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     ) then
    raise exception 'document metadata is invalid' using errcode = '22023';
  end if;
  v_expected_prefix := v_document.workspace_id::text || '/' || v_document.project_id::text || '/' || v_document.id::text || '/';
  select o.metadata into v_metadata from storage.objects o
  where o.bucket_id = 'chantier-documents' and o.name = p_storage_path and o.owner_id = auth.uid()::text;
  if left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix
     or v_metadata is null
     or lower(coalesce(v_metadata->>'mimetype', '')) <> lower(p_mime_type)
     or coalesce(nullif(v_metadata->>'size', '')::bigint, -1) <> p_size_bytes then
    raise exception 'uploaded object not found in document path' using errcode = '22023';
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_version
  from public.project_document_versions v where v.document_id = v_document.id;
  insert into public.project_document_versions (
    document_id, workspace_id, project_id, version_number, file_name, storage_path, mime_type, size_bytes, uploaded_by
  ) values (
    v_document.id, v_document.workspace_id, v_document.project_id, v_version,
    v_file_name, p_storage_path, p_mime_type, p_size_bytes, auth.uid()
  );
  return v_version;
end;
$$;

revoke all on function public.register_project_document(uuid, uuid, uuid, text, text, text, text, text, bigint) from public, anon;
revoke all on function public.append_project_document_version(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.register_project_document(uuid, uuid, uuid, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.append_project_document_version(uuid, text, text, text, bigint) to authenticated;
