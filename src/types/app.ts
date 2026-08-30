/**
 * Domain types used across the app.
 *
 * These are hand-written and intentionally narrow: they describe the shape of
 * the columns each screen actually selects, not the whole table. `database.ts`
 * (generated) stays the source of truth for the schema itself.
 */

import type { ColorToken } from '@/lib/colors';

export type UserRole = 'admin' | 'member';
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type ActivityType =
  | 'created'
  | 'status_changed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'dependency_added'
  | 'dependency_removed'
  | 'note_updated'
  | 'category_changed'
  | 'priority_changed'
  | 'parent_changed'
  | 'imported';

export type NotificationType =
  | 'access_request'
  | 'access_approved'
  | 'access_rejected'
  | 'task_assigned'
  | 'task_unassigned'
  | 'mention'
  | 'comment'
  | 'status_changed'
  | 'task_unblocked';

/** Board columns, in order (§7.2). `cancelled` is hidden behind a toggle. */
export const BOARD_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: ProfileStatus;
  color: ColorToken;
  title: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export type Category = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: ColorToken;
  icon: string | null;
  position: number;
  created_at: string;
};

/** A row of `v_tasks` (§3.6) — task plus its derived state. */
export type TaskView = {
  id: string;
  key: string;
  category_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  note: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  start_date: string | null;
  due_date: string | null;
  estimate_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category_key: string;
  category_name: string;
  category_color: ColorToken;
  dep_count: number;
  unmet_count: number;
  blocked_by_keys: string[];
  is_blocked: boolean;
  child_count: number;
  child_done_count: number;
  blocks_count: number;
  parent_key: string | null;
};

/** A task as the board and list render it: view row + assignees resolved. */
export type TaskCard = TaskView & {
  assignees: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'color'>[];
};

export type Notification = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type CategoryProgress = {
  category_id: string;
  key: string;
  name: string;
  color: ColorToken;
  position: number;
  total: number;
  done: number;
  in_flight: number;
  todo: number;
  pct: number | null;
};

export type ProjectProgress = {
  total: number;
  done: number;
  in_flight: number;
  todo: number;
  pct: number | null;
};

export type PersonProgress = {
  profile_id: string;
  full_name: string | null;
  email: string;
  color: ColorToken;
  title: string | null;
  total: number;
  done: number;
  in_flight: number;
  todo: number;
};
