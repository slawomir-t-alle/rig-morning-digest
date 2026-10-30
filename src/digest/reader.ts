import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type Run = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const run = value as Record<string, unknown>;
  return (
    typeof run.at === 'string' &&
    !Number.isNaN(Date.parse(run.at)) &&
    typeof run.job === 'string' &&
    run.job.length > 0 &&
    (run.status === 'ok' || run.status === 'retry' || run.status === 'fail') &&
    (run.owner === null || typeof run.owner === 'string') &&
    (run.error === undefined || typeof run.error === 'string')
  );
}

export const readNight: ReadNight = (runsDir, night): NightDigest => {
  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = contents === '' ? [] : contents.split('\n');
  if (lines.at(-1) === '') lines.pop();

  const rows = new Map<string, DigestRow>();
  const lastErrorAt = new Map<string, number>();
  let malformedLines = 0;

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      malformedLines++;
      continue;
    }

    if (!isRun(value)) {
      malformedLines++;
      continue;
    }

    const at = Date.parse(value.at);
    const row = rows.get(value.job);
    if (!row) {
      rows.set(value.job, {
        job: value.job,
        owner: value.owner,
        runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status,
        lastError: value.error ?? null,
        firstAt: value.at,
        lastAt: value.at,
      });
      if (value.error !== undefined) lastErrorAt.set(value.job, at);
      continue;
    }

    row.runs++;
    if (value.status === 'retry') row.retries++;
    if (at < Date.parse(row.firstAt)) row.firstAt = value.at;
    if (at >= Date.parse(row.lastAt)) {
      row.lastAt = value.at;
      row.lastStatus = value.status;
      row.owner = value.owner;
    }
    if (value.error !== undefined && at >= (lastErrorAt.get(value.job) ?? -Infinity)) {
      row.lastError = value.error;
      lastErrorAt.set(value.job, at);
    }
  }

  return { rows: [...rows.values()], malformedLines };
};
