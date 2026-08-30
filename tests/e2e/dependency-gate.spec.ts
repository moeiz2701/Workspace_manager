import { expect, test } from '@playwright/test';

import { SUPABASE_URL, USERS, seedDatabase, sql, taskId } from './fixtures';
import { accessTokenFor, anonKey, signIn } from './helpers';

/**
 * Critical paths 2, 3 and 4:
 *   - a blocked task cannot be moved
 *   - completing its blocker makes it movable, and the move is audited
 *   - a member cannot move a task they are not assigned to, even via the API
 */
test.describe('dependency gate', () => {
  test.beforeEach(() => seedDatabase());

  test('a blocked card is not draggable and says what is blocking it', async ({ page }) => {
    await signIn(page, 'member');
    await page.goto('/board');

    const gated = page.locator('article').filter({ hasText: 'GATED-01' });
    await expect(gated).toBeVisible();

    // The lock chip names the blocker (§7).
    await expect(gated.getByText('BLOCK-01')).toBeVisible();

    // dnd-kit attaches its listeners to the wrapper; a locked card has none.
    const wrapper = page.locator('div:has(> article)').filter({ hasText: 'GATED-01' }).last();
    await expect(wrapper).not.toHaveAttribute('role', 'button');

    expect(sql("select status from tasks where key = 'GATED-01'")).toBe('todo');
  });

  test('the status control refuses a forward move while blocked', async ({ page }) => {
    await signIn(page, 'member');
    await page.goto('/tasks/GATED-01');

    await expect(page.getByText(/Blocked by BLOCK-01/i).first()).toBeVisible();

    await page.getByRole('combobox').first().click();
    const inProgress = page.getByRole('option', { name: /In Progress/ });
    await expect(inProgress).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');

    expect(sql("select status from tasks where key = 'GATED-01'")).toBe('todo');
  });

  test('the database refuses the move even when the UI is bypassed', async () => {
    const key = anonKey();
    const token = await accessTokenFor('member', key);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_task_status`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_task_id: taskId('GATED-01'), p_status: 'in_progress' }),
    });

    expect(response.ok).toBe(false);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('blocked by');
    expect(body.message).toContain('BLOCK-01');

    expect(sql("select status from tasks where key = 'GATED-01'")).toBe('todo');
  });

  test('completing the blocker unblocks it, and the change is audited', async ({ page }) => {
    await signIn(page, 'member');

    // Move BLOCK-01 all the way to done through the UI.
    await page.goto('/tasks/BLOCK-01');
    for (const status of ['In Progress', 'Done']) {
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: status, exact: true }).click();
      await expect(page.getByRole('combobox').first()).toContainText(status);
    }

    expect(sql("select status from tasks where key = 'BLOCK-01'")).toBe('done');

    // GATED-01 is now movable. (The "Blocked by" dependency panel is always
    // present — what must disappear is the warning next to the status control.)
    await page.goto('/tasks/GATED-01');
    await expect(page.getByText(/Blocked by BLOCK-01/i)).toHaveCount(0);

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'In Progress', exact: true }).click();
    await expect(page.getByRole('combobox').first()).toContainText('In Progress');

    expect(sql("select status from tasks where key = 'GATED-01'")).toBe('in_progress');

    // Every status change is in the audit trail with actor and timestamp.
    const audit = sql(`
      select count(*) from task_activity a
      join tasks t on t.id = a.task_id
      where t.key = 'GATED-01' and a.type = 'status_changed'
        and a.actor_id = '${USERS.member.id}' and a.created_at is not null
    `);
    expect(audit).toBe('1');

    await expect(page.getByText(/moved this from To Do → In Progress/i)).toBeVisible();

    // Finishing the blocker notified its dependents' assignees.
    const unblocked = sql(
      `select count(*) from notifications where type = 'task_unblocked' and recipient_id = '${USERS.member.id}'`,
    );
    expect(Number(unblocked)).toBeGreaterThan(0);
  });

  test('a member cannot move a task they are not assigned to', async () => {
    const key = anonKey();
    const token = await accessTokenFor('other', key);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_task_status`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_task_id: taskId('FREE-01'), p_status: 'in_progress' }),
    });

    expect(response.ok).toBe(false);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('not assigned');

    expect(sql("select status from tasks where key = 'FREE-01'")).toBe('todo');
  });

  test('a member cannot write to tasks directly', async () => {
    const key = anonKey();
    const token = await accessTokenFor('member', key);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks?key=eq.GATED-01`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: 'done' }),
    });

    // RLS gives them no UPDATE policy, so the filter matches nothing.
    expect(await response.json()).toEqual([]);
    expect(sql("select status from tasks where key = 'GATED-01'")).toBe('todo');
  });
});
