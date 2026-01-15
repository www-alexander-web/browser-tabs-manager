import { describe, expect, it } from 'vitest';
import { buildCapturePlan } from '@/shared/capturePlan';
import type { Settings } from '@/shared/types';

describe('buildCapturePlan', () => {
  const baseSettings: Settings = {
    excludePinnedTabs: true,
    keepActiveTab: false,
    sessionNamePrefix: 'Session',
    skipDuplicatesOnRestore: false,
    restoreInBackgroundDefault: false
  };

  it('orders captured items by tab.index asc', () => {
    const plan = buildCapturePlan(
      [
        { id: 10, index: 2, url: 'https://c.com', title: 'C', pinned: false, active: false },
        { id: 11, index: 0, url: 'https://a.com', title: 'A', pinned: false, active: false },
        { id: 12, index: 1, url: 'https://b.com', title: 'B', pinned: false, active: false }
      ],
      baseSettings
    );

    expect(plan.items.map((x) => x.url)).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
    expect(plan.closeTabIds).toEqual([11, 12, 10]);
  });

  it('skips pinned (when enabled) and restricted URLs, and only closes captured tabs', () => {
    const plan = buildCapturePlan(
      [
        { id: 1, index: 0, url: 'chrome://extensions', title: 'Ext', pinned: false, active: false },
        { id: 2, index: 1, url: 'https://b.com', title: 'B', pinned: false, active: false },
        { id: 3, index: 2, url: 'https://pinned.com', title: 'P', pinned: true, active: false }
      ],
      baseSettings
    );

    expect(plan.capturedCount).toBe(1);
    expect(plan.items.map((x) => x.url)).toEqual(['https://b.com']);
    expect(plan.closeTabIds).toEqual([2]);
    expect(plan.skippedRestrictedCount).toBe(1);
    expect(plan.skippedPinnedCount).toBe(1);
    expect(plan.skippedCount).toBe(2);
  });

  it('when keepActiveTab=true, it still captures active but does not close it', () => {
    const settings: Settings = { ...baseSettings, keepActiveTab: true };
    const plan = buildCapturePlan(
      [
        { id: 1, index: 0, url: 'https://one.com', title: 'One', pinned: false, active: false },
        { id: 2, index: 1, url: 'https://active.com', title: 'Active', pinned: false, active: true }
      ],
      settings
    );

    expect(plan.items.map((x) => x.url)).toEqual(['https://one.com', 'https://active.com']);
    expect(plan.closeTabIds).toEqual([1]);
    expect(plan.skippedActiveCount).toBe(1);
  });

  it('includes pinned tabs when excludePinnedTabs=false', () => {
    const settings: Settings = { ...baseSettings, excludePinnedTabs: false };
    const plan = buildCapturePlan(
      [{ id: 7, index: 0, url: 'https://pinned.com', title: 'P', pinned: true, active: false }],
      settings
    );

    expect(plan.capturedCount).toBe(1);
    expect(plan.skippedPinnedCount).toBe(0);
    expect(plan.closeTabIds).toEqual([7]);
  });
});

