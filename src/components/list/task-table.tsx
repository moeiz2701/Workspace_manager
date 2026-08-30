'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { FilterBar } from '@/components/list/filter-bar';
import { PersonBadgeStack } from '@/components/shell/person-badge';
import { TaskSheet } from '@/components/task/task-sheet';
import {
  BlockedChip,
  CategoryChip,
  PriorityMark,
  StatusIcon,
} from '@/components/task/task-signals';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { applyFilters } from '@/lib/filters';
import { useTaskRealtime } from '@/lib/realtime';
import { useTaskFilters } from '@/lib/use-task-filters';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, type Category, type Profile, type TaskCard as Task } from '@/types/app';

type Row = Task & { depth: number; hasChildren: boolean };

/**
 * Filterable task list (§7.2). Tree structure is preserved by flattening
 * parents and children into ordered rows with a depth, so sorting a column
 * still reads as a list while the default order reads as a tree.
 */
export function TaskTable({
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

  const [sorting, setSorting] = useState<SortingState>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => applyFilters(tasks, filters, profile.id),
    [tasks, filters, profile.id],
  );

  const rows = useMemo(
    () => flattenTree(visible, collapsed, sorting.length > 0),
    [visible, collapsed, sorting.length],
  );

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Key',
        cell: ({ row }) => (
          <code className="text-xs font-semibold whitespace-nowrap">{row.original.key}</code>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <div
            className="flex min-w-0 items-center gap-1.5"
            style={{ paddingLeft: `${row.original.depth * 18}px` }}
          >
            {row.original.hasChildren ? (
              <button
                type="button"
                aria-label="Toggle subtasks"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(row.original.id);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {collapsed.has(row.original.id) ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            <StatusIcon
              status={row.original.status}
              isBlocked={row.original.is_blocked}
              className="text-muted-foreground"
            />
            <span className="truncate">{row.original.title}</span>
            {row.original.child_count > 0 ? (
              <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                {row.original.child_done_count}/{row.original.child_count}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'category_name',
        header: 'Category',
        cell: ({ row }) => (
          <CategoryChip name={row.original.category_name} color={row.original.category_color} />
        ),
      },
      {
        id: 'assignees',
        header: 'Assignees',
        cell: ({ row }) => <PersonBadgeStack people={row.original.assignees} size="xs" />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">{STATUS_LABELS[row.original.status]}</span>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        sortingFn: (a, b) => priorityRank(a.original.priority) - priorityRank(b.original.priority),
        cell: ({ row }) => <PriorityMark priority={row.original.priority} />,
      },
      {
        id: 'blocked_by',
        header: 'Blocked by',
        cell: ({ row }) =>
          row.original.is_blocked ? (
            <BlockedChip blockers={row.original.blocked_by_keys} />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {formatDistanceToNow(new Date(row.original.updated_at))} ago
          </span>
        ),
      },
    ],
    [collapsed],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const openKey = searchParams.get('task');
  const openTask = openKey ? (tasks.find((t) => t.key === openKey) ?? null) : null;

  const setOpen = (key: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key) params.set('task', key);
    else params.delete('task');
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
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-7 px-2"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          <ChevronsUpDown
                            className={cn(
                              'size-3',
                              header.column.getIsSorted()
                                ? 'text-foreground'
                                : 'text-muted-foreground/50',
                            )}
                          />
                        ) : null}
                      </Button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => setOpen(row.original.key)}
                className={cn(
                  'cursor-pointer',
                  row.original.is_blocked && row.original.status === 'todo' && 'opacity-70',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  No tasks match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <TaskSheet
        task={openTask}
        allTasks={tasks}
        categories={categories}
        team={team}
        profile={profile}
        edges={edges}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function priorityRank(priority: Task['priority']) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

/**
 * Depth-first flatten so children follow their parent. A child whose parent is
 * filtered out is promoted to the top level rather than disappearing.
 * Sorting a column flattens the tree entirely — a sorted tree is a lie.
 */
function flattenTree(tasks: Task[], collapsed: Set<string>, flat: boolean): Row[] {
  if (flat) return tasks.map((task) => ({ ...task, depth: 0, hasChildren: false }));

  const byParent = new Map<string | null, Task[]>();
  const present = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    const parent =
      task.parent_task_id && present.has(task.parent_task_id) ? task.parent_task_id : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), task]);
  }

  const rows: Row[] = [];

  const walk = (parent: string | null, depth: number) => {
    for (const task of byParent.get(parent) ?? []) {
      const children = byParent.get(task.id) ?? [];
      rows.push({ ...task, depth, hasChildren: children.length > 0 });
      if (children.length > 0 && !collapsed.has(task.id)) walk(task.id, depth + 1);
    }
  };

  walk(null, 0);
  return rows;
}
