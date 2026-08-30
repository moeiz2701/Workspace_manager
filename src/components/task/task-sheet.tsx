'use client';

import Link from 'next/link';
import { Maximize2 } from 'lucide-react';

import { TaskDetail } from '@/components/task/task-detail';
import { TaskThread } from '@/components/task/task-thread';
import { displayNames } from '@/lib/display-names';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Category, Profile, TaskCard as Task } from '@/types/app';

/**
 * The side sheet the board and the list open on row/card click. `/tasks/[key]`
 * renders the very same TaskDetail full-page (§7.2).
 */
export function TaskSheet({
  task,
  allTasks,
  categories,
  team,
  profile,
  edges,
  onClose,
}: {
  task: Task | null;
  allTasks: Task[];
  categories: Category[];
  team: Profile[];
  profile: Profile;
  edges: { from: string; to: string }[];
  onClose: () => void;
}) {
  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {task ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>Task {task.key}</SheetDescription>
            </SheetHeader>

            <div className="flex justify-end px-6 pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/tasks/${task.key}`}>
                  <Maximize2 className="size-3.5" /> Open full page
                </Link>
              </Button>
            </div>

            <div className="px-6 pb-8">
              <TaskDetail
                task={task}
                allTasks={allTasks}
                categories={categories}
                team={team}
                profile={profile}
                edges={edges}
                comments={
                  <TaskThread
                    key={task.id}
                    taskId={task.id}
                    team={team}
                    profile={profile}
                    names={displayNames(team, categories, allTasks)}
                  />
                }
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
