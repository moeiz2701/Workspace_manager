'use client';

import { useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Info, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { PersonBadge } from '@/components/shell/person-badge';
import { StatusControl } from '@/components/task/status-control';
import { CategoryChip, PriorityMark, StatusIcon } from '@/components/task/task-signals';
import { TaskEditor } from '@/components/task/task-editor';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addAssignee, addDependency, removeAssignee, removeDependency } from '@/lib/actions/tasks';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, type Category, type Profile, type TaskCard as Task } from '@/types/app';

/**
 * Task detail (§7.2), shared by the /tasks/[key] page and the side sheet.
 *
 * The admin note gets a callout of its own at the top: it is the message the
 * admin wrote for the assignees, so it must be impossible to miss.
 */
export function TaskDetail({
  task,
  allTasks,
  categories,
  team,
  profile,
  edges,
  comments,
  activity,
}: {
  task: Task;
  allTasks: Task[];
  categories: Category[];
  team: Profile[];
  profile: Profile;
  /** Every dependency edge as task keys: `from` depends on `to`. */
  edges: { from: string; to: string }[];
  comments?: React.ReactNode;
  activity?: React.ReactNode;
}) {
  const isAdmin = profile.role === 'admin';
  const isAssigned = task.assignees.some((a) => a.id === profile.id);
  const canChangeStatus = isAdmin || isAssigned;

  const byKey = useMemo(() => new Map(allTasks.map((t) => [t.key, t])), [allTasks]);

  // `blocked_by_keys` lists only UNMET dependencies, so the full "blocked by"
  // and "blocks" lists come from the edge list rather than from the view.
  const dependsOn = useMemo(() => {
    const keys = new Set(edges.filter((e) => e.from === task.key).map((e) => e.to));
    return allTasks.filter((t) => keys.has(t.key));
  }, [allTasks, edges, task.key]);

  const blocks = useMemo(() => {
    const keys = new Set(edges.filter((e) => e.to === task.key).map((e) => e.from));
    return allTasks.filter((t) => keys.has(t.key));
  }, [allTasks, edges, task.key]);

  const children = useMemo(
    () => allTasks.filter((t) => t.parent_task_id === task.id),
    [allTasks, task.id],
  );

  const parent = task.parent_key ? byKey.get(task.parent_key) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-muted-foreground text-xs font-semibold">{task.key}</code>
          <CategoryChip name={task.category_name} color={task.category_color} />
          <PriorityMark priority={task.priority} />
          {parent ? (
            <Link
              href={`/tasks/${parent.key}`}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
            >
              ⤷ in {parent.key}
            </Link>
          ) : null}
        </div>

        <h1 className="text-xl leading-tight font-semibold">{task.title}</h1>

        <StatusControl task={task} canEdit={canChangeStatus} />
      </header>

      {task.note ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-amber-600" />
            Note from admin
          </h2>
          <p className="mt-2 text-sm whitespace-pre-wrap">{task.note}</p>
        </section>
      ) : null}

      {task.description ? (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Description
          </h2>
          <p className="text-sm whitespace-pre-wrap">{task.description}</p>
        </section>
      ) : null}

      <Assignees task={task} team={team} isAdmin={isAdmin} />

      <div className="grid gap-6 sm:grid-cols-2">
        <DependencyPanel
          title="Blocked by"
          description="This task cannot start until every one of these is done."
          tasks={dependsOn}
          highlight={task.blocked_by_keys}
          onRemove={isAdmin ? (dep) => removeDependency(task.id, dep.id) : undefined}
          onAdd={
            isAdmin
              ? {
                  label: 'Add dependency',
                  options: allTasks.filter(
                    (t) => t.id !== task.id && !dependsOn.some((d) => d.id === t.id),
                  ),
                  run: (dep) => addDependency(task.id, dep.id),
                }
              : undefined
          }
        />

        <DependencyPanel
          title="Blocks"
          description="These cannot start until this one is done."
          tasks={blocks}
        />
      </div>

      {children.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Subtasks · {task.child_done_count}/{task.child_count} done
          </h2>
          <ul className="divide-y rounded-lg border">
            {children.map((child) => (
              <TaskRow key={child.id} task={child} />
            ))}
          </ul>
        </section>
      ) : null}

      {isAdmin ? <TaskEditor task={task} categories={categories} allTasks={allTasks} /> : null}

      {comments}
      {activity}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const blocked = task.is_blocked && task.status === 'todo';
  return (
    <li className="flex items-center gap-2 p-2.5 text-sm">
      <StatusIcon
        status={task.status}
        isBlocked={task.is_blocked}
        className="text-muted-foreground"
      />
      <Link
        href={`/tasks/${task.key}`}
        className={cn('min-w-0 flex-1 truncate hover:underline', blocked && 'opacity-70')}
      >
        <code className="text-muted-foreground mr-2 text-[10px] font-semibold">{task.key}</code>
        {task.title}
      </Link>
      <span className="text-muted-foreground shrink-0 text-xs">{STATUS_LABELS[task.status]}</span>
      <PersonBadgeStackInline people={task.assignees} />
    </li>
  );
}

