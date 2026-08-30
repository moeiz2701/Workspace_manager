import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseImportFile } from '@/lib/import/parse';

const seedPath = path.join(process.cwd(), 'supabase/seed/entropable.seed.json');

function issueText(result: ReturnType<typeof parseImportFile>) {
  return result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`);
}

describe('parseImportFile', () => {
  it('accepts the shipped seed file', () => {
    const result = parseImportFile(readFileSync(seedPath, 'utf8'));
    expect(issueText(result)).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.categories).toHaveLength(6);
    expect(result.payload.tasks).toHaveLength(37);
  });

  it('applies defaults for omitted fields', () => {
    const result = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'platform', name: 'Platform' }],
        tasks: [{ key: 'PLT-01', category: 'platform', title: 'Do the thing' }],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const task = result.payload.tasks[0]!;
    expect(result.payload.mode).toBe('upsert');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.assignees).toEqual([]);
    expect(task.depends_on).toEqual([]);
    expect(result.payload.categories[0]!.color).toBe('slate');
  });

  it('reports a JSON syntax error with the line it is on', () => {
    const result = parseImportFile('{\n  "version": 1,\n  "tasks": [,]\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.path).toBe('file');
    expect(result.issues[0]!.message).toMatch(/line 3/);
  });

  it('rejects a version other than 1', () => {
    const result = parseImportFile(JSON.stringify({ version: 2, tasks: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects malformed task and category keys', () => {
    const lower = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'platform', name: 'Platform' }],
        tasks: [{ key: 'plt-01', category: 'platform', title: 'x' }],
      }),
    );
    expect(lower.ok).toBe(false);
    expect(issueText(lower)[0]).toMatch(/ML-01/);

    const upperCategory = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'Platform', name: 'Platform' }],
        tasks: [],
      }),
    );
    expect(upperCategory.ok).toBe(false);
  });

  it('names the offending task in the issue path', () => {
    const result = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'platform', name: 'Platform' }],
        tasks: [
          { key: 'PLT-01', category: 'platform', title: 'ok' },
          { key: 'PLT-02', category: 'platform', title: 'bad', priority: 'urgent' },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(issueText(result)[0]).toMatch(/tasks\[1] \(PLT-02\) → priority/);
  });

  it('rejects duplicate task keys', () => {
    const result = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'platform', name: 'Platform' }],
        tasks: [
          { key: 'PLT-01', category: 'platform', title: 'first' },
          { key: 'PLT-01', category: 'platform', title: 'second' },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(issueText(result).join(' ')).toMatch(/Duplicate task key PLT-01/);
  });

  it('rejects a task that is its own parent or its own dependency', () => {
    const selfParent = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'platform', name: 'Platform' }],
        tasks: [{ key: 'PLT-01', category: 'platform', title: 'x', parent: 'PLT-01' }],
      }),
    );
    expect(issueText(selfParent).join(' ')).toMatch(/cannot be its own parent/);

    const selfDep = parseImportFile(
      JSON.stringify({
        version: 1,
        categories: [{ key: 'platform', name: 'Platform' }],
        tasks: [{ key: 'PLT-01', category: 'platform', title: 'x', depends_on: ['PLT-01'] }],
      }),
    );
    expect(issueText(selfDep).join(' ')).toMatch(/cannot depend on itself/);
  });

  it('rejects the unimplemented sync mode rather than silently upserting', () => {
    const result = parseImportFile(JSON.stringify({ version: 1, mode: 'sync', tasks: [] }));
    expect(result.ok).toBe(false);
  });
});
