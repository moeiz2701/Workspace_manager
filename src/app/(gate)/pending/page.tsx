import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PendingWatcher } from '@/components/auth/pending-watcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/actions/auth';
import { colorOf, initialsOf } from '@/lib/colors';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Awaiting approval · Entropable Workspace' };

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // "own profile always readable" — a pending user can read exactly this row.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, color, status')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.status === 'approved') redirect('/board');

  const rejected = profile?.status === 'rejected' || profile?.status === 'suspended';
  const color = colorOf(profile?.color);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <PendingWatcher profileId={user.id} />

      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <Avatar className="size-16">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className={color.badge}>
              {initialsOf(profile?.full_name, profile?.email ?? user.email)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {profile?.full_name ?? user.email}
          </h1>
          {rejected ? (
            <p className="text-muted-foreground text-sm">
              Your access request was declined. Talk to the workspace admin if you think that is a
              mistake.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">Your request is with the admin.</p>
              <p className="text-muted-foreground text-sm">
                This page updates itself — you will be let straight in the moment you are approved,
                no refresh needed.
              </p>
            </>
          )}
        </div>

        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
