import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('aggregates the fixture and counts a malformed line', () => {
    const digest = readNight('runs', '2026-10-28');

    expect(digest.rows).toHaveLength(5);
    expect(digest.malformedLines).toBe(1);
  });

  it('keeps null owners and the last error for each job', () => {
    const { rows } = readNight('runs', '2026-10-28');
    const render = rows.find((row) => row.job === 'digest/render');
    const refresh = rows.find((row) => row.job === 'fixtures/refresh');

    expect(render?.owner).toBeNull();
    expect(refresh).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
    });
  });
});
