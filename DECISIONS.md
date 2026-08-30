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

---

## Phase 2 — Data in

### The dependency gate had a hole on INSERT

§4.1 puts the gate in a `BEFORE UPDATE` trigger, and §6.1 says "a status that
violates the dependency gate is rejected by the trigger". It would not have
been: `import_workspace` **inserts** tasks with their declared status in pass A
and only wires up dependencies in pass D, so nothing fired. A file declaring
`{"key":"BT-01","status":"done","depends_on":["ML-01"]}` would have created a
task the board itself would refuse to produce.

Fixed in two places, per §2 rule 3:

- `import_workspace` re-checks the whole graph at the end of its transaction —
  every task in a gated status with an unmet dependency, and every `done` parent
  with an open child — and raises, aborting the import.
- `planImport` performs the same check client-side so the admin sees which task
  and which blockers before confirming.

### Import

- **`mode` accepts only `"upsert"`.** Both the Zod schema and the two RPCs
  reject `"sync"` explicitly rather than ignoring it, so a file written for a
  future version fails loudly instead of silently doing half of what it says.
- **`runImport` re-plans server-side.** The dry run is a UI affordance; the
  action never trusts a client claiming it passed.
- **`preview_import` is a hand-written read-only twin**, as §6.3 anticipated.
  It re-implements the reference checks in SQL rather than calling the real
  function, because the pooler gives a Server Action no transaction to roll
  back. It resolves references against both the database and the file being
  previewed, so a task may reference a category the same file defines.
- **`findCycles` uses Kahn's algorithm to isolate the residue, then a DFS to
  extract a concrete chain.** Kahn alone says only _that_ a cycle exists. The
  residue also contains nodes that merely lead into a cycle, so chains are
  de-duplicated by their node set — otherwise `X → A, A → B, B → A` reports the
  `A → B → A` cycle twice.
- **JSON syntax errors are located in two ways.** V8 reports either
  "… at position 42" or "… \"<snippet>\" is not valid JSON" with no position,
  depending on the error and Node version. `describeJsonError` handles both so
  the admin always gets a line number.
- **Zod issue paths are humanised** to `tasks[3] (ML-01) → priority`, since
  `tasks.3.priority` is useless for finding the line in a 37-task file.

### Categories

- **`reorderCategories` writes each position in its own statement.** A single
  bulk upsert would need to send every column; positions are `(index+1)*1000`,
  leaving room to insert between two rows later without a rewrite.
- **Deleting a category with tasks is refused** with a readable message rather
  than a raw foreign-key error — `tasks.category_id` is `ON DELETE RESTRICT`.
- **The icon set is a fixed list of 16 lucide names** in an explicit map, not a
  dynamic import, so an import file cannot name an icon the UI cannot render.

### Seed file

`supabase/seed/entropable.seed.json` — 6 categories, 37 tasks. It exercises
6 subtasks across two parents, 7 multi-assignee tasks, cross-category
dependencies in both directions, all four priorities, three statuses, and
populated `start_date` / `due_date` / `estimate_hours`. A copy is served at
`public/example-import.json` for the "Example JSON" download on the import page.

### Verification performed (§9, Phase 2 "done when")

- `preview_import` on the seed reports 37 new tasks, 6 new categories, no errors
  — and writes nothing.
- `import_workspace` on the seed creates 37 tasks, 6 categories, 49 dependency
  edges, 38 assignments, 6 subtasks; member titles and colours are applied.
- Re-importing the same file reports 0 created / 37 updated, leaves the counts
  unchanged, and preserves `ML-01`'s in-flight `in_progress` status over the
  file's value.
- A 3-task cyclic file aborts the whole import — not even its category is
  written.
- A file declaring `done` on a task with an unmet dependency is refused with
  `Task GATE-02 is declared done but is blocked by: GATE-01`.
- A non-admin calling `import_workspace` is refused; `mode: "sync"` is refused.
- 28 Vitest unit tests cover the parser and the cycle detector.
