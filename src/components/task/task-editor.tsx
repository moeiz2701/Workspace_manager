'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { updateTask } from '@/lib/actions/tasks';
import {
  PRIORITY_LABELS,
  type Category,
  type TaskCard as Task,
  type TaskPriority,
} from '@/types/app';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
const NO_PARENT = '__none__';

/** Admin-only inline editing of every field (§7.2). RLS refuses it for members. */
export function TaskEditor({
  task,
  categories,
  allTasks,
}: {
  task: Task;
  categories: Category[];
  allTasks: Task[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [note, setNote] = useState(task.note ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [categoryId, setCategoryId] = useState(task.category_id);
  const [parentId, setParentId] = useState(task.parent_task_id ?? NO_PARENT);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setNote(task.note ?? '');
    setPriority(task.priority);
    setCategoryId(task.category_id);
    setParentId(task.parent_task_id ?? NO_PARENT);
  }, [task]);

  function save() {
    startTransition(async () => {
      const res = await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        note: note.trim() || null,
        priority,
        category_id: categoryId,
        parent_task_id: parentId === NO_PARENT ? null : parentId,
      });

      if (res.error) toast.error(res.error, { duration: 6000 });
      else {
        toast.success('Task updated');
        router.refresh();
      }
    });
  }

  // A task cannot be its own ancestor; the database rejects it too.
  const parentOptions = allTasks.filter((t) => t.id !== task.id && t.parent_task_id !== task.id);

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Pencil className="size-3.5" /> Edit task
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 border-t p-4">
        <div className="space-y-1.5">
          <Label htmlFor="t-title">Title</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="t-desc">Description</Label>
          <Textarea
            id="t-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="t-note">Note to assignees</Label>
          <Textarea
            id="t-note"
            rows={2}
            value={note}
            placeholder="Shown in a callout at the top of the task."
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Parent task</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_PARENT}>No parent</SelectItem>
                {parentOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.key} — {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={save} disabled={pending || !title.trim()} size="sm">
          Save changes
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
