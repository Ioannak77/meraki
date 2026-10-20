-- LifeOS database schema (Milestones 1-2).
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Every row belongs to one signed-in user, and row level security makes sure
-- you can only ever read or change your own rows.

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  icon text not null default 'circle',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  area_id uuid references public.areas on delete set null,
  title text not null,
  notes text,
  due_date date,
  minutes int check (minutes is null or minutes between 1 and 600),
  energy text not null default 'normal' check (energy in ('low', 'normal', 'high')),
  is_essential boolean not null default false,  -- part of today's "daily baseline"
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Milestone 2: routines. Created now so the shape is settled early.
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  area_id uuid references public.areas on delete set null,
  name text not null,
  schedule jsonb not null default '{"days": [0,1,2,3,4,5,6]}',
  window_start time,  -- preferred reminder window, e.g. 19:00-22:00
  window_end time,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid not null references public.routines on delete cascade,
  title text not null,
  minutes int not null default 5 check (minutes between 1 and 240),
  in_short_version boolean not null default true,
  sort_order int not null default 0
);

-- One row per scheduled routine instance and what happened to it.
create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid not null references public.routines on delete cascade,
  day date not null,
  status text not null default 'due' check (status in ('due', 'done', 'short', 'snoozed', 'skipped')),
  snoozed_until timestamptz,
  completed_at timestamptz,
  unique (routine_id, day)
);

create index if not exists tasks_user_open on public.tasks (user_id, completed_at, due_date);
create index if not exists occurrences_user_day on public.occurrences (user_id, day);

alter table public.areas enable row level security;
alter table public.tasks enable row level security;
alter table public.routines enable row level security;
alter table public.routine_steps enable row level security;
alter table public.occurrences enable row level security;

do $$
declare t text;
begin
  foreach t in array array['areas', 'tasks', 'routines', 'routine_steps', 'occurrences'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
