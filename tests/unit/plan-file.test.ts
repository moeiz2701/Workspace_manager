import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseImportFile } from '@/lib/import/parse';
import { emptyPlanContext, planImport } from '@/lib/import/plan';

/**
 * The plan file lives in the CryptoWebApp repo (docs/), not in this one, because
 * it describes that project rather than this tool. This workspace is a nested
 * checkout inside it, so the path resolves in a normal working tree and does not
 * in a standalone clone -- hence the skip rather than a failure.
 */
const FILE = path.resolve(import.meta.dirname, '../../../docs/implementation_plan.import.json');

describe.skipIf(!fs.existsSync(FILE))('the Entropable implementation plan import file', () => {
  const text = fs.readFileSync(FILE, 'utf8');
  const parsed = parseImportFile(text);

  it('passes the v1 import schema', () => {
    if (!parsed.ok) console.error(parsed.issues);
    expect(parsed.ok).toBe(true);
  });

  it('plans cleanly against an empty workspace', () => {
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const plan = planImport(parsed.payload, emptyPlanContext());
    const errors = plan.issues.filter((i) => i.level === 'error');
    if (errors.length) console.error(errors);

    expect(errors).toEqual([]);
    expect(plan.ok).toBe(true);
    console.log(plan.counts);
  });
});
