/**
 * Google OAuth does not work against a local Supabase without a tunnel, so
 * §8.4 allows a password sign-in behind a flag for local work and e2e tests.
 *
 * Two conditions must BOTH hold, so this cannot be switched on in production
 * by setting one environment variable:
 *   1. NEXT_PUBLIC_DEV_LOGIN === 'true'
 *   2. the Supabase project is on localhost
 *
 * A deployed app points at a hosted Supabase, so condition 2 can never be true
 * there.
 */
export function devLoginEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== 'true') return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}
