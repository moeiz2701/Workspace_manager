import { expect, test } from '@playwright/test';

import { SUPABASE_URL, USERS, seedDatabase, sql } from './fixtures';
import { accessTokenFor, anonKey, signIn } from './helpers';

/** Critical path 1: a pending user sees nothing. */
test.describe('access gate', () => {
  test.beforeAll(() => seedDatabase());

  test('an unauthenticated visitor is sent to /login', async ({ page }) => {
    await page.goto('/board');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('a pending user is held on /pending and cannot reach any data screen', async ({ page }) => {
    await signIn(page, 'pending');
    await expect(page).toHaveURL(/\/pending/);
    await expect(page.getByText(/request is with the admin/i)).toBeVisible();

    for (const route of ['/board', '/tasks', '/graph', '/tracker', '/admin/people']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/pending/);
    }
  });

  test('a pending user reads no rows even calling PostgREST directly', async () => {
    const key = anonKey();
    const token = await accessTokenFor('pending', key);

    for (const table of ['tasks', 'categories', 'v_tasks', 'task_activity', 'task_dependencies']) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
      });
      const rows = (await response.json()) as unknown[];
      expect(rows, `${table} leaked rows to a pending user`).toEqual([]);
    }

    // Their own profile row stays readable — /pending needs it.
    const profiles = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,status`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    const rows = (await profiles.json()) as { id: string; status: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('pending');
  });

  test('an anonymous PostgREST read returns nothing', async () => {
    const key = anonKey();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    expect(await response.json()).toEqual([]);

    // The fixture really does have rows to leak.
    expect(sql('select count(*) from tasks')).toBe('3');
  });

  test('a non-admin is bounced off /admin/*', async ({ page }) => {
    await signIn(page, 'member');
    await page.goto('/admin/people');
    await expect(page).toHaveURL(/\/board/);
  });

  test('the admin sees the pending request in the queue', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/people');
    await expect(page.getByText(USERS.pending.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve', exact: true }).first()).toBeVisible();
  });
});
