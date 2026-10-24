@AGENTS.md

# Meraki: notes for Claude

## Names Ioanna uses (use these in anything she sees)

- The cleaning section is the **Cleaning schedule**. Never call it "Routines" in the UI, docs or messages.
  The phone tab bar says "Cleaning" (short label); the page title and iPad sidebar say "Cleaning schedule".
  The page lives at `/cleaning/`. (Code still uses `Routine`/`routine` as internal type names; that's fine.)
- The money section's page title is **Money**.
- The **Self care** section (page `/self-care/`) covers skincare, repeating reminders (waxing, nails, hair…)
  and photo check-ins. Never call the section "Skin" or "Skincare"; "skincare" is only the morning/evening
  skin steps inside it. The tab of your own trackers is **Tracker**.
- Pari is Ioanna's dog; she has her own task area and appears in cleaning and money categories.

## Agreed next steps (Ioanna said "remind me later", 2026-10-24) — raise these after the page-by-page review

1. DONE (2026-10-24): phone setup. Paths under /meraki/, PNG icons, offline service worker (public/sw.js, built app only), home screen card in Settings.
2. DONE (2026-10-24): Backup card in Settings (Save / Load backup, last backup date).
3. DONE (2026-10-24): sync via Supabase project "Meraki" (najxrysykfwboefjubfn): src/lib/sync.ts, Settings > Sync, supabase/schema.sql, daily keep-alive cron in workers/receipts. Email confirm is off; turn off new sign-ups once Ioanna has her account.
4. Reminders when the app is closed (push via a worker, like PumpPal).
5. Edit the cleaning schedule in the app (lists are hard-coded in `src/lib/cleaning.ts`).
6. Later: Calendar and Insights pages (placeholders), choose which cards show on Today.

## Working on this repo

- Ioanna tests in the in-app browser on her own data (dev server on port 3000). Never test on that origin:
  build (`npx next build`) and serve `out/` on a separate port (e.g. 3200) so localStorage is separate.
- The dev server sometimes misses file changes on the D: drive; restart it if the page looks stale.
- Commit and push to github.com/Ioannak77/meraki after each change.
