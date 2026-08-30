'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useNotificationRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';

/**
 * Unread count is server-rendered; Realtime only nudges the router to re-read
 * it through RLS (§2, rule 5).
 */
export function NotificationBell({
  profileId,
  unreadCount,
}: {
  profileId: string;
  unreadCount: number;
}) {
  useNotificationRealtime(profileId, (title) => toast(title));

  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label="Notifications">
      <Link href="/notifications">
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span
            className={cn(
              'bg-destructive absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white',
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
