'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { CategoryDialog } from '@/components/admin/category-dialog';
import { CategoryIcon } from '@/components/shell/category-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteCategory, reorderCategories } from '@/lib/actions/categories';
import { colorOf } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/app';

export function CategoryManager({
  categories,
  taskCounts,
}: {
  categories: Category[];
  taskCounts: Record<string, number>;
}) {
  const [items, setItems] = useState(categories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setItems(categories), [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);

    const previous = items;
    setItems(next); // optimistic

    startTransition(async () => {
      const res = await reorderCategories(next.map((c) => c.id));
      if (res.error) {
        setItems(previous);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> New category
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No categories yet. Create one here, or define the whole set at once with a{' '}
          <a href="/admin/import" className="underline underline-offset-4">
            JSON import
          </a>
          .
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y rounded-lg border">
              {items.map((category) => (
                <SortableRow
                  key={category.id}
                  category={category}
                  taskCount={taskCounts[category.id] ?? 0}
                  onEdit={() => {
                    setEditing(category);
                    setDialogOpen(true);
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
    </div>
  );
}

function SortableRow({
  category,
  taskCount,
  onEdit,
}: {
  category: Category;
  taskCount: number;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const [pending, startTransition] = useTransition();
  const color = colorOf(category.color);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-background flex items-center gap-3 border-l-4 p-3',
        color.border,
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label={`Reorder ${category.name}`}
      >
        <GripVertical className="size-4" />
      </button>

      <span className={cn('flex size-8 items-center justify-center rounded-md', color.chip)}>
        <CategoryIcon name={category.icon} className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{category.name}</span>
          <code className="text-muted-foreground text-xs">{category.key}</code>
        </div>
        {category.description ? (
          <p className="text-muted-foreground truncate text-xs">{category.description}</p>
        ) : null}
      </div>

      <Badge variant="secondary" className="tabular-nums">
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </Badge>

      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
        <Pencil className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="Delete"
        onClick={() =>
          startTransition(async () => {
            const res = await deleteCategory(category.id);
            if (res.error) toast.error(res.error);
            else toast.success(`${category.name} deleted`);
          })
        }
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
