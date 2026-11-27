-- Cover project, workspace, and user foreign keys on the document library.
create index project_documents_project_workspace_idx
  on public.project_documents (project_id, workspace_id);
create index project_documents_created_by_idx
  on public.project_documents (created_by);
create index project_document_versions_parent_idx
  on public.project_document_versions (document_id, workspace_id, project_id);
create index project_document_versions_uploaded_by_idx
  on public.project_document_versions (uploaded_by);
