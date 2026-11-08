-- Personal Dashboard schema (Supabase / Postgres)
-- Run in the Supabase SQL editor. Rename tables/columns to match your existing code where needed.

create extension if not exists "pgcrypto";

-- Keeps updated_at current (useful for save/retry logic)
-- Empty search_path so the function can't be tricked into calling look-alike objects (Supabase linter).
create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SPRINTS: optional time-boxed focus periods (used by journal reflections)
create table sprints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

-- GOALS: one per goal, grouped by tab/category
create table goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category     text not null check (category in ('career','personal','family')),
  title        text not null,
  tag          text,                      -- ADDED: small label shown on goal cards (e.g. "Certification")
  notes        text,
  deadline     date,                      -- ADDED: optional target date for the goal
  position     int  not null default 0,
  sprint_id    uuid references sprints(id) on delete set null,
  archived_at  timestamptz,               -- archive instead of delete
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- STEPS: micro-goals / to-dos under a goal. These are what Plan My Day pulls from.
create table steps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id       uuid not null references goals(id) on delete cascade,
  title         text not null,
  estimate_min  int  check (estimate_min > 0),   -- used to size time blocks
  freq_period   text not null default 'once' check (freq_period in ('once','day','week','month')),  -- ADDED: how often this to-do repeats
  freq_count    int  not null default 1 check (freq_count between 1 and 31),                        -- ADDED: times per period (3 + 'week' = 3x a week)
  position      int  not null default 0,
  done_at       timestamptz,
  skipped_at    timestamptz,               -- ADDED: timestamp when task was skipped for today
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- PLAN_ITEMS: a step scheduled onto a specific day, as a time block.
-- The app also uses a row with done_at set as the completion log for repeating to-dos.
create table plan_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  step_id       uuid not null references steps(id) on delete cascade,
  plan_date     date not null,
  start_time    time,                       -- null = not yet placed in a block
  duration_min  int  check (duration_min > 0),
  position      int  not null default 0,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (plan_date, step_id, user_id)
);

-- CHECK_INS: one per day. Answers stored as JSON so new questions need no schema change.
create table check_ins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  check_date  date not null,
  answers     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),   -- ADDED: check-ins can be edited the same day
  unique (user_id, check_date)
);

-- JOURNAL_ENTRIES: raw material for monthly / sprint reflections
create table journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date  date not null default current_date,
  body        text not null,
  category    text check (category in ('career','personal','family')),
  goal_id     uuid references goals(id) on delete set null,
  sprint_id   uuid references sprints(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- REFLECTIONS: generated summaries, saved so they aren't regenerated
create table reflections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_type   text not null check (period_type in ('month','sprint')),
  period_start  date not null,
  period_end    date not null,
  sprint_id     uuid references sprints(id) on delete set null,
  body          text not null,
  created_at    timestamptz not null default now()
);

-- USER_STATS: gamification (points and streaks)
create table user_stats (
  user_id           uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  points            int  not null default 0,
  current_streak    int  not null default 0,
  longest_streak    int  not null default 0,
  last_active_date  date
);

-- Indexes for the common queries
create index on goals (user_id, category, position) where archived_at is null;
create index on steps (goal_id, position);
create index on plan_items (user_id, plan_date);
create index on journal_entries (user_id, entry_date);

-- updated_at triggers
create trigger goals_updated before update on goals
  for each row execute function set_updated_at();
create trigger steps_updated before update on steps
  for each row execute function set_updated_at();
create trigger check_ins_updated before update on check_ins
  for each row execute function set_updated_at();

-- ROW LEVEL SECURITY: each user only sees their own rows
do $$
declare t text;
begin
  foreach t in array array[
    'sprints','goals','steps','plan_items',
    'check_ins','journal_entries','reflections'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table user_stats enable row level security;
create policy "own stats" on user_stats for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
