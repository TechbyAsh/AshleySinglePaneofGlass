# Life Dashboard

Static site (no build step). Works immediately in local mode; add Supabase to sync.

## 1. Try it locally
Serve the folder (ES modules need http, not file://): `npx serve .` then open the printed URL.

## 2. Supabase
1. Create a project at supabase.com.
2. SQL Editor: paste and run `supabase/schema.sql`.
3. Authentication > URL Configuration: set Site URL to your Vercel URL and add it (plus `http://localhost:3000`) to Redirect URLs.
4. Project Settings > API: copy the Project URL and anon key into `config.js`.

## 3. Deploy to Vercel
Push this folder to GitHub, import it in Vercel, framework preset "Other", no build command. Deploy.

## Notes
- Sign-in is a magic link by email; Row Level Security keeps each account's data private.
- On first sign-in, anything already saved in that browser is uploaded once.
- Footer has Export / Import (JSON) for backups and moving data.
- Only `storage.js` knows about Supabase. To change providers, rewrite the `cloud` object.
- Schema: `goals` hold your goals, `steps` hold each goal's tasks, `check_ins` hold daily answers. `sprints`, `plan_items`, `journal_entries`, `reflections` and `user_stats` are created for upcoming features; the app doesn't use them yet.
- Deleting a goal archives it (`archived_at`) rather than removing the row.
- The one addition to the schema is `goals.tag`, the small label on each goal card.
