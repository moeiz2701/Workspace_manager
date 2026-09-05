import { cookies } from 'next/headers';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { AppShell, SIDEBAR_COOKIE } from '@/components/shell/app-shell';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { UserMenu } from '@/components/shell/user-menu';
import { KeyboardShortcuts } from '@/components/shell/keyboard-shortcuts';
import { getUnreadNotificationCount, requireApprovedProfile } from '@/lib/queries';

// Authenticated pages are per-user; nothing may be cached across users (§8.2).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireApprovedProfile();
  const unread = await getUnreadNotificationCount();
  const isAdmin = profile.role === 'admin';

  // Read on the server so the rail paints at its final width — see AppShell.
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1';

  return (
    <>
      <KeyboardShortcuts isAdmin={isAdmin} />

      <AppShell
        isAdmin={isAdmin}
        defaultCollapsed={collapsed}
        headerActions={
          <>
            <NotificationBell profileId={profile.id} unreadCount={unread} />
            <ThemeToggle />
            <UserMenu profile={profile} />
          </>
        }
      >
        {children}
      </AppShell>
    </>
  );
}
