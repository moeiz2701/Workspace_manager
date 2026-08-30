# Decisions

Choices made while building that `IMPLEMENTATION.md` did not cover, or where
reality differed from the spec. Newest section last.

---

## Answers to §12 (open questions), given by the owner before Phase 0

1. **Supabase environment** — a cloud project is the target. Local Docker Supabase
   is used only to validate migrations, generate types and run tests; Google
   OAuth is exercised against the cloud project.
2. **Member permissions** — the spec default stands. A member may read
   everything, comment, and call `set_task_status` on tasks they are assigned to.
   Members cannot create tasks, change assignees, or edit task fields.
3. **Board columns** — four: `To Do` / `In Progress` / `In Review` / `Done`,
   with `Cancelled` behind a toggle.
4. **Optional extras** — neither. Imports are `upsert`-only (no `sync` mode) and
   there is no category-lead column. Both remain additive migrations later.

Not yet needed (§12.1, §12.5): `bootstrap_admins` currently holds one email; a
task is never hard-deleted, only `cancelled`.

---

## Phase 0 — Foundation

### Stack

- **shadcn/ui style is `new-york` (Radix), not the CLI default.** The current
  shadcn CLI defaults to the `base-nova` style, which is built on Base UI and
  uses a `render` prop where Radix uses `asChild`. §1 specifies shadcn/ui
  (Radix), so `components.json` is pinned to `new-york` and the whole component
  set was reinstalled on Radix primitives.
- **Postgres 17**, not 15. Both the Supabase CLI's local stack and new cloud
  projects are on 17; nothing in the schema depends on the difference.
- **Supabase CLI is a dev dependency**, not a global install, so the version is
  pinned in the lockfile. Run it as `pnpm supabase …` or via the `db:*` scripts.
- **Zod 4** is what installs today. `z.string().email()` and `z.string().date()`
  still work; where Zod 4 prefers a different form the newer form is used.
- **`sonner` for toasts** — §7.3 requires "a rollback toast carrying the
  server's real error message" but names no library. sonner is the shadcn
  default.

### Schema

- **Migrations are idempotent** (`create table if not exists`, `create type` in a
  `do` block that swallows `duplicate_object`, `drop trigger if exists` before
  each `create trigger`, `drop policy if exists` before each `create policy`).
  The spec's SQL is written for a single clean run; re-runnable files are safer
  against a partially-applied push.
- **`handle_new_user()` stays in `0002`** even though it inserts into
  `notifications`, which is created in `0005`. plpgsql resolves table names at
  call time, not at definition time, so the ordering is fine — and it keeps the
  file layout matching §3.
- **`profiles` insert is `on conflict (id) do nothing`.** Guards against a
  duplicate `auth.users` insert re-firing the trigger.
- **`approve_member` returns early when no row was updated**, so re-approving an
  already-approved member does not raise a second `access_approved`
  notification.
- **`reject_member` refuses to reject the caller**, and **`set_member_role`
  refuses to demote the last remaining admin.** Neither is in §3.2, but both
  are one-line guards against locking yourself out of your own workspace.
- **`set_member_color` RPC added.** §7.2 wants an admin-editable colour badge,
  but `color` is one of the columns `guard_profile_columns()` reverts for
  non-admins; routing it through an admin-checked RPC keeps that guard intact
  and matches how every other privileged write works.
- **`categories.color` gained the same palette CHECK constraint as
  `profiles.color`.** §3.3 omits it; without it an import could write a token
  the UI cannot render.
- **Extra audit triggers.** §4.3 defines triggers for status/note/priority
  changes and assignment. The `activity_type` enum also declares `created`,
  `assignee_removed`, `dependency_added`, `category_changed` and
  `parent_changed`, so triggers were added to actually emit them — otherwise
  the audit trail has holes the enum implies it does not.
- **`person_progress` view added** alongside the three in §3.6. §7.2's tracker
  needs a per-person rollup and this keeps that number computed in SQL like
  every other progress figure (§2, rule 6).
- **`v_tasks` exposes `parent_key`.** The board's `⤷ parent-key` breadcrumb
  (§7.2) would otherwise need a second query per card.
- **Realtime publication membership is added inside a guard**, since
  `alter publication … add table` errors if the table is already a member.

### App

- **`middleware.ts` reads `profiles.status` on every request.** That is one
  extra query per navigation, and it is what makes an approval take effect
  immediately rather than at the next token refresh. RLS is still the actual
  boundary — the redirect is convenience (§2, rule 1).
- **`/pending` polls every 20s in addition to its Realtime subscription.** A
  dropped socket should not strand someone on the waiting screen.
- **`src/types/app.ts` holds hand-written domain types.** `database.ts` is
  generated and describes the schema; view columns all type as nullable there
  because Postgres reports no NOT NULL for views. The app types describe what
  each screen actually selects.

### Verification performed (§9, Phase 0 "done when")

Against the local stack, with a task seeded as the table owner:

- Anonymous PostgREST `select` on `tasks`, `categories`, `profiles`,
  `task_activity`, `notifications`, `v_tasks`, `category_progress` and
  `bootstrap_admins` — all return zero rows.
- A `pending` user sees 0 tasks, 0 categories, 0 rows of `v_tasks`, and exactly
  1 profile row (their own).
- A `pending` user's `update profiles set role='admin', status='approved'`
  on their own row is silently reverted by `guard_profile_columns()`.
- An approved member who is not assigned is refused by `set_task_status`, and
  their direct `update tasks`, `insert into tasks`, `insert into task_assignees`
  and `insert into task_activity` are all refused by RLS.
- An assigned member moving a blocked task gets
  `Task BT-01 is blocked by: ML-01, ML-01-A`.
- A parent with an open child cannot be completed.
- Both cycle triggers fire (`Circular dependency detected`,
  `Circular task hierarchy detected`).
- `started_at` / `completed_at` are set by trigger; the audit trail records
  actor and timestamp for every status change; `task_unblocked` notifications
  fan out when the last blocker completes.
