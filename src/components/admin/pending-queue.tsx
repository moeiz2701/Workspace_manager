'use client';

import { useTransition } from 'react';
import { Check, ShieldCheck, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonBadge } from '@/components/shell/person-badge';
import { approveMember, rejectMember } from '@/lib/actions/people';
import { useProfilesRealtime } from '@/lib/realtime';
import type { Profile } from '@/types/app';

export function PendingQueue({ pending }: { pending: Profile[] }) {
  // Live queue: a new sign-in appears without a refresh (§5.1).
  useProfilesRealtime();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Access requests
          {pending.length > 0 ? (
            <span className="bg-destructive rounded-full px-1.5 text-xs font-semibold text-white">
              {pending.length}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          A new Google sign-in creates a pending profile with zero data access until you approve it.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing waiting. New requests appear here live.
          </p>
        ) : (
          <ul className="divide-y">
            {pending.map((p) => (
              <PendingRow key={p.id} person={p} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PendingRow({ person }: { person: Profile }) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else toast.success(ok);
    });

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <PersonBadge person={person} size="md" />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{person.full_name ?? person.email}</div>
        <div className="text-muted-foreground truncate text-xs">
          {person.email} · requested {formatDistanceToNow(new Date(person.created_at))} ago
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => approveMember(person.id, 'member'), `${person.email} approved`)}
        >
          <Check className="size-4" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => approveMember(person.id, 'admin'), `${person.email} approved as admin`)
          }
        >
          <ShieldCheck className="size-4" /> As admin
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => rejectMember(person.id), `${person.email} declined`)}
        >
          <UserRoundX className="size-4" /> Reject
        </Button>
      </div>
    </li>
  );
}
