-- Meraki notifications: run once in the Supabase dashboard (SQL Editor > New query > paste > Run),
-- after schema.sql. Safe to run again.
--
-- Each device that turns on notifications saves its Web Push subscription here. The app works out
-- the reminders for the next week and replaces its queue with them; the meraki worker checks the
-- queue every few minutes and sends what's due.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  send_at timestamptz not null,
  title text not null,
  body text not null,
  url text not null default '/meraki/',
  tag text not null default 'meraki',
  sent boolean not null default false
);
create index if not exists push_queue_due_idx on public.push_queue (sent, send_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_queue enable row level security;

revoke all on public.push_subscriptions, public.push_queue from anon;
grant select, insert, update, delete on public.push_subscriptions, public.push_queue to authenticated;

drop policy if exists "own rows" on public.push_subscriptions;
create policy "own rows" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.push_queue;
create policy "own rows" on public.push_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Swap the upcoming reminders for a new list in one go (anything already sent is kept).
create or replace function public.meraki_replace_queue(items jsonb) returns void
language sql security invoker as $$
  delete from public.push_queue where user_id = auth.uid() and not sent and send_at > now();
  insert into public.push_queue (user_id, send_at, title, body, url, tag)
  select auth.uid(), (i->>'send_at')::timestamptz, i->>'title', i->>'body',
         coalesce(i->>'url', '/meraki/'), coalesce(i->>'tag', 'meraki')
  from jsonb_array_elements(items) as i
  where (i->>'send_at')::timestamptz > now();
$$;

revoke all on function public.meraki_replace_queue(jsonb) from public, anon;
grant execute on function public.meraki_replace_queue(jsonb) to authenticated;
