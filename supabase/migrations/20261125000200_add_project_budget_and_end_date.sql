alter table public.projects
  add column if not exists planned_budget numeric(14,2) check (planned_budget is null or planned_budget >= 0),
  add column if not exists end_date date;