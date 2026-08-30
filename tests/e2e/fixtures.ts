import { execFileSync } from 'node:child_process';

/**
 * Shared fixture for the e2e suite.
 *
 * Users are created directly in `auth.users` with a bcrypt password so the
 * §8.4 dev login can sign them in; `handle_new_user` then provisions their
 * profile exactly as a real Google sign-in would.
 */

export const SUPABASE_URL = 'http://127.0.0.1:54321';

export const USERS = {
  admin: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@entropable.test',
    password: 'testpassword123',
    name: 'Ada Admin',
  },
  member: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'member@entropable.test',
    password: 'testpassword123',
    name: 'Mo Member',
  },
  other: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'other@entropable.test',
    password: 'testpassword123',
    name: 'Otto Other',
  },
  pending: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'pending@entropable.test',
    password: 'testpassword123',
    name: 'Pat Pending',
  },
} as const;

const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_workspace';

/** Run SQL against the local stack. Returns stdout for assertions. */
export function sql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', statement],
    { encoding: 'utf8' },
  ).trim();
}

export function sqlScript(script: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { encoding: 'utf8', input: script },
  ).trim();
}

function createUser(user: (typeof USERS)[keyof typeof USERS]) {
  // The token columns have no defaults, and GoTrue scans them as non-null
  // strings — leaving them NULL makes every sign-in fail with
  // "Database error querying schema". An `auth.identities` row is what the
  // email provider looks the user up by.
  return `
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '${user.id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '${user.email}', crypt('${user.password}', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"${user.name}"}', now(), now(),
  '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  '${user.id}', '${user.id}',
  '{"sub":"${user.id}","email":"${user.email}","email_verified":true,"phone_verified":false}',
  'email', now(), now(), now()
) on conflict do nothing;`;
  // auth.identities.email is a generated column derived from identity_data.
}

/**
 * Wipe and rebuild the fixture. Truncating rather than `db reset` keeps the
 * setup fast and leaves the schema (and the Supabase containers) untouched.
 */
export function seedDatabase() {
  sqlScript(`
begin;

truncate table task_activity, notifications, comment_mentions, task_comments,
               task_dependencies, task_assignees, imports restart identity cascade;
delete from tasks;
delete from categories;
delete from profiles;
delete from auth.identities;
delete from auth.users;
delete from bootstrap_admins;

insert into bootstrap_admins (email) values ('${USERS.admin.email}');

${Object.values(USERS).map(createUser).join('\n')}

commit;

-- Approve everyone except the pending user, as the admin would.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${USERS.admin.id}","role":"authenticated"}';
  select approve_member('${USERS.member.id}', 'member');
  select approve_member('${USERS.other.id}', 'member');
commit;

-- A minimal graph: BLOCK-01 must finish before GATED-01 can start.
insert into categories (key, name, color, position)
values ('platform', 'Platform & Infra', 'slate', 1),
       ('ml-pipeline', 'ML Signal Pipeline', 'violet', 2);

insert into tasks (key, category_id, title, priority)
select 'BLOCK-01', id, 'Provision the database', 'critical' from categories where key = 'platform';

insert into tasks (key, category_id, title, priority)
select 'GATED-01', id, 'Feature store scaffold', 'high' from categories where key = 'ml-pipeline';

insert into tasks (key, category_id, title, priority)
select 'FREE-01', id, 'Observability baseline', 'medium' from categories where key = 'platform';

insert into task_dependencies (task_id, depends_on_task_id)
select g.id, b.id from tasks g, tasks b where g.key = 'GATED-01' and b.key = 'BLOCK-01';

-- The member is assigned to all three; nobody else is assigned to anything.
insert into task_assignees (task_id, profile_id)
select id, '${USERS.member.id}' from tasks where key in ('BLOCK-01', 'GATED-01', 'FREE-01');
`);
}

export function taskId(key: string): string {
  return sql(`select id from tasks where key = '${key}'`);
}
