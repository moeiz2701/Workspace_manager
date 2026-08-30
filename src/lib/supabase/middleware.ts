import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/types/database';

/** Routes reachable without a session. */
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/auth-code-error'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and enforces the gate:
 *
 *   no session          -> /login
 *   session + pending   -> /pending
 *   session + approved  -> through
 *   non-admin -> /admin/* -> /board
 *
 * The redirects here are convenience, not security: RLS is what actually stops
 * a pending user from reading anything (§2, rule 1).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this is what refreshes the auth token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = '';
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) {
    if (isPublic(pathname)) return response;
    return redirect('/login');
  }

  // Signed in. Read the gate state from the profile.
  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .maybeSingle();

  const status = profile?.status ?? 'pending';
  const isAdmin = profile?.role === 'admin' && status === 'approved';

  if (status !== 'approved') {
    if (pathname === '/pending') return response;
    return redirect('/pending');
  }

  // Approved users have no business on /login or /pending.
  if (pathname === '/login' || pathname === '/pending') return redirect('/board');

  if (pathname.startsWith('/admin') && !isAdmin) return redirect('/board');

  if (pathname === '/') return redirect('/board');

  return response;
}
