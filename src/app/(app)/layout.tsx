import { NotificationBell } from '@/components/notifications/notification-bell';
import { SidebarBrand, SidebarNav } from '@/components/shell/sidebar-nav';
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

  return (
    <div className="flex min-h-dvh">
      <KeyboardShortcuts isAdmin={isAdmin} />

      <aside className="bg-sidebar hidden w-56 shrink-0 flex-col gap-6 border-r p-3 md:flex">
        <SidebarBrand />
        <SidebarNav isAdmin={isAdmin} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <div className="md:hidden">
            <SidebarBrand />
          </div>
          <div className="flex-1" />
          <NotificationBell profileId={profile.id} unreadCount={unread} />
          <ThemeToggle />
          <UserMenu profile={profile} />
        </header>

        <main className="min-w-0 flex-1">{children}</main>

        <nav className="bg-background sticky bottom-0 z-30 border-t p-2 md:hidden">
          <SidebarNav isAdmin={isAdmin} />
        </nav>
      </div>
    </div>
  );
}
