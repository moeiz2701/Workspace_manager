'use client';

import { useMemo, useTransition } from 'react';
import Link from 'next/link';
import { isToday } from 'date-fns';
import {
  AtSign,
  BellOff,
  CheckCheck,
  CircleCheck,
  LockOpen,
  MessageSquare,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import { useNotificationRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/app';

const ICONS: Record<NotificationType, typeof AtSign> = {
  access_request: UserPlus,
  access_approved: ShieldCheck,
  access_rejected: ShieldCheck,
  task_assigned: UserPlus,
  task_unassigned: UserPlus,
  mention: AtSign,
  comment: MessageSquare,
  status_changed: CircleCheck,
  task_unblocked: LockOpen,
};

function hrefFor(n: Notification) {
  if (n.entity_type === 'task' && n.entity_id) return `/tasks?open=${n.entity_id}`;
  if (n.entity_type === 'profile') return '/admin/people';
  return '/notifications';
}

export function NotificationList({
  profileId,
  notifications,
}: {
  profileId: string;
  notifications: Notification[];
}) {
  useNotificationRealtime(profileId);
  const [, startTransition] = useTransition();

  const { today, earlier } = useMemo(() => {
    const t: Notification[] = [];
    const e: Notification[] = [];
    for (const n of notifications) {
      (isToday(new Date(n.created_at)) ? t : e).push(n);
    }
    return { today: t, earlier: e };
  }, [notifications]);

  const unread = notifications.filter((n) => !n.read_at).length;

  if (notifications.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
        <BellOff className="size-8" />
        <p className="text-sm">Nothing yet. Assignments, mentions and unblocks land here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </p>
        {unread > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              startTransition(async () => {
                const res = await markAllNotificationsRead();
                if (res.error) toast.error(res.error);
              })
            }
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        ) : null}
      </div>

      {today.length > 0 ? <Group label="Today" items={today} /> : null}
      {earlier.length > 0 ? <Group label="Earlier" items={earlier} /> : null}
    </div>
  );
}

function Group({ label, items }: { label: string; items: Notification[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-eyebrow">{label}</h2>
      <ul className="divide-y rounded-lg border">
        {items.map((n) => (
          <Row key={n.id} n={n} />
        ))}
      </ul>
    </section>
  );
}

function Row({ n }: { n: Notification }) {
  const [, startTransition] = useTransition();
  const Icon = ICONS[n.type] ?? MessageSquare;

  return (
    <li className={cn('flex items-start gap-3 p-3', !n.read_at && 'bg-accent/40')}>
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <Link
        href={hrefFor(n)}
        className="min-w-0 flex-1"
        onClick={() => {
          if (!n.read_at) startTransition(() => void markNotificationRead(n.id));
        }}
      >
        <div className="truncate text-sm font-medium">{n.title}</div>
        {n.body ? <div className="text-muted-foreground truncate text-xs">{n.body}</div> : null}
        <div className="text-muted-foreground mt-0.5 text-xs">
          {new Date(n.created_at).toLocaleString()}
        </div>
      </Link>
      {!n.read_at ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => startTransition(() => void markNotificationRead(n.id))}
        >
          Mark read
        </Button>
      ) : null}
    </li>
  );
}
