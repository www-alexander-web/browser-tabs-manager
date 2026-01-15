import {
  runtimeGetURL,
  tabsCreate,
  tabsQuery,
  tabsRemove,
  windowsGetCurrent
} from '@/shared/chrome';
import { getSettings, addSession, setLastCapture } from '@/shared/storage';
import type { TabItem } from '@/shared/types';
import { isRestrictedUrl } from '@/shared/url';
import { formatSessionTitle } from '@/shared/time';

async function captureCurrentWindowTabs(): Promise<void> {
  const startedAt = Date.now();
  try {
    const settings = await getSettings();
    const win = await windowsGetCurrent();
    const windowId = win.id;
    if (typeof windowId !== 'number') throw new Error('No current window');

    const tabs = await tabsQuery({ windowId, currentWindow: true });
    const activeTabId = tabs.find((t) => t.active)?.id;

    const eligible = tabs.filter((t) => {
      if (settings.excludePinnedTabs && t.pinned) return false;
      if (settings.keepActiveTab && typeof activeTabId === 'number' && t.id === activeTabId)
        return false;
      return true;
    });

    let skippedCount = 0;
    const items: TabItem[] = [];
    const closeIds: number[] = [];

    for (const t of eligible) {
      const url = t.url ?? '';
      if (!url || isRestrictedUrl(url)) {
        skippedCount += 1;
        continue;
      }
      items.push({
        title: (t.title ?? url).trim() || url,
        url,
        favIconUrl: t.favIconUrl ?? undefined
      });
      if (typeof t.id === 'number') closeIds.push(t.id);
    }

    if (items.length === 0) {
      await setLastCapture({
        createdAt: startedAt,
        capturedCount: 0,
        closedCount: 0,
        skippedCount,
        error:
          skippedCount > 0
            ? 'All eligible tabs had restricted URLs and were skipped.'
            : 'No tabs to capture.'
      });
      await tabsCreate({ url: runtimeGetURL('pages/manager/index.html') });
      return;
    }

    // Persist first, then close. If closing fails, keep session anyway.
    const created = await addSession({
      title: formatSessionTitle(settings.sessionNamePrefix, startedAt),
      createdAt: startedAt,
      skippedCount,
      items
    });

    let closedCount = 0;
    let closeError: string | undefined;
    try {
      await tabsRemove(closeIds);
      closedCount = closeIds.length;
    } catch (e) {
      closeError = e instanceof Error ? e.message : String(e);
    }

    await setLastCapture({
      createdAt: startedAt,
      createdSessionId: created.id,
      capturedCount: items.length,
      closedCount,
      skippedCount,
      error: closeError
    });

    await tabsCreate({ url: runtimeGetURL('pages/manager/index.html') });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setLastCapture({
      createdAt: startedAt,
      capturedCount: 0,
      closedCount: 0,
      skippedCount: 0,
      error: msg
    });
    // Still open Manager so user sees the error banner.
    try {
      await tabsCreate({ url: runtimeGetURL('pages/manager/index.html') });
    } catch {
      // ignore
    }
  }
}

chrome.action.onClicked.addListener(() => {
  void captureCurrentWindowTabs();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'send-tabs-to-manager') {
    void captureCurrentWindowTabs();
  }
});
