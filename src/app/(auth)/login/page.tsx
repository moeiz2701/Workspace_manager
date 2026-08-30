import type { Metadata } from 'next';

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
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Entropable Workspace</h1>
          <p className="text-muted-foreground text-sm">
            The implementation tracker for the Entropable build. Sign in with Google; an admin
            approves new accounts before they can see anything.
          </p>
        </div>

        {error ? (
          <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {error === 'auth' ? 'Sign-in failed. Please try again.' : error}
          </p>
        ) : null}

        <GoogleSignInButton />

        {devLoginEnabled() ? <DevLoginForm /> : null}
      </div>
    </main>
  );
}
