@AGENTS.md

# Meraki: notes for Claude

## Names Ioanna uses (use these in anything she sees)

- The cleaning section is the **Cleaning schedule**. Never call it "Routines" in the UI, docs or messages.
  The phone tab bar says "Cleaning" (short label); the page title and iPad sidebar say "Cleaning schedule".
  The page lives at `/cleaning/`. (Code still uses `Routine`/`routine` as internal type names; that's fine.)
- The money section's page title is **Money**.
- The skincare section is **Skincare** (phone tab bar: "Skin"); the tab of your own trackers is **Tracker**.
- Pari is Ioanna's dog; she has her own task area and appears in cleaning and money categories.

## Working on this repo

- Ioanna tests in the in-app browser on her own data (dev server on port 3000). Never test on that origin:
  build (`npx next build`) and serve `out/` on a separate port (e.g. 3200) so localStorage is separate.
- The dev server sometimes misses file changes on the D: drive; restart it if the page looks stale.
- Commit and push to github.com/Ioannak77/meraki after each change.
