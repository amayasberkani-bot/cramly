-- Cramly foundation schema. Public catalog rows are illustrative; student data is private by default.
-- Apply only to the dedicated Cramly Supabase project.

create table if not exists public.universities (
  id text primary key,
  name text not null,
  city text not null,
  is_demo boolean not null default true
);

create table if not exists public.filieres (
  id text primary key,
  name_fr text not null,
  name_ar text not null,
  is_demo boolean not null default true
);

create table if not exists public.modules (
  id text primary key,
  filiere_id text not null references public.filieres(id) on delete cascade,
  semester smallint not null check (semester between 1 and 6),
  name_fr text not null,
  name_ar text not null,
  accent text not null default '#679C76',
  is_demo boolean not null default true
);

create table if not exists public.units (
  id text primary key,
  module_id text not null references public.modules(id) on delete cascade,
  position integer not null default 0,
  name_fr text not null,
  name_ar text not null,
  is_demo boolean not null default true,
  unique (module_id, position)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id text references public.units(id) on delete set null,
  module_id text not null references public.modules(id) on delete cascade,
  title_fr text not null,
  title_ar text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_demo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  university_id text references public.universities(id) on delete set null,
  filiere_id text references public.filieres(id) on delete set null,
  semester smallint not null default 1 check (semester between 1 and 6),
  study_year smallint not null default 1 check (study_year between 1 and 7),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  step_index integer not null default 0 check (step_index >= 0),
  mastery smallint not null default 0 check (mastery between 0 and 100),
  completed_at timestamptz,
  last_studied_at timestamptz,
  unique (user_id, lesson_id)
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  prompt text not null,
  answer text not null,
  due_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days >= 0),
  ease numeric(4,2) not null default 2.50 check (ease >= 1.30),
  repetitions integer not null default 0 check (repetitions >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points between 0 and 10000),
  reason text not null check (reason in ('answer_correct', 'lesson_complete', 'daily_review', 'shared_lesson', 'streak', 'exam_checklist')),
  source_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_days integer not null default 0 check (current_days >= 0),
  longest_days integer not null default 0 check (longest_days >= 0),
  last_active_on date,
  freeze_tokens smallint not null default 0 check (freeze_tokens between 0 and 2),
  rest_days_used smallint not null default 0 check (rest_days_used between 0 and 4),
  updated_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  filiere_id text not null references public.filieres(id) on delete cascade,
  week_start date not null,
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'diamond')),
  is_demo boolean not null default true,
  unique (filiere_id, week_start, tier)
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_xp integer not null default 0 check (weekly_xp >= 0),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null references public.modules(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- Saturday = 0; Friday = 6
  class_type text not null check (class_type in ('Cours', 'TD', 'TP')),
  start_time time not null,
  end_time time not null,
  room text,
  valid_from date,
  valid_until date,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.exam_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null references public.modules(id) on delete restrict,
  event_type text not null check (event_type in ('Devoir / Contrôle', 'Examen', 'TP évalué', 'Rattrapage')),
  event_date date not null,
  start_time time,
  importance text not null default 'normal' check (importance in ('normal', 'high')),
  weight numeric(5,2) check (weight between 0 and 100),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('class_preview', 'exam', 'due_review', 'streak', 'free_slot')),
  scheduled_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'dismissed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'ar' check (locale in ('ar', 'fr')),
  timezone text not null default 'Africa/Algiers',
  quiet_start time not null default '22:30',
  quiet_end time not null default '07:00',
  preferred_evening_time time not null default '19:00',
  max_nudges_per_day smallint not null default 2 check (max_nudges_per_day between 0 and 4),
  rest_day smallint check (rest_day between 0 and 6),
  muted_module_ids text[] not null default '{}',
  paused_until timestamptz,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null references public.modules(id) on delete restrict,
  storage_path text not null,
  content_hash text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 25000000),
  page_count smallint check (page_count between 1 and 100),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create table if not exists public.generated_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_id uuid references public.uploads(id) on delete set null,
  module_id text not null references public.modules(id) on delete restrict,
  title text not null,
  explanation_locale text not null check (explanation_locale in ('ar', 'fr')),
  script jsonb not null default '{}'::jsonb,
  summary text not null default '',
  flashcards jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'shared', 'reviewed', 'archived')),
  ai_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_reviews (
  id uuid primary key default gen_random_uuid(),
  generated_lesson_id uuid not null references public.generated_lessons(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('approved', 'needs_changes', 'commented')),
  comment text,
  created_at timestamptz not null default now(),
  unique (generated_lesson_id, reviewer_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null references public.modules(id) on delete restrict,
  generated_lesson_id uuid references public.generated_lessons(id) on delete set null,
  title text not null,
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.post_ratings (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'lesson', 'group')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  university_id text references public.universities(id) on delete set null,
  module_id text references public.modules(id) on delete set null,
  name text not null,
  is_public boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.usage_quotas (
  user_id uuid not null references auth.users(id) on delete cascade,
  quota_key text not null check (quota_key in ('lesson_conversions', 'zuzu_questions')),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  limit_count integer not null check (limit_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, quota_key, period_start)
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'cancelled', 'expired')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists timetable_user_day_idx on public.timetable_entries (user_id, day_of_week);
create index if not exists exam_user_date_idx on public.exam_events (user_id, event_date);
create index if not exists reminder_user_schedule_idx on public.reminders (user_id, scheduled_at) where status = 'scheduled';
create index if not exists review_user_due_idx on public.review_items (user_id, due_at);
create index if not exists progress_user_lesson_idx on public.lesson_progress (user_id, lesson_id);
create index if not exists posts_published_recent_idx on public.posts (created_at desc) where status = 'published';
create index if not exists modules_filiere_idx on public.modules (filiere_id);
create index if not exists lessons_unit_idx on public.lessons (unit_id);
create index if not exists lessons_module_idx on public.lessons (module_id);
create index if not exists lessons_creator_idx on public.lessons (created_by);
create index if not exists profiles_university_idx on public.profiles (university_id);
create index if not exists profiles_filiere_idx on public.profiles (filiere_id);
create index if not exists progress_lesson_idx on public.lesson_progress (lesson_id);
create index if not exists review_lesson_idx on public.review_items (lesson_id);
create index if not exists xp_user_idx on public.xp_events (user_id);
create index if not exists league_members_user_idx on public.league_members (user_id);
create index if not exists timetable_module_idx on public.timetable_entries (module_id);
create index if not exists exam_module_idx on public.exam_events (module_id);
create index if not exists upload_module_idx on public.uploads (module_id);
create index if not exists generated_user_idx on public.generated_lessons (user_id);
create index if not exists generated_upload_idx on public.generated_lessons (upload_id);
create index if not exists generated_module_idx on public.generated_lessons (module_id);
create index if not exists review_reviewer_idx on public.lesson_reviews (reviewer_id);
create index if not exists posts_user_idx on public.posts (user_id);
create index if not exists posts_module_idx on public.posts (module_id);
create index if not exists posts_lesson_idx on public.posts (generated_lesson_id);
create index if not exists post_ratings_user_idx on public.post_ratings (user_id);
create index if not exists reports_user_idx on public.reports (user_id);
create index if not exists groups_university_idx on public.groups (university_id);
create index if not exists groups_module_idx on public.groups (module_id);
create index if not exists groups_creator_idx on public.groups (created_by);
create index if not exists group_members_user_idx on public.group_members (user_id);

insert into public.universities (id, name, city) values
  ('setif-1', 'Université Sétif 1', 'Sétif'),
  ('batna-2', 'Université Batna 2', 'Batna'),
  ('alger-1', 'Université Alger 1', 'Alger'),
  ('usthb', 'USTHB', 'Bab Ezzouar'),
  ('constantine-1', 'Université Constantine 1', 'Constantine'),
  ('oran-1', 'Université Oran 1', 'Oran'),
  ('annaba', 'Université Badji Mokhtar', 'Annaba'),
  ('blida-1', 'Université Blida 1', 'Blida')
on conflict (id) do nothing;

insert into public.filieres (id, name_fr, name_ar) values
  ('snv', 'Sciences de la Nature et de la Vie', 'علوم الطبيعة والحياة'),
  ('st', 'Sciences et Technologies', 'علوم وتكنولوجيا')
on conflict (id) do nothing;

insert into public.modules (id, filiere_id, semester, name_fr, name_ar, accent) values
  ('snv-biologie-cellulaire', 'snv', 1, 'Biologie cellulaire', 'بيولوجيا الخلية', '#679C76'),
  ('snv-chimie-generale', 'snv', 1, 'Chimie générale', 'الكيمياء العامة', '#FF8A3D'),
  ('snv-mathematiques-1', 'snv', 1, 'Mathématiques 1', 'رياضيات 1', '#8B6CF0'),
  ('snv-physique-1', 'snv', 1, 'Physique 1', 'فيزياء 1', '#4C8DF6'),
  ('snv-geologie', 'snv', 1, 'Géologie', 'جيولوجيا', '#A4B85D'),
  ('snv-methodologie', 'snv', 1, 'Méthodologie', 'منهجية', '#D7A938'),
  ('st-mathematiques-1', 'st', 1, 'Mathématiques 1', 'رياضيات 1', '#8B6CF0'),
  ('st-physique-1', 'st', 1, 'Physique 1', 'فيزياء 1', '#4C8DF6'),
  ('st-chimie-generale', 'st', 1, 'Chimie générale', 'الكيمياء العامة', '#FF8A3D'),
  ('st-informatique-1', 'st', 1, 'Informatique 1', 'إعلام آلي 1', '#14301F'),
  ('st-mecanique-1', 'st', 1, 'Mécanique 1', 'ميكانيك 1', '#679C76'),
  ('st-methodologie', 'st', 1, 'Méthodologie', 'منهجية', '#D7A938')
on conflict (id) do nothing;

insert into public.units (id, module_id, position, name_fr, name_ar) values
  ('snv-bio-unite-1', 'snv-biologie-cellulaire', 1, 'Organisation cellulaire', 'التنظيم الخلوي'),
  ('snv-bio-unite-2', 'snv-biologie-cellulaire', 2, 'Membranes et organites', 'الأغشية والعضيات'),
  ('snv-chimie-unite-1', 'snv-chimie-generale', 1, 'Structure de la matière', 'بنية المادة'),
  ('snv-chimie-unite-2', 'snv-chimie-generale', 2, 'Solutions et réactions', 'المحاليل والتفاعلات'),
  ('snv-math-unite-1', 'snv-mathematiques-1', 1, 'Fonctions', 'الدوال'),
  ('snv-math-unite-2', 'snv-mathematiques-1', 2, 'Dérivation', 'الاشتقاق'),
  ('snv-physics-unite-1', 'snv-physique-1', 1, 'Grandeurs et unités', 'الكميات والوحدات'),
  ('snv-physics-unite-2', 'snv-physique-1', 2, 'Mécanique', 'الميكانيك'),
  ('snv-geo-unite-1', 'snv-geologie', 1, 'Terre et minéraux', 'الأرض والمعادن'),
  ('snv-method-unite-1', 'snv-methodologie', 1, 'Méthodes de travail', 'طرق العمل'),
  ('st-math-unite-1', 'st-mathematiques-1', 1, 'Fonctions', 'الدوال'),
  ('st-math-unite-2', 'st-mathematiques-1', 2, 'Dérivation', 'الاشتقاق'),
  ('st-physics-unite-1', 'st-physique-1', 1, 'Mécanique', 'الميكانيك'),
  ('st-chem-unite-1', 'st-chimie-generale', 1, 'Structure de la matière', 'بنية المادة'),
  ('st-info-unite-1', 'st-informatique-1', 1, 'Algorithmique', 'الخوارزميات'),
  ('st-mech-unite-1', 'st-mecanique-1', 1, 'Statique', 'السكون'),
  ('st-method-unite-1', 'st-methodologie', 1, 'Méthodes de travail', 'طرق العمل')
on conflict (id) do nothing;

-- Public catalog is read-only for browser roles.
alter table public.universities enable row level security;
alter table public.filieres enable row level security;
alter table public.modules enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;

drop policy if exists "Public can read university catalog" on public.universities;
create policy "Public can read university catalog" on public.universities for select to anon, authenticated using (true);
drop policy if exists "Public can read filiere catalog" on public.filieres;
create policy "Public can read filiere catalog" on public.filieres for select to anon, authenticated using (true);
drop policy if exists "Public can read module catalog" on public.modules;
create policy "Public can read module catalog" on public.modules for select to anon, authenticated using (true);
drop policy if exists "Public can read unit catalog" on public.units;
create policy "Public can read unit catalog" on public.units for select to anon, authenticated using (true);
drop policy if exists "Published lessons and owners can read lessons" on public.lessons;
create policy "Published lessons and owners can read lessons" on public.lessons for select to authenticated using (status = 'published' or created_by = (select auth.uid()));
drop policy if exists "Owners create lessons" on public.lessons;
create policy "Owners create lessons" on public.lessons for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "Owners update lessons" on public.lessons;
create policy "Owners update lessons" on public.lessons for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
drop policy if exists "Owners delete lessons" on public.lessons;
create policy "Owners delete lessons" on public.lessons for delete to authenticated using (created_by = (select auth.uid()));

grant select on public.universities, public.filieres, public.modules, public.units to anon, authenticated;
grant select, insert, update, delete on public.lessons to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "Students read own profile" on public.profiles;
create policy "Students read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "Students create own profile" on public.profiles;
create policy "Students create own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "Students update own profile" on public.profiles;
create policy "Students update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select, insert, update on public.profiles to authenticated;

do $$
declare
  table_name text;
  owned_tables text[] := array[
    'lesson_progress', 'review_items', 'streaks', 'timetable_entries', 'exam_events',
    'reminders', 'notification_prefs', 'push_subscriptions', 'uploads', 'generated_lessons', 'post_ratings'
  ];
begin
  foreach table_name in array owned_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Students manage own rows" on public.%I', table_name);
    execute format('create policy "Students manage own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.lesson_reviews enable row level security;
alter table public.usage_quotas enable row level security;
alter table public.subscriptions enable row level security;
alter table public.xp_events enable row level security;
alter table public.reports enable row level security;
alter table public.posts enable row level security;

drop policy if exists "Students read demo leagues" on public.leagues;
create policy "Students read demo leagues" on public.leagues for select to authenticated using (is_demo);
drop policy if exists "Students read their league membership" on public.league_members;
create policy "Students read their league membership" on public.league_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Students read their own XP history" on public.xp_events;
create policy "Students read their own XP history" on public.xp_events for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Students read public groups or their own" on public.groups;
create policy "Students read public groups or their own" on public.groups for select to authenticated using (is_public or created_by = (select auth.uid()));
drop policy if exists "Owners create groups" on public.groups;
create policy "Owners create groups" on public.groups for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "Owners update groups" on public.groups;
create policy "Owners update groups" on public.groups for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
drop policy if exists "Owners delete groups" on public.groups;
create policy "Owners delete groups" on public.groups for delete to authenticated using (created_by = (select auth.uid()));
drop policy if exists "Reviewers read their own reviews" on public.lesson_reviews;
create policy "Reviewers read their own reviews" on public.lesson_reviews for select to authenticated using (reviewer_id = (select auth.uid()));
drop policy if exists "Reviewers create their own reviews" on public.lesson_reviews;
create policy "Reviewers create their own reviews" on public.lesson_reviews for insert to authenticated with check (reviewer_id = (select auth.uid()));
drop policy if exists "Reviewers update their own reviews" on public.lesson_reviews;
create policy "Reviewers update their own reviews" on public.lesson_reviews for update to authenticated using (reviewer_id = (select auth.uid())) with check (reviewer_id = (select auth.uid()));
drop policy if exists "Students read own quotas" on public.usage_quotas;
create policy "Students read own quotas" on public.usage_quotas for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Students read own subscription" on public.subscriptions;
create policy "Students read own subscription" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

grant select on public.leagues, public.league_members, public.groups, public.lesson_reviews, public.usage_quotas, public.subscriptions to authenticated;
grant select on public.xp_events to authenticated;
grant insert, update, delete on public.groups to authenticated;
grant insert, update on public.lesson_reviews to authenticated;

drop policy if exists "Students read own reports" on public.reports;
create policy "Students read own reports" on public.reports for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Students file own reports" on public.reports;
create policy "Students file own reports" on public.reports for insert to authenticated with check (user_id = (select auth.uid()));
grant select, insert on public.reports to authenticated;

drop policy if exists "Students read their memberships" on public.group_members;
create policy "Students read their memberships" on public.group_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Students join groups as members" on public.group_members;
create policy "Students join groups as members" on public.group_members for insert to authenticated with check (user_id = (select auth.uid()) and role = 'member');
drop policy if exists "Students leave their groups" on public.group_members;
create policy "Students leave their groups" on public.group_members for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.group_members to authenticated;

-- Public community content is available only to signed-in students and only after publishing.
drop policy if exists "Students read published posts" on public.posts;
create policy "Students read published posts" on public.posts for select to authenticated using (status = 'published' or user_id = (select auth.uid()));
drop policy if exists "Students create own posts" on public.posts;
create policy "Students create own posts" on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Students update own posts" on public.posts;
create policy "Students update own posts" on public.posts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Students delete own posts" on public.posts;
create policy "Students delete own posts" on public.posts for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.post_ratings to authenticated;

-- Persist student progress against the published Cramly lesson catalog.
alter table public.lessons add column if not exists slug text;
create unique index if not exists lessons_slug_key on public.lessons(slug) where slug is not null;
alter table public.lesson_progress add column if not exists answered_steps text[] not null default '{}';
alter table public.streaks add column if not exists active_days_since_freeze smallint not null default 0 check (active_days_since_freeze between 0 and 2);
create unique index if not exists xp_events_idempotency_key on public.xp_events(user_id, reason, source_id) where source_id is not null;

insert into public.lessons(slug,module_id,unit_id,title_fr,title_ar,content,status,is_demo)
values
  ('biologie-cellulaire-organites', 'snv-biologie-cellulaire', 'snv-bio-unite-1', 'La cellule et ses organites', 'الخلية وعضياتها', '{"id":"biologie-cellulaire-organites","moduleFr":"Biologie cellulaire","moduleAr":"بيولوجيا الخلية","titleFr":"La cellule et ses organites","titleAr":"الخلية وعضياتها","estimatedMinutes":12,"steps":[{"type":"write","ar":"الخلية وحدة حية صغيرة. لكل جزء فيها وظيفة تساعدها على العمل.","fr":"La cellule est une petite unité vivante. Chaque partie a un rôle précis."},{"type":"draw","caption":{"ar":"مخطط مبسط لخلية حقيقية النواة","fr":"Schéma simplifié d’une cellule eucaryote"},"shapes":[{"type":"ellipse","cx":200,"cy":112,"rx":150,"ry":82,"color":"#b5cfae","label":"membrane"},{"type":"circle","cx":178,"cy":106,"r":31,"color":"#679c76","label":"noyau"},{"type":"ellipse","cx":265,"cy":146,"rx":25,"ry":12,"color":"#ff8a3d","label":"mitochondrie"},{"type":"circle","cx":243,"cy":77,"r":5,"color":"#4c8df6","label":"ribosome"},{"type":"circle","cx":286,"cy":100,"r":5,"color":"#4c8df6","label":"ribosome"}]},{"type":"highlight","ar":"الغشاء البلازمي يحيط بالخلية وينظم التبادل مع محيطها.","fr":"La membrane plasmique entoure la cellule et régule les échanges."},{"type":"ask","questionAr":"ما الجزء الذي يحيط بالخلية وينظم التبادل؟","questionFr":"Quelle partie entoure la cellule et régule les échanges ?","options":[{"id":"membrane","ar":"الغشاء البلازمي","fr":"La membrane plasmique"},{"id":"noyau","ar":"النواة","fr":"Le noyau"},{"id":"ribosome","ar":"الريبوسوم","fr":"Le ribosome"}],"answerId":"membrane","correctText":{"ar":"صحيح! الغشاء يحيط بالخلية ويضبط ما يدخل إليها ويخرج منها.","fr":"Exact ! La membrane contrôle ce qui entre dans la cellule et en sort."},"wrongText":{"ar":"تذكري: النواة تحمل المعلومات، أما الغشاء فيحيط بالخلية.","fr":"Indice : le noyau porte l’information, la membrane entoure la cellule."}},{"type":"write","ar":"في الداخل، تحمل النواة المادة الوراثية وتساعد على تنظيم نشاط الخلية.","fr":"À l’intérieur, le noyau contient l’information génétique et organise l’activité cellulaire."},{"type":"draw","caption":{"ar":"النواة داخل الخلية","fr":"Le noyau à l’intérieur de la cellule"},"shapes":[{"type":"ellipse","cx":200,"cy":110,"rx":142,"ry":74,"color":"#d9e8d3"},{"type":"circle","cx":192,"cy":108,"r":39,"color":"#679c76","label":"noyau"},{"type":"circle","cx":204,"cy":102,"r":9,"color":"#14301f","label":"nucléole"}]},{"type":"ask","questionAr":"أين توجد المادة الوراثية في هذه الخلية؟","questionFr":"Où se trouve l’information génétique dans cette cellule ?","options":[{"id":"noyau","ar":"في النواة","fr":"Dans le noyau"},{"id":"membrane","ar":"في الغشاء","fr":"Dans la membrane"},{"id":"milieu","ar":"في الوسط خارج الخلية","fr":"À l’extérieur"}],"answerId":"noyau","correctText":{"ar":"أحسنتِ. النواة تحتوي المادة الوراثية.","fr":"Bien vu. Le noyau contient l’information génétique."},"wrongText":{"ar":"ركزي على الجزء الدائري المرسوم داخل الخلية: إنه النواة.","fr":"Repère la forme ronde dessinée dans la cellule : c’est le noyau."}},{"type":"write","ar":"الميتوكوندريا تشارك في إنتاج الطاقة التي تستعملها الخلية.","fr":"Les mitochondries participent à la production d’énergie utilisée par la cellule."},{"type":"highlight","ar":"الريبوسومات تصنع البروتينات. لكل عضية دورها، وهي تعمل معاً.","fr":"Les ribosomes fabriquent des protéines. Les organites coopèrent."},{"type":"ask","questionAr":"ما وظيفة الريبوسومات الأساسية؟","questionFr":"Quel est le rôle principal des ribosomes ?","options":[{"id":"protein","ar":"تصنيع البروتينات","fr":"Fabriquer des protéines"},{"id":"energy","ar":"إنتاج الطاقة","fr":"Produire l’énergie"},{"id":"exchange","ar":"تنظيم التبادل عبر الغشاء","fr":"Réguler les échanges membranaires"}],"answerId":"protein","correctText":{"ar":"صحيح! الريبوسومات تشارك في تصنيع البروتينات.","fr":"Exact ! Les ribosomes participent à la fabrication des protéines."},"wrongText":{"ar":"تذكري: الطاقة ترتبط بالميتوكوندريا، والبروتينات بالريبوسومات.","fr":"Indice : l’énergie est liée aux mitochondries, les protéines aux ribosomes."}},{"type":"reveal","ar":"الخلاصة: الغشاء ينظم التبادل، النواة تحمل المعلومات، الميتوكوندريا تشارك في إنتاج الطاقة، والريبوسومات تصنع البروتينات.","fr":"À retenir : la membrane régule les échanges, le noyau porte l’information, les mitochondries participent à l’énergie et les ribosomes fabriquent des protéines."},{"type":"celebrate","ar":"ممتاز! أصبحتِ تعرفين الأجزاء الأساسية للخلية. خذي نفساً ثم تابعي على راحتك.","fr":"Bravo ! Tu connais maintenant les éléments clés d’une cellule. Respire, puis continue à ton rythme."}]}'::jsonb, 'published', true),
  ('mathematiques-derivee', 'snv-mathematiques-1', 'snv-math-unite-2', 'Dérivée d’une fonction', 'اشتقاق دالة', '{"id":"mathematiques-1-derivee","moduleFr":"Mathématiques 1","moduleAr":"رياضيات 1","titleFr":"Dérivée d’une fonction","titleAr":"اشتقاق دالة","estimatedMinutes":12,"steps":[{"type":"write","ar":"المشتقة تصف كيف تتغير الدالة قرب نقطة. نبدأ بدالة بسيطة: f(x) = x².","fr":"La dérivée décrit la variation locale d’une fonction. Prenons f(x) = x²."},{"type":"highlight","ar":"عند كل قيمة x، تمثل f′(x) ميل المماس للمنحنى.","fr":"Pour chaque x, f′(x) représente la pente de la tangente à la courbe."},{"type":"draw","caption":{"ar":"منحنى الدالة x² ومماس تقريبي عند x = 1","fr":"Courbe de x² et tangente approximative en x = 1"},"shapes":[{"type":"line","x1":48,"y1":177,"x2":354,"y2":177,"color":"#b5cfae","label":"axe-x"},{"type":"line","x1":70,"y1":190,"x2":70,"y2":26,"color":"#b5cfae","label":"axe-y"},{"type":"line","x1":115,"y1":153,"x2":148,"y2":129,"color":"#679c76","label":"courbe"},{"type":"line","x1":148,"y1":129,"x2":184,"y2":91,"color":"#679c76","label":"courbe"},{"type":"line","x1":184,"y1":91,"x2":222,"y2":46,"color":"#679c76","label":"courbe"},{"type":"line","x1":137,"y1":147,"x2":231,"y2":73,"color":"#ff8a3d","label":"tangente"},{"type":"circle","cx":184,"cy":91,"r":5,"color":"#ff8a3d","label":"point"}]},{"type":"ask","questionAr":"ماذا تمثل f′(x) هندسياً؟","questionFr":"Que représente géométriquement f′(x) ?","options":[{"id":"slope","ar":"ميل المماس","fr":"La pente de la tangente"},{"id":"area","ar":"مساحة الشكل","fr":"L’aire de la forme"},{"id":"height","ar":"ارتفاع المحور فقط","fr":"La hauteur seule"}],"answerId":"slope","correctText":{"ar":"صحيح! المشتقة تعطي ميل المماس عند نقطة.","fr":"Exact ! La dérivée donne la pente de la tangente au point."},"wrongText":{"ar":"تتبعي الخط البرتقالي: ميله هو ما تصفه المشتقة.","fr":"Regarde la droite orange : sa pente est ce que décrit la dérivée."}},{"type":"write","ar":"نستعمل قاعدة القوى: مشتقة xⁿ هي n × xⁿ⁻¹.","fr":"Règle des puissances : la dérivée de xⁿ est n × xⁿ⁻¹."},{"type":"reveal","ar":"هنا n = 2، إذن f′(x) = 2 × x²⁻¹ = 2x.","fr":"Ici n = 2, donc f′(x) = 2 × x²⁻¹ = 2x."},{"type":"pause","ar":"توقفي لحظة. عوّضي x = 1 في المشتقة.","fr":"Petite pause. Remplace x par 1 dans la dérivée."},{"type":"ask","questionAr":"إذا كانت f′(x) = 2x، فما قيمة f′(1)؟","questionFr":"Si f′(x) = 2x, combien vaut f′(1) ?","options":[{"id":"two","ar":"2","fr":"2"},{"id":"one","ar":"1","fr":"1"},{"id":"zero","ar":"0","fr":"0"}],"answerId":"two","correctText":{"ar":"نعم. 2 × 1 = 2، وهذا هو الميل عند x = 1.","fr":"Oui. 2 × 1 = 2 : c’est la pente en x = 1."},"wrongText":{"ar":"عوّضي 1 مكان x: 2 × 1.","fr":"Remplace x par 1 : calcule 2 × 1."}},{"type":"write","ar":"عند x = 0، يكون الميل صفراً. المنحنى يمر بنقطة دنيا هناك.","fr":"En x = 0, la pente est nulle. La courbe passe par un minimum."},{"type":"draw","caption":{"ar":"المماس أفقي عند x = 0","fr":"La tangente est horizontale en x = 0"},"shapes":[{"type":"line","x1":60,"y1":160,"x2":340,"y2":160,"color":"#b5cfae","label":"axe-x"},{"type":"line","x1":200,"y1":188,"x2":200,"y2":28,"color":"#b5cfae","label":"axe-y"},{"type":"line","x1":130,"y1":98,"x2":165,"y2":138,"color":"#679c76","label":"parabole"},{"type":"line","x1":165,"y1":138,"x2":200,"y2":152,"color":"#679c76","label":"parabole"},{"type":"line","x1":200,"y1":152,"x2":235,"y2":138,"color":"#679c76","label":"parabole"},{"type":"line","x1":235,"y1":138,"x2":270,"y2":98,"color":"#679c76","label":"parabole"},{"type":"line","x1":170,"y1":152,"x2":230,"y2":152,"color":"#ff8a3d","label":"tangente"}]},{"type":"ask","questionAr":"ما مشتقة الدالة f(x) = x²؟","questionFr":"Quelle est la dérivée de f(x) = x² ?","options":[{"id":"2x","ar":"2x","fr":"2x"},{"id":"x","ar":"x","fr":"x"},{"id":"x3","ar":"x³","fr":"x³"}],"answerId":"2x","correctText":{"ar":"أحسنتِ. باستعمال قاعدة القوى: 2 × x.","fr":"Bien joué. Avec la règle des puissances : 2 × x."},"wrongText":{"ar":"خذي الأس 2 واضربيه في x، ثم أنقصي الأس بواحد.","fr":"Multiplie par l’exposant 2, puis diminue cet exposant de 1."}},{"type":"celebrate","ar":"رائع! تعلمتِ معنى المشتقة وقاعدة القوى وكيفية حساب الميل عند نقطة.","fr":"Bravo ! Tu connais le sens de la dérivée, la règle des puissances et le calcul d’une pente."}]}'::jsonb, 'published', true)
on conflict (slug) where slug is not null do update set module_id=excluded.module_id,unit_id=excluded.unit_id,title_fr=excluded.title_fr,title_ar=excluded.title_ar,content=excluded.content,status=excluded.status,is_demo=excluded.is_demo;

create or replace function public.award_study_xp(p_reason text,p_source_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_points integer; v_db_reason text; v_awarded integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_source_id is null or length(btrim(p_source_id)) not between 1 and 240 then raise exception 'invalid XP source' using errcode='22023'; end if;
  v_points := case p_reason when 'correct_answer' then 10 when 'lesson_complete' then 50 when 'daily_review' then 30 when 'shared_lesson' then 20 when 'streak_7_days' then 100 when 'exam_checklist' then 20 else null end;
  if v_points is null then raise exception 'invalid XP reason' using errcode='22023'; end if;
  v_db_reason := case p_reason when 'correct_answer' then 'answer_correct' when 'streak_7_days' then 'streak' else p_reason end;
  insert into public.xp_events(user_id,points,reason,source_id)
  values(auth.uid(),v_points,v_db_reason,p_source_id)
  on conflict (user_id,reason,source_id) where source_id is not null do nothing
  returning points into v_awarded;
  return coalesce(v_awarded,0);
end $$;
revoke all on function public.award_study_xp(text,text) from public,anon;
grant execute on function public.award_study_xp(text,text) to authenticated;

-- Keep lesson answers and XP server-verified; browser roles can read but not forge progress answers.
revoke insert, update on table public.lesson_progress from authenticated;
grant select, delete on table public.lesson_progress to authenticated;
drop function if exists public.award_study_xp(text,text);

create or replace function public.record_study_lesson_step(p_lesson_slug text,p_step_index integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_lesson public.lessons%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_lesson from public.lessons where slug=p_lesson_slug and status='published';
  if not found then raise exception 'lesson not found' using errcode='22023'; end if;
  if p_step_index < 0 or p_step_index >= jsonb_array_length(v_lesson.content->'steps') then
    raise exception 'invalid lesson step' using errcode='22023';
  end if;
  insert into public.lesson_progress(user_id,lesson_id,step_index,last_studied_at)
  values(auth.uid(),v_lesson.id,p_step_index,now())
  on conflict(user_id,lesson_id) do update set step_index=excluded.step_index,last_studied_at=excluded.last_studied_at;
end $$;

create or replace function public.submit_study_lesson_answer(p_lesson_slug text,p_step_index integer,p_answer_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_lesson public.lessons%rowtype; v_step jsonb; v_source text; v_awarded integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_lesson from public.lessons where slug=p_lesson_slug and status='published';
  if not found then raise exception 'lesson not found' using errcode='22023'; end if;
  if p_step_index < 0 or p_step_index >= jsonb_array_length(v_lesson.content->'steps') then
    raise exception 'invalid lesson step' using errcode='22023';
  end if;
  v_step := v_lesson.content->'steps'->p_step_index;
  if v_step->>'type' <> 'ask' or v_step->>'answerId' is distinct from p_answer_id then
    raise exception 'answer is not correct' using errcode='22023';
  end if;
  v_source := p_lesson_slug||':'||p_step_index::text;
  insert into public.xp_events(user_id,points,reason,source_id)
  values(auth.uid(),10,'answer_correct',v_source)
  on conflict(user_id,reason,source_id) where source_id is not null do nothing
  returning points into v_awarded;
  insert into public.lesson_progress(user_id,lesson_id,step_index,last_studied_at,answered_steps)
  values(auth.uid(),v_lesson.id,p_step_index,now(),array[v_source])
  on conflict(user_id,lesson_id) do update set
    step_index=excluded.step_index,last_studied_at=excluded.last_studied_at,
    answered_steps=array(select distinct answer_key from unnest(public.lesson_progress.answered_steps||excluded.answered_steps) as answer_key);
  return coalesce(v_awarded,0);
end $$;

create or replace function public.complete_study_lesson(p_lesson_slug text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_lesson public.lessons%rowtype; v_required text[]; v_answered text[]; v_steps_count integer; v_awarded integer;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  select * into v_lesson from public.lessons where slug=p_lesson_slug and status='published';
  if not found then raise exception 'lesson not found' using errcode='22023'; end if;
  v_steps_count := jsonb_array_length(v_lesson.content->'steps');
  select array_agg(p_lesson_slug||':'||(ordinality-1)::text order by ordinality)
    into v_required
    from jsonb_array_elements(v_lesson.content->'steps') with ordinality as step(value,ordinality)
    where value->>'type'='ask';
  if coalesce(cardinality(v_required),0)=0 then raise exception 'lesson has no questions' using errcode='22023'; end if;
  select answered_steps into v_answered from public.lesson_progress
    where user_id=auth.uid() and lesson_id=v_lesson.id for update;
  if not found or not coalesce(v_answered,'{}'::text[]) @> v_required then
    raise exception 'answer every lesson question first' using errcode='22023';
  end if;
  insert into public.xp_events(user_id,points,reason,source_id)
  values(auth.uid(),50,'lesson_complete',p_lesson_slug)
  on conflict(user_id,reason,source_id) where source_id is not null do nothing
  returning points into v_awarded;
  update public.lesson_progress set mastery=100,completed_at=coalesce(completed_at,now()),
    last_studied_at=now(),step_index=greatest(step_index,v_steps_count-1)
    where user_id=auth.uid() and lesson_id=v_lesson.id;
  return coalesce(v_awarded,0);
end $$;

revoke all on function public.record_study_lesson_step(text,integer) from public,anon;
revoke all on function public.submit_study_lesson_answer(text,integer,text) from public,anon;
revoke all on function public.complete_study_lesson(text) from public,anon;
grant execute on function public.record_study_lesson_step(text,integer) to authenticated;
grant execute on function public.submit_study_lesson_answer(text,integer,text) to authenticated;
grant execute on function public.complete_study_lesson(text) to authenticated;

