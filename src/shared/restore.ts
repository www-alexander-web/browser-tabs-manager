import type { TabItem } from '@/shared/types';
import { tabsCreate, tabsQuery, windowsCreate, windowsGetCurrent } from '@/shared/chrome';

const OPEN_DELAY_MS_WHEN_MANY = 20;
const OPEN_DELAY_THRESHOLD = 50;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function chromeLastErrorMessage(): string | undefined {
  const err = chrome.runtime?.lastError;
  return err?.message;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function normalizeUrlForDuplicateCheck(url: string): string {
  return url.trim();
}

export function buildRestoreQueue(items: TabItem[], selectedIndices?: Iterable<number>): TabItem[] {
  if (!selectedIndices) return items;
  const wanted = new Set<number>();
  for (const idx of selectedIndices) {
    if (typeof idx === 'number' && Number.isFinite(idx)) wanted.add(idx);
  }
  const ordered = [...wanted].sort((a, b) => a - b);
  return ordered.map((idx) => items[idx]).filter((x): x is TabItem => Boolean(x));
}

export type RestoreTarget =
  | { kind: 'current-window' }
  | { kind: 'new-window' }
  | {
      kind: 'new-window-tab-group';
      groupTitle?: string;
      groupColor?: chrome.tabGroups.ColorEnum;
    };

export type RestoreProgress = {
  total: number;
  openedCount: number;
  skippedDuplicatesCount: number;
  failedCount: number;
  phase: 'opening' | 'grouping' | 'done';
};

export type RestoreResult = {
  windowId: number;
  openedTabIds: number[];
  openedCount: number;
  skippedDuplicatesCount: number;
  failedCount: number;
  failedUrls: string[];
  groupId?: number;
  groupError?: string;
};

export type RestoreRequest = {
  items: TabItem[];
  target: RestoreTarget;
  skipDuplicates: boolean;
  openInBackground: boolean;
  onProgress?: (p: RestoreProgress) => void;
};

function canUseTabGroups(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.tabs?.group === 'function' &&
    typeof chrome.tabGroups?.update === 'function'
  );
}

async function tabsGroup(tabIds: number[]): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    chrome.tabs.group({ tabIds }, (groupId) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(groupId);
    });
  });
}

async function tabGroupsUpdate(
  groupId: number,
  updateProperties: chrome.tabGroups.UpdateProperties
): Promise<chrome.tabGroups.TabGroup> {
  return await new Promise<chrome.tabGroups.TabGroup>((resolve, reject) => {
    chrome.tabGroups.update(groupId, updateProperties, (group) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(group);
    });
  });
}

export async function restoreTabs(req: RestoreRequest): Promise<RestoreResult> {
  const onProgress = req.onProgress ?? (() => {});
  const total = req.items.length;
  const delayMs = total >= OPEN_DELAY_THRESHOLD ? OPEN_DELAY_MS_WHEN_MANY : 0;

  let windowId: number | undefined;
  const initialUrls = new Set<string>();

  if (req.target.kind === 'current-window') {
    const win = await windowsGetCurrent();
    if (typeof win.id !== 'number') throw new Error('No current window');
    windowId = win.id;
    if (req.skipDuplicates) {
      const tabs = await tabsQuery({ windowId });
      for (const t of tabs) {
        const u = typeof t.url === 'string' ? normalizeUrlForDuplicateCheck(t.url) : '';
        if (u) initialUrls.add(u);
      }
    }
  } else {
    // Always create a blank window, then open tabs ourselves.
    // This keeps ordering predictable + avoids duplicating the first URL.
    const win = await windowsCreate({ focused: req.openInBackground ? false : true });
    if (typeof win.id !== 'number') throw new Error('No window id');
    windowId = win.id;

    if (req.skipDuplicates) {
      const tabs = await tabsQuery({ windowId });
      for (const t of tabs) {
        const u = typeof t.url === 'string' ? normalizeUrlForDuplicateCheck(t.url) : '';
        if (u) initialUrls.add(u);
      }
    }
  }

  if (typeof windowId !== 'number') throw new Error('Unable to determine target window');

  const openedTabIds: number[] = [];
  const failedUrls: string[] = [];
  let openedCount = 0;
  let skippedDuplicatesCount = 0;
  let failedCount = 0;

  const seenUrls = new Set<string>(initialUrls);

  onProgress({
    total,
    openedCount,
    skippedDuplicatesCount,
    failedCount,
    phase: 'opening'
  });

  for (let i = 0; i < req.items.length; i += 1) {
    const urlRaw = req.items[i]?.url ?? '';
    const url = normalizeUrlForDuplicateCheck(urlRaw);
    if (!url) continue;

    if (req.skipDuplicates && seenUrls.has(url)) {
      skippedDuplicatesCount += 1;
      onProgress({
        total,
        openedCount,
        skippedDuplicatesCount,
        failedCount,
        phase: 'opening'
      });
      continue;
    }

    // Add eagerly to avoid duplicates within the same restore batch.
    if (req.skipDuplicates) seenUrls.add(url);

    try {
      const created = await tabsCreate({
        windowId,
        url,
        active: !req.openInBackground
      });
      if (typeof created.id === 'number') openedTabIds.push(created.id);
      openedCount += 1;
    } catch (e) {
      failedCount += 1;
      failedUrls.push(url);
      // If create failed, allow later duplicates of this URL to still try again.
      if (req.skipDuplicates) seenUrls.delete(url);
      // Keep going.
      void e;
    }

    onProgress({
      total,
      openedCount,
      skippedDuplicatesCount,
      failedCount,
      phase: 'opening'
    });

    await sleep(delayMs);
  }

  let groupId: number | undefined;
  let groupError: string | undefined;

  if (req.target.kind === 'new-window-tab-group') {
    onProgress({
      total,
      openedCount,
      skippedDuplicatesCount,
      failedCount,
      phase: 'grouping'
    });

    if (!canUseTabGroups()) {
      groupError = 'Tab groups are not supported in this browser.';
    } else if (openedTabIds.length > 0) {
      try {
        groupId = await tabsGroup(openedTabIds);
        await tabGroupsUpdate(groupId, {
          title: req.target.groupTitle ?? 'Restored session',
          color: req.target.groupColor ?? 'blue'
        });
      } catch (e) {
        groupError = errMsg(e);
      }
    }
  }

  onProgress({
    total,
    openedCount,
    skippedDuplicatesCount,
    failedCount,
    phase: 'done'
  });

  return {
    windowId,
    openedTabIds,
    openedCount,
    skippedDuplicatesCount,
    failedCount,
    failedUrls,
    groupId,
    groupError
  };
}

