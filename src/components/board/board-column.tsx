'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { TaskCard } from '@/components/task/task-card';
import { StatusIcon } from '@/components/task/task-signals';
import { cn } from '@/lib/utils';
import type { TaskCard as Task, TaskStatus } from '@/types/app';

export function BoardColumn({
  id,
  status,
  label,
  tasks,
  onOpen,
  showCategory,
}: {
  id: string;
  status: string;
  label: string;
  tasks: Task[];
  onOpen: (task: Task) => void;
  showCategory?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'bg-muted/40 flex min-h-40 flex-col gap-2 rounded-lg border p-2 transition-colors',
        isOver && 'border-foreground/40 bg-accent/60',
      )}
    >
      <header className="flex items-center gap-2 px-1 py-0.5">
        <StatusIcon status={status as TaskStatus} className="text-muted-foreground" />
        <h3 className="text-xs font-semibold tracking-wide uppercase">{label}</h3>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">{tasks.length}</span>
      </header>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            showCategory={showCategory}
          />
        ))}

        {tasks.length === 0 ? (
          <p className="text-muted-foreground/70 px-1 py-6 text-center text-xs">Nothing here</p>
        ) : null}
      </div>
    </section>
  );
}

function DraggableCard({
  task,
  onOpen,
  showCategory,
}: {
  task: Task;
  onOpen: () => void;
  showCategory?: boolean;
}) {
  // A blocked task cannot legally move, so it does not become draggable at all.
  // The lock chip on the card lists what is blocking it.
  const locked = task.is_blocked && task.status === 'todo';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: locked,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && 'opacity-40', !locked && 'cursor-grab active:cursor-grabbing')}
      {...(locked ? {} : listeners)}
      {...(locked ? {} : attributes)}
    >
      <TaskCard task={task} onOpen={onOpen} showCategory={showCategory} />
    </div>
  );
}
