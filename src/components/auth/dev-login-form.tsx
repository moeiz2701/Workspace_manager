'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

/**
 * Local-only password sign-in (§8.4). Rendered only when devLoginEnabled(),
 * which requires the Supabase project to be on localhost.
 */
export function DevLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }

    router.push('/board');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-muted-foreground text-xs">
        Local development sign-in. Not available against a hosted Supabase project.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="dev-email">Email</Label>
        <Input
          id="dev-email"
          type="email"
          value={email}
          autoComplete="username"
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dev-password">Password</Label>
        <Input
          id="dev-password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Sign in with password
      </Button>
    </form>
  );
}
