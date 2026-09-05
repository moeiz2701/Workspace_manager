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
        'bg-muted/50 flex min-h-40 flex-col gap-2.5 rounded-xl border p-2.5 transition-colors',
        isOver && 'border-primary/50 bg-accent/70 ring-primary/20 ring-2',
      )}
    >
      <header className="flex items-center gap-2 px-1 pt-0.5 pb-1">
        <StatusIcon status={status as TaskStatus} className="text-muted-foreground" />
        <h3 className="text-eyebrow text-foreground">{label}</h3>
        <span className="bg-background text-muted-foreground ml-auto rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
          {tasks.length}
        </span>
      </header>

      <div className="flex flex-col gap-2.5">
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            showCategory={showCategory}
          />
        ))}

        {tasks.length === 0 ? (
          <p className="text-muted-foreground/80 px-1 py-8 text-center text-xs">Nothing here</p>
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
