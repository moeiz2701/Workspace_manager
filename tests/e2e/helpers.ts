import { expect, type Page } from '@playwright/test';

import { SUPABASE_URL, USERS } from './fixtures';

type UserKey = keyof typeof USERS;

/** Sign in through the §8.4 dev-login form on /login. */
export async function signIn(page: Page, who: UserKey) {
  const user = USERS[who];

  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in with password' }).click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

/**
 * A raw access token for a user, so a test can call PostgREST directly — the
 * hostile-client case the UI cannot cover.
 */
export async function accessTokenFor(who: UserKey, anonKey: string): Promise<string> {
  const user = USERS[who];

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  expect(response.ok, `sign-in for ${who} failed: ${await response.clone().text()}`).toBe(true);
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

export function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to run the e2e suite');
  return key;
}
