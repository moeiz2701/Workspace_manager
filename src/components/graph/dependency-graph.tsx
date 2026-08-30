'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import dagre from 'dagre';
import { Lock } from 'lucide-react';

import { TaskSheet } from '@/components/task/task-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { colorOf } from '@/lib/colors';
import { criticalPath } from '@/lib/graph';
import { useTaskRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import type { Category, Profile, TaskCard as Task } from '@/types/app';

import '@xyflow/react/dist/style.css';

const NODE_WIDTH = 210;
const NODE_HEIGHT = 62;

type TaskNodeData = {
  task: Task;
  onCritical: boolean;
};

/**
 * Dependency graph (§7.2). Edges point prerequisite → dependent, so the arrows
 * read as "this unlocks that". Node fill is the category colour, the border is
 * status, and a blocked node carries a lock — three separate channels again.
 */
export function DependencyGraph({
  tasks,
  categories,
  team,
  profile,
  edges: dependencyEdges,
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

  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [onlyCritical, setOnlyCritical] = useState(false);

  const critical = useMemo(() => criticalPath(tasks, dependencyEdges), [tasks, dependencyEdges]);

  const visibleTasks = useMemo(() => {
    let list = tasks.filter((t) => t.status !== 'cancelled');
    if (activeCategories.length > 0) {
      list = list.filter((t) => activeCategories.includes(t.category_key));
    }
    if (!showSubtasks) list = list.filter((t) => !t.parent_task_id);
    if (onlyCritical) list = list.filter((t) => critical.has(t.key));
    return list;
  }, [tasks, activeCategories, showSubtasks, onlyCritical, critical]);

  const { nodes, edges } = useMemo(() => {
    const present = new Set(visibleTasks.map((t) => t.key));

    const flowEdges: Edge[] = dependencyEdges
      .filter((e) => present.has(e.from) && present.has(e.to))
      .map((e) => ({
        // Prerequisite -> dependent.
        id: `${e.to}->${e.from}`,
        source: e.to,
        target: e.from,
        animated: critical.has(e.from) && critical.has(e.to),
        style: {
          strokeWidth: critical.has(e.from) && critical.has(e.to) ? 2 : 1,
        },
      }));

    const flowNodes: Node<TaskNodeData>[] = visibleTasks.map((task) => ({
      id: task.key,
      type: 'task',
      position: { x: 0, y: 0 },
      data: { task, onCritical: critical.has(task.key) },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));

    return layout(flowNodes, flowEdges);
  }, [visibleTasks, dependencyEdges, critical]);

  const openKey = searchParams.get('task');
  const openTask = openKey ? (tasks.find((t) => t.key === openKey) ?? null) : null;

  const setOpen = useCallback(
    (key: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (key) params.set('task', key);
      else params.delete('task');
      const query = params.toString();
      router.replace(query ? `?${query}` : '?', { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
        {categories.map((category) => {
          const active = activeCategories.includes(category.key);
          return (
            <Button
              key={category.id}
              variant={active ? 'default' : 'outline'}
              size="sm"
              className="h-7"
              onClick={() =>
                setActiveCategories((current) =>
                  current.includes(category.key)
                    ? current.filter((k) => k !== category.key)
                    : [...current, category.key],
                )
              }
            >
              <span className={cn('size-2 rounded-full', colorOf(category.color).dot)} />
              {category.name}
            </Button>
          );
        })}

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="subtasks" checked={showSubtasks} onCheckedChange={setShowSubtasks} />
            <Label htmlFor="subtasks" className="text-xs">
              Subtasks
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="critical" checked={onlyCritical} onCheckedChange={setOnlyCritical} />
            <Label htmlFor="critical" className="text-xs">
              Critical path
            </Label>
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {nodes.length} tasks · {edges.length} edges
          </Badge>
        </div>
      </div>

      <div className="h-[calc(100dvh-8.5rem)] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={{ task: TaskNode }}
          onNodeClick={(_, node) => setOpen(node.id)}
          fitView
          minZoom={0.15}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-muted hidden md:block" />
        </ReactFlow>
      </div>

      <TaskSheet
        task={openTask}
        allTasks={tasks}
        categories={categories}
        team={team}
        profile={profile}
        edges={dependencyEdges}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function TaskNode({ data }: NodeProps<Node<TaskNodeData>>) {
  const { task, onCritical } = data;
  const color = colorOf(task.category_color);
  const blocked = task.is_blocked && task.status === 'todo';

  return (
    <div
      className={cn(
        'flex h-[62px] w-[210px] flex-col justify-center gap-0.5 rounded-md border-2 px-2.5 py-1.5 shadow-sm',
        color.chip,
        STATUS_BORDER[task.status],
        blocked && 'border-dashed opacity-80',
        onCritical && 'ring-foreground/40 ring-2 ring-offset-1',
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-current" />

      <div className="flex items-center gap-1">
        {blocked ? <Lock className="size-3 shrink-0" /> : null}
        <code className="text-[9px] font-bold tracking-wide">{task.key}</code>
      </div>
      <p className="line-clamp-2 text-[11px] leading-tight font-medium">{task.title}</p>

      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-current" />
    </div>
  );
}

const STATUS_BORDER: Record<Task['status'], string> = {
  todo: 'border-slate-400 dark:border-slate-600',
  in_progress: 'border-blue-500',
  in_review: 'border-violet-500',
  done: 'border-emerald-500',
  cancelled: 'border-slate-300 dark:border-slate-700',
};

/** dagre left-to-right auto-layout. */
function layout(nodes: Node<TaskNodeData>[], edges: Edge[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 90, marginx: 20, marginy: 20 });

  for (const node of nodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);

  dagre.layout(graph);

  return {
    nodes: nodes.map((node) => {
      const positioned = graph.node(node.id);
      return {
        ...node,
        position: {
          x: (positioned?.x ?? 0) - NODE_WIDTH / 2,
          y: (positioned?.y ?? 0) - NODE_HEIGHT / 2,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    }),
    edges,
  };
}
