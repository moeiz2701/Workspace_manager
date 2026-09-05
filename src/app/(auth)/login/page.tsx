import type { Metadata } from 'next';
import { FolderKanban } from 'lucide-react';

import { DevLoginForm } from '@/components/auth/dev-login-form';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { devLoginEnabled } from '@/lib/dev-login';

export const metadata: Metadata = { title: 'Sign in · Entropable Workspace' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      {/* One soft accent wash behind the card so the sign-in screen is not a
          bare form on flat white. */}
      <div
        aria-hidden
        className="from-primary/12 pointer-events-none absolute inset-x-0 -top-40 h-96 bg-gradient-to-b via-transparent to-transparent blur-3xl"
      />

      <div className="relative w-full max-w-sm space-y-7">
        <div className="space-y-4">
          <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow-md">
            <FolderKanban className="size-5.5" />
          </span>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Entropable Workspace</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The implementation tracker for the Entropable build. Sign in with Google; an admin
              approves new accounts before they can see anything.
            </p>
          </div>
        </div>

        {error ? (
          <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm font-medium">
            {error === 'auth' ? 'Sign-in failed. Please try again.' : error}
          </p>
        ) : null}

        <div className="bg-card space-y-5 rounded-xl border p-5 shadow-sm">
          <GoogleSignInButton />
          {devLoginEnabled() ? <DevLoginForm /> : null}
        </div>
      </div>
    </main>
  );
}
