import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const runsDirs: string[] = [];

function makeRunsDir() {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  runsDirs.push(runsDir);
  return runsDir;
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function run(job: string) {
  return JSON.stringify({
    at: '2026-10-29T00:00:00+01:00',
    job,
    status: 'ok',
    owner: 'lane-07',
  });
}

afterEach(() => {
  for (const runsDir of runsDirs) rmSync(runsDir, { recursive: true, force: true });
  runsDirs.length = 0;
});

describe('digest routes', () => {
  it('renders the same sorted jobs in the page and JSON', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), `${run('zeta')}\n${run('alpha')}\n`);
    const app = appFor(runsDir);

    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    const html = await page.text();
    const rows = (await json.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(html.indexOf('<td>alpha</td>')).toBeLessThan(html.indexOf('<td>zeta</td>'));
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const app = appFor(makeRunsDir());

    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders an empty page and empty JSON for an empty night', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const app = appFor(runsDir);

    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([]);
  });

  it('skips a malformed line and still serves both routes', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), `${run('alpha')}\nnot json\n${run('zeta')}\n`);
    const app = appFor(runsDir);

    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    const html = await page.text();
    const rows = (await json.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(html).toContain('<td>alpha</td>');
    expect(html).toContain('<td>zeta</td>');
  });
});
