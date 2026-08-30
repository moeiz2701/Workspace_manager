# Entropable Workspace

Internal task-management workspace used to drive the Entropable crypto trading
platform build to launch. One admin defines categories and a tree of tasks
(usually via a JSON bulk upload), assigns people, and tracks completion. Members
sign in with Google, wait for approval, then work their assigned tasks.

The full specification is [`IMPLEMENTATION.md`](./IMPLEMENTATION.md); choices it
did not cover are logged in [`DECISIONS.md`](./DECISIONS.md).

## Stack

Next.js 15 (App Router, React 19, TypeScript strict) · Tailwind CSS v4 ·
shadcn/ui (Radix) · Supabase (Postgres, Auth, Realtime) · TanStack Query ·
dnd-kit · React Flow · Zod · Vitest · Playwright · pnpm.

**Row Level Security is the only authorization layer.** There is no service-role
key anywhere in this app: every privileged operation is a `SECURITY DEFINER`
Postgres function with its own internal permission check. The UI hides what a
user cannot do; the database enforces it.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Auth → Providers → Google**: enable it and paste a Google OAuth client
   ID/secret.
   - Google Cloud Console → OAuth consent screen → Credentials → OAuth client
     (Web application).
   - Authorized redirect URI:
     `https://<project-ref>.supabase.co/auth/v1/callback`
3. **Auth → URL Configuration**:
   - Site URL: `http://localhost:3000` while developing, your Vercel URL in
     production.
   - Redirect URLs: add `http://localhost:3000/**` and
     `https://*-<your-vercel-scope>.vercel.app/**`.
4. Apply the schema:
   ```bash
   pnpm supabase link --project-ref <ref>
   pnpm db:push
   ```
5. **Seed the bootstrap admin before the first login.** This is the only path to
   an admin account — anyone who signs in before this row exists lands in the
   pending queue with nobody able to approve them. Run in the SQL editor:
   ```sql
   insert into bootstrap_admins (email) values ('you@example.com');
   ```

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable                        | Where to find it                        |
| ------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` locally         |

There is intentionally **no** `SUPABASE_SERVICE_ROLE_KEY`. Do not add one.

### 3. Run

```bash
pnpm i
pnpm dev
```

## Local database (optional)

A local Docker Supabase is useful for migrations and tests. Google OAuth does
not work against it without a tunnel.

```bash
pnpm db:start     # local Postgres + Auth + Studio (Studio on :54323)
pnpm db:reset     # re-apply every migration from scratch
pnpm db:types     # regenerate src/types/database.ts from the local schema
pnpm db:stop
```

## Scripts

| Script           | Does                                         |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Dev server                                   |
| `pnpm build`     | Production build (also typechecks and lints) |
| `pnpm typecheck` | `tsc --noEmit`                               |
| `pnpm lint`      | ESLint                                       |
| `pnpm format`    | Prettier                                     |
| `pnpm test`      | Vitest unit tests                            |
| `pnpm test:e2e`  | Playwright end-to-end tests                  |
| `pnpm db:push`   | Apply migrations to the linked cloud project |
| `pnpm db:types`  | Regenerate `src/types/database.ts`           |

## Tests

```bash
pnpm test        # Vitest: the import parser, the plan, the cycle detector
```

The Playwright suite runs against the **local** Supabase stack and truncates and
reseeds that database, so never point it at a hosted project:

```bash
pnpm db:start
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key printed by db:start>
pnpm test:e2e
```

It covers the four critical paths: a pending user sees no data (through the UI
_and_ through PostgREST); a blocked task cannot be moved; completing its blocker
makes the move succeed and writes an audit row; and a member calling
`set_task_status` on a task they are not assigned to is rejected by the database
rather than by the UI.

## Working rules

- **Never edit the schema through the Supabase dashboard.** Migrations only, as
  SQL files in `supabase/migrations/`.
- Regenerate `src/types/database.ts` after every migration and commit it.
- Reads happen in Server Components; writes happen in Server Actions. Actions
  that carry a business rule call an RPC.
- Realtime only invalidates caches — never render or authorize from a payload.
