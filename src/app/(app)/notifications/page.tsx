import type { Metadata } from 'next';

import { NotificationList } from '@/components/notifications/notification-list';
import { PageHeader } from '@/components/shell/page-header';
import { getNotifications, requireApprovedProfile } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notifications · Entropable Workspace' };

export default async function NotificationsPage() {
  const profile = await requireApprovedProfile();
  const notifications = await getNotifications();

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Assignments, mentions, comments and unblocks."
      />
      <div className="p-6">
        <NotificationList profileId={profile.id} notifications={notifications} />
      </div>
    </>
  );
}
