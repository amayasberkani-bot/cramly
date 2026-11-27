alter table public.tasks
  add column if not exists description text not null default '',
  add column if not exists assigned_to text not null default '';

alter table public.daily_logs
  add column if not exists workforce_count integer check (workforce_count is null or workforce_count >= 0),
  add column if not exists equipment_notes text not null default '',
  add column if not exists materials_notes text not null default '',
  add column if not exists quantity_completed text not null default '',
  add column if not exists weather text not null default '';
