import { describe, expect, it } from 'vitest';
import { buildRestoreQueue, normalizeUrlForDuplicateCheck } from '@/shared/restore';
import type { TabItem } from '@/shared/types';

describe('restore helpers', () => {
  it('buildRestoreQueue preserves original ordering when selecting indices', () => {
    const items: TabItem[] = [
      { title: 'A', url: 'https://a.com' },
      { title: 'B', url: 'https://b.com' },
      { title: 'C', url: 'https://c.com' },
      { title: 'D', url: 'https://d.com' }
    ];

    // Intentionally out-of-order + duplicates + invalid indices.
    const queue = buildRestoreQueue(items, [3, 1, 1, 999, -1, 0]);
    expect(queue.map((x) => x.url)).toEqual(['https://a.com', 'https://b.com', 'https://d.com']);
  });

  it('normalizeUrlForDuplicateCheck trims whitespace', () => {
    expect(normalizeUrlForDuplicateCheck('  https://example.com  ')).toBe('https://example.com');
    expect(normalizeUrlForDuplicateCheck('\nhttps://example.com\t')).toBe('https://example.com');
  });
});