function PersonBadgeStackInline({ people }: { people: Task['assignees'] }) {
  if (people.length === 0) return null;
  return (
    <span className="flex -space-x-1">
      {people.slice(0, 3).map((p) => (
        <PersonBadge key={p.id} person={p} size="xs" />
      ))}
    </span>
  );
}

function Assignees({ task, team, isAdmin }: { task: Task; team: Profile[]; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else router.refresh();
    });

  const available = team.filter((p) => !task.assignees.some((a) => a.id === p.id));

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        Assignees
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {task.assignees.length === 0 ? (
          <span className="text-muted-foreground text-sm">Nobody assigned</span>
        ) : null}

        {task.assignees.map((person) => (
          <span
            key={person.id}
            className="bg-muted flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-0.5 text-sm"
          >
            <PersonBadge person={person} size="sm" />
            <span className="max-w-32 truncate">{person.full_name ?? person.email}</span>
            {isAdmin ? (
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${person.full_name ?? person.email}`}
                onClick={() => run(() => removeAssignee(task.id, person.id))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </span>
        ))}

        {isAdmin && available.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7">
                <Plus className="size-3.5" /> Assign
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <Command>
                <CommandInput placeholder="Find someone…" />
                <CommandList>
                  <CommandEmpty>Nobody left to assign.</CommandEmpty>
                  <CommandGroup>
                    {available.map((person) => (
                      <CommandItem
                        key={person.id}
                        value={`${person.full_name ?? ''} ${person.email}`}
                        onSelect={() => run(() => addAssignee(task.id, person.id))}
                      >
                        <PersonBadge person={person} size="xs" />
                        <span className="truncate">{person.full_name ?? person.email}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </section>
  );
}

function DependencyPanel({
  title,
  description,
  tasks,
  highlight = [],
  onRemove,
  onAdd,
}: {
  title: string;
  description: string;
  tasks: Task[];
  highlight?: string[];
  onRemove?: (task: Task) => Promise<{ error: string | null }>;
  onAdd?: {
    label: string;
    options: Task[];
    run: (task: Task) => Promise<{ error: string | null }>;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error: string | null }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error, { duration: 6000 });
      else router.refresh();
    });

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {title}
      </h2>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground text-sm">None.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tasks.map((dep) => (
            <li key={dep.id} className="flex items-center gap-2 p-2 text-sm">
              <StatusIcon
                status={dep.status}
                isBlocked={dep.is_blocked}
                className={cn(
                  'text-muted-foreground',
                  highlight.includes(dep.key) && 'text-amber-600',
                )}
              />
              <Link href={`/tasks/${dep.key}`} className="min-w-0 flex-1 truncate hover:underline">
                <code className="text-muted-foreground mr-2 text-[10px] font-semibold">
                  {dep.key}
                </code>
                {dep.title}
              </Link>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                  dep.status === 'done'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {STATUS_LABELS[dep.status]}
              </span>
              {onRemove ? (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove dependency ${dep.key}`}
                  onClick={() => run(() => onRemove(dep))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-xs">{description}</p>

      {onAdd ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7">
              <Plus className="size-3.5" /> {onAdd.label}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Find a task…" />
              <CommandList>
                <CommandEmpty>No matching task.</CommandEmpty>
                <CommandGroup>
                  {onAdd.options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={`${option.key} ${option.title}`}
                      onSelect={() => run(() => onAdd.run(option))}
                    >
                      <code className="text-muted-foreground text-[10px] font-semibold">
                        {option.key}
                      </code>
                      <span className="truncate">{option.title}</span>
                      <ArrowUpRight className="text-muted-foreground ml-auto size-3" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : null}
    </section>
  );
}
