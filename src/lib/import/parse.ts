import { importSchema, type ImportPayload } from '@/lib/schemas/import';

export type ParseIssue = {
  path: string;
  message: string;
};

export type ParseResult =
  { ok: true; payload: ImportPayload } | { ok: false; issues: ParseIssue[] };

/**
 * Step 1 of the import pipeline (§6.2): text -> validated payload.
 * JSON syntax errors are reported with the surrounding line so the admin can
 * find them in the file rather than guessing.
 */
export function parseImportFile(text: string): ParseResult {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, issues: [{ path: 'file', message: describeJsonError(text, error) }] };
  }

  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path, json),
        message: issue.message,
      })),
    };
  }

  return { ok: true, payload: parsed.data };
}

/** "tasks[3] (ML-01) → depends_on" reads better than "tasks.3.depends_on". */
function formatPath(path: readonly PropertyKey[], json: unknown): string {
  if (path.length === 0) return 'file';

  const [head, index, ...rest] = path;
  const parts: string[] = [String(head)];

  if (typeof index === 'number') {
    const key = itemKeyAt(json, String(head), index);
    parts[0] = `${String(head)}[${index}]${key ? ` (${key})` : ''}`;
  } else if (index !== undefined) {
    parts.push(String(index));
  }

  return [...parts, ...rest.map(String)].join(' → ');
}

function itemKeyAt(json: unknown, collection: string, index: number): string | null {
  if (!json || typeof json !== 'object') return null;
  const list = (json as Record<string, unknown>)[collection];
  if (!Array.isArray(list)) return null;
  const item = list[index];
  if (!item || typeof item !== 'object') return null;
  const key = (item as Record<string, unknown>).key;
  return typeof key === 'string' ? key : null;
}

/**
 * V8 reports JSON syntax errors two different ways depending on the error and
 * the Node version: either "… at position 42", or "… ...\"<snippet>\"… is not
 * valid JSON" with no position at all. Handle both, so the admin always gets a
 * line number to look at.
 */
function describeJsonError(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Invalid JSON';

  const byPosition = /position (\d+)/i.exec(message);
  if (byPosition) {
    const position = Number(byPosition[1]);
    const before = text.slice(0, position);
    const line = before.split('\n').length;
    const column = position - before.lastIndexOf('\n');
    return `${message} — line ${line}, column ${column}${contextLine(text, line)}`;
  }

  const bySnippet = /"([\s\S]*)"(?:\.\.\.)? is not valid JSON$/.exec(message);
  if (bySnippet?.[1]) {
    const index = text.indexOf(bySnippet[1]);
    if (index >= 0) {
      const line = text.slice(0, index).split('\n').length;
      return `${message} — near line ${line}${contextLine(text, line)}`;
    }
  }

  return message;
}

function contextLine(text: string, line: number): string {
  const context = text.split('\n')[line - 1]?.trim() ?? '';
  return context ? `: ${context}` : '';
}
