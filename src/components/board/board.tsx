'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';

import { BoardColumn } from '@/components/board/board-column';
import { FilterBar } from '@/components/list/filter-bar';
import { TaskCard } from '@/components/task/task-card';
import { TaskSheet } from '@/components/task/task-sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { moveTask } from '@/lib/actions/tasks';
import { applyFilters } from '@/lib/filters';
import { useTaskFilters } from '@/lib/use-task-filters';
import { useTaskRealtime } from '@/lib/realtime';
import { BOARD_COLUMNS, type Category, type Profile, type TaskCard as Task } from '@/types/app';

/**
 * Drag-to-change-status board (§7.2).
 *
 * On drop: move optimistically, call set_task_status, and on a Postgres error
 * snap back and surface the database's own message — "Task BT-01 is blocked
 * by: ML-01, PLT-01". Blocked cards are not draggable at all, so that error is
 * a backstop rather than the normal path.
 */
export function Board({
  tasks,
  categories,
  team,
  profile,
  edges,
}: {
  tasks: Task[];
  categories: Category[];
  team: Profile[];
  profile: Profile;
  edges: { from: string; to: string }[];
}) {
  useTaskRealtime();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters } = useTaskFilters();

  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [swimlanes, setSwimlanes] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const withOptimistic = useMemo(
    () =>
      tasks.map((t) =>
        optimistic[t.id] ? { ...t, status: optimistic[t.id] as Task['status'] } : t,
      ),
    [tasks, optimistic],
  );

  const visible = useMemo(
    () => applyFilters(withOptimistic, filters, profile.id),
    [withOptimistic, filters, profile.id],
  );

  const columns = showCancelled
    ? [...BOARD_COLUMNS, { status: 'cancelled' as const, label: 'Cancelled' }]
    : BOARD_COLUMNS;

  const openKey = searchParams.get('task');
  const openTask = openKey ? (tasks.find((t) => t.key === openKey) ?? null) : null;

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = withOptimistic.find((t) => t.id === taskId);
    if (!task) return;

    // Droppable ids are "column:<status>" or, in swimlanes,
    // "column:<status>:<category-key>". Dropping onto a card targets its column.
    const overId = String(over.id);
    const target = overId.startsWith('column:')
      ? overId.split(':')[1]!
      : (withOptimistic.find((t) => t.id === overId)?.status ?? null);

    if (!target || target === task.status) return;

    const previous = task.status;
    setOptimistic((o) => ({ ...o, [taskId]: target }));

    // Append to the end of the destination column.
    const lastPosition = Math.max(
      0,
      ...withOptimistic.filter((t) => t.status === target).map((t) => t.position),
    );

    startTransition(async () => {
      const res = await moveTask(taskId, target, lastPosition + 1000);

      if (res.error) {
        setOptimistic((o) => {
          const next = { ...o };
          delete next[taskId];
          return next;
        });
        toast.error(res.error, { duration: 6000 });
        return;
      }

      setOptimistic((o) => {
        const next = { ...o };
        delete next[taskId];
        return next;
      });
      router.refresh();
      if (previous !== target) toast.success(`${task.key} → ${labelOf(target)}`);
    });
  }

  const activeTask = draggingId ? withOptimistic.find((t) => t.id === draggingId) : null;

  const openSheet = (task: Task) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('task', task.key);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const closeSheet = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('task');
    const query = params.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  };

  return (
    <>
      <FilterBar
        categories={categories}
        team={team}
        resultCount={visible.length}
        totalCount={tasks.length}
      >
        <div className="flex items-center gap-2">
          <Switch id="swimlanes" checked={swimlanes} onCheckedChange={setSwimlanes} />
          <Label htmlFor="swimlanes" className="text-xs">
            Swimlanes
          </Label>
        </div>
        <Button
          variant={showCancelled ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          onClick={() => setShowCancelled((v) => !v)}
        >
          Cancelled
        </Button>
      </FilterBar>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        {swimlanes ? (
          <div className="space-y-8 p-6">
            {categories.map((category) => {
              const lane = visible.filter((t) => t.category_key === category.key);
              if (lane.length === 0) return null;
              return (
                <section key={category.id} className="space-y-3">
                  <h2 className="text-sm font-semibold">
                    {category.name}
                    <span className="text-muted-foreground ml-2 text-xs font-normal tabular-nums">
                      {lane.length}
                    </span>
                  </h2>
                  <Columns
                    columns={columns}
                    tasks={lane}
                    onOpen={openSheet}
                    laneId={category.key}
                    showCategory={false}
                  />
                </section>
              );
            })}
          </div>
        ) : (
          <div className="p-6">
            <Columns columns={columns} tasks={visible} onOpen={openSheet} />
          </div>
        )}

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} dragging className="w-72" /> : null}
        </DragOverlay>
      </DndContext>

      <TaskSheet
        task={openTask}
        allTasks={tasks}
        categories={categories}
        team={team}
        profile={profile}
        edges={edges}
        onClose={closeSheet}
      />
    </>
  );
}

function Columns({
  columns,
  tasks,
  onOpen,
  laneId,
  showCategory = true,
}: {
  columns: { status: string; label: string }[];
  tasks: Task[];
  onOpen: (task: Task) => void;
  laneId?: string;
  showCategory?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {columns.map((column) => (
        <BoardColumn
          key={column.status}
          // Droppable ids must be unique across every lane on the page.
          id={laneId ? `column:${column.status}:${laneId}` : `column:${column.status}`}
          status={column.status}
          label={column.label}
          tasks={tasks.filter((t) => t.status === column.status)}
          onOpen={onOpen}
          showCategory={showCategory}
        />
      ))}
    </div>
  );
}

function labelOf(status: string) {
  return (
    BOARD_COLUMNS.find((c) => c.status === status)?.label ??
    status.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}
