-- Meraki sync: run once in the Supabase dashboard (SQL Editor > New query > paste > Run).
-- Safe to run again.
--
-- One row per part of the app (tasks + cleaning, money, self care, groceries), holding the same
-- JSON the app keeps on the device. Row level security: a signed-in user only ever sees their own rows.

create table if not exists public.meraki_data (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.meraki_data enable row level security;

drop policy if exists "own rows" on public.meraki_data;
create policy "own rows" on public.meraki_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The server's clock decides which change is newest.
create or replace function public.meraki_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meraki_touch on public.meraki_data;
create trigger meraki_touch before insert or update on public.meraki_data
  for each row execute function public.meraki_touch();
