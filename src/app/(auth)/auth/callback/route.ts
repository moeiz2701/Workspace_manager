import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * OAuth landing route. Exchanges the PKCE code for a session cookie, then hands
 * off to middleware, which decides between /pending and /board.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/board';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${siteUrl}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${siteUrl}${next.startsWith('/') ? next : '/board'}`);
}
