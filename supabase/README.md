# Cloud setup and verification

Development project: `C:\Users\coool\projects\productivity-hub`.

1. Create a Supabase project. For a new database, run `schema.sql` once in SQL Editor. If you already ran Antigravity's original tasks/notes schema, skip this step.
2. Run `enable-realtime.sql` to add tasks and notes to the Realtime publication. The app also refreshes every 15 seconds while visible and whenever it regains focus; this covers deletes and missing Realtime configuration.
3. In the app root `.env.local`, fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using the project's Connect dialog. Restart the app after changing configuration; rebuild production deployments because Next.js bundles public variables at build time.
4. In Supabase Authentication URL settings, allow the development and deployment origins used for email confirmation. Keep email confirmation enabled if desired: the signup screen will ask the user to verify instead of redirecting without a session.
5. Run `npm run dev -- --hostname 0.0.0.0`. On the laptop, open `http://localhost:3000`. On a phone on the same Wi-Fi, use `http://<laptop-LAN-IP>:3000`; the phone's localhost refers to the phone itself. LAN access requires the laptop's firewall to allow the development server.

## Acceptance checks

- Sign up; confirm email when enabled; sign in and sign out.
- With account A on two browsers/devices, create, edit, complete and delete a task. Create, edit, search and delete a note. Notes use an explicit Save button; typing alone is not autosave.
- Verify the other visible session updates automatically. Realtime handles inserts/updates when publication is enabled; deletes and fallback changes appear within the next 15-second refresh. Returning to the tab refreshes immediately.
- With a different account B, verify A's tasks/notes do not appear. Try reading and changing an A-owned row through the authenticated B client: SELECT must return no rows and mutations must affect zero rows. RLS, rather than UI filters, must enforce this.
- Verify an unauthenticated client cannot read or modify rows.
- Simulate a connection failure and confirm the app shows an error instead of pretending to save. Retry when connectivity returns.
- Check small-screen layout.

These cloud checks require a real configured Supabase project and have not yet been run. Lint/build and the unconfigured setup screen do not prove database isolation or sync.

Access from unrelated networks needs a deployed HTTPS app. Local development does not yet provide a hosted URL or PWA installation.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
