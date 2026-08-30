'use client';

import { useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileJson,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { dryRunImport, runImport, type DryRunResult } from '@/lib/actions/import';
import { cn } from '@/lib/utils';

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, startChecking] = useTransition();
  const [importing, startImporting] = useTransition();

  function accept(file: File) {
    setFilename(file.name);
    setResult(null);

    void file.text().then((text) => {
      setFileText(text);
      startChecking(async () => setResult(await dryRunImport(text)));
    });
  }

  function confirm() {
    if (!fileText) return;
    startImporting(async () => {
      const res = await runImport(fileText, filename);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const s = res.summary as Record<string, number> | null;
      toast.success(
        s ? `Imported: ${s.tasks_created} new, ${s.tasks_updated} updated` : 'Import complete',
      );
      setResult(null);
      setFileText(null);
      setFilename(null);
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  const plan = result?.plan;
  const errors = plan?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = plan?.issues.filter((i) => i.level === 'warning') ?? [];

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) accept(file);
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          dragging ? 'border-foreground bg-accent/50' : 'border-muted-foreground/25',
        )}
      >
        <FileJson className="text-muted-foreground mx-auto size-8" />
        <p className="mt-3 text-sm font-medium">{filename ?? 'Drop a workspace .json file here'}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          One file defines categories, the task tree, assignees and dependencies. Nothing is written
          until you confirm the dry run.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> Choose file
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/example-import.json" download>
              <Download className="size-4" /> Example JSON
            </a>
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) accept(file);
          }}
        />
      </div>

      {checking ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Checking the file…
        </p>
      ) : null}

      {result && result.parseIssues.length > 0 ? (
        <IssueBox
          tone="error"
          title="The file could not be read"
          items={result.parseIssues.map((i) => `${i.path}: ${i.message}`)}
        />
      ) : null}

      {result?.serverError ? (
        <IssueBox
          tone="error"
          title="The database refused the preview"
          items={[result.serverError]}
        />
      ) : null}

      {plan ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Summary label="new tasks" value={plan.counts.tasksCreated} tone="create" />
            <Summary label="updated" value={plan.counts.tasksUpdated} tone="update" />
            <Summary label="new categories" value={plan.counts.categoriesCreated} tone="create" />
            <Summary label="dependency edges" value={plan.counts.dependencyEdges} />
            <Summary label="assignments" value={plan.counts.assigneeLinks} />
            {warnings.length > 0 ? (
              <Summary label="warnings" value={warnings.length} tone="warn" />
            ) : null}
          </div>

          {errors.length > 0 ? (
            <IssueBox
              tone="error"
              title={`${errors.length} problem${errors.length === 1 ? '' : 's'} — nothing will be imported`}
              items={errors.map((i) => i.message)}
            />
          ) : null}

          {warnings.length > 0 ? (
            <IssueBox
              tone="warn"
              title={`${warnings.length} warning${warnings.length === 1 ? '' : 's'} — the import will still run`}
              items={warnings.map((i) => i.message)}
            />
          ) : null}

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown className="size-4" /> Per-task detail ({plan.tasks.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <ul className="divide-y rounded-lg border text-sm">
                {plan.tasks.map((t) => (
                  <li key={t.key} className="flex flex-wrap items-center gap-2 p-2.5">
                    <Badge variant={t.action === 'create' ? 'default' : 'secondary'}>
                      {t.action === 'create' ? '+' : '~'}
                    </Badge>
                    <code className="text-xs font-semibold">{t.key}</code>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.parent ? (
                      <span className="text-muted-foreground text-xs">⤷ {t.parent}</span>
                    ) : null}
                    {t.dependsOn.length > 0 ? (
                      <span className="text-muted-foreground text-xs">
                        needs {t.dependsOn.join(', ')}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">{t.category}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-3">
            <Button onClick={confirm} disabled={!plan.ok || importing}>
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Confirm import
            </Button>
            {plan.ok ? (
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="size-4" /> Ready — this runs as a single transaction.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'create' | 'update' | 'warn';
}) {
  return (
    <span
      className={cn(
        'rounded-md border px-2.5 py-1 text-sm',
        tone === 'create' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
        tone === 'update' && 'border-blue-500/40 text-blue-700 dark:text-blue-300',
        tone === 'warn' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
      )}
    >
      <span className="font-semibold tabular-nums">{value}</span>{' '}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function IssueBox({
  tone,
  title,
  items,
}: {
  tone: 'error' | 'warn';
  title: string;
  items: string[];
}) {
  const Icon = tone === 'error' ? XCircle : AlertTriangle;
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        tone === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className={cn('size-4', tone === 'error' ? 'text-destructive' : 'text-amber-600')} />
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i} className="text-muted-foreground font-mono text-xs">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
