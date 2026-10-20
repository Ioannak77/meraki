# Meraki

A calm personal life manager for phone and iPad: today's priorities, tasks, a cleaning schedule and money.
It's built for ADHD: few steps, gentle progress, and no guilt when you miss a day.

## Run locally

```powershell
npm install
npm run dev -- -p 3100
```

Open http://localhost:3100. To try it on your phone or iPad, open the "Network" address that `npm run dev` prints, with the device on the same Wi-Fi.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS, exported as static files (`npm run build` creates `out/`).
- Data is kept in the browser (localStorage) for now. `src/lib/store.tsx` holds the shapes, which match `supabase/schema.sql`.
- Hosting: Cloudflare, using `wrangler.toml`, the same way as PumpPal.

## Milestones

1. **Working skeleton** (in progress): navigation (bottom tabs on phone, sidebar on iPad), Today dashboard, task capture/edit/complete.
   Still to do: Supabase sign-in and sync, so phone and iPad share the same data.
2. **Cleaning schedule and reminders:** daily, weekly and month-end cleaning lists with a step timer, office-day swaps, a room-by-room Big clean weekend, and (still to do) reminders.
3. **Finance:** CSV statement import, categories, bills, budgets, and a "left to spend" forecast.
4. **Insights and polish:** a weekly reset, adaptive suggestions, and reliable notifications.

## Supabase notes

- Run `supabase/schema.sql` once in the Supabase SQL editor. Every table has row level security, so you only ever see your own rows.
- Free-tier projects pause after about a week of no activity. Before relying on sync, add a small scheduled keep-alive ping (a Cloudflare Worker cron, like PumpPal's worker), so the app still works after a break.
