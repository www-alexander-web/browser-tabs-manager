import {
  runtimeGetURL,
  tabsCreate,
  tabsQuery,
  tabsRemove,
  windowsGetCurrent
} from '@/shared/chrome';
import { getSettings, addSession, setLastCapture } from '@/shared/storage';
import { buildCapturePlan } from '@/shared/capturePlan';
import { formatSessionTitle } from '@/shared/time';

// Debug flags (safe to leave false in production builds).
const DEBUG = false;

/**
 * Developer mode: simulate capture without closing tabs.
 * This still persists the session + last capture info, so you can inspect results safely.
 */
const DEBUG_DRY_RUN = false;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function removeTabsSafely(
  closeTabIds: number[]
): Promise<{ closedTabIds: number[]; failedTabIds: number[]; closeError?: string }> {
  if (closeTabIds.length === 0) return { closedTabIds: [], failedTabIds: [] };

  // Prefer a single call (fast + minimizes race windows).
  try {
    await tabsRemove(closeTabIds);
    return { closedTabIds: closeTabIds, failedTabIds: [] };
  } catch (e) {
    const closeError = errMsg(e);

    // Fallback: per-tab closes so one bad tabId doesn't prevent closing the others.
    const closedTabIds: number[] = [];
    const failedTabIds: number[] = [];
    for (const id of closeTabIds) {
      try {
        await tabsRemove([id]);
        closedTabIds.push(id);
      } catch {
        failedTabIds.push(id);
      }
    }

    return { closedTabIds, failedTabIds, closeError };
  }
}

async function captureCurrentWindowTabs(): Promise<void> {
  const startedAt = Date.now();
  try {
    const settings = await getSettings();
    const win = await windowsGetCurrent();
    const windowId = win.id;
    if (typeof windowId !== 'number') throw new Error('No current window');

    // Only tabs from the CURRENT WINDOW.
    const tabs = await tabsQuery({ windowId, currentWindow: true });

    // Deterministic computation: stable ordering + explicit close set.
    const plan = buildCapturePlan(tabs, settings);
    const {
      items,
      closeCandidates,
      closeTabIds,
      capturedCount,
      skippedCount,
      skippedRestrictedCount,
      skippedPinnedCount,
      skippedActiveCount,
      capturedUrlsPreview
    } = plan;

    if (DEBUG) {
      console.log('[BTM] capture plan', {
        windowId,
        capturedCount,
        toClose: closeTabIds.length,
        skippedRestrictedCount,
        skippedPinnedCount,
        skippedActiveCount,
        urls: capturedUrlsPreview
      });
    }

    if (items.length === 0) {
      await setLastCapture({
        createdAt: startedAt,
        capturedCount: 0,
        closedCount: 0,
        skippedCount,
        skippedRestrictedCount,
        skippedPinnedCount,
        skippedActiveCount,
        failedToCloseCount: 0,
        failedToCloseTabIds: [],
        failedToCloseUrls: [],
        debugDryRun: DEBUG_DRY_RUN,
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

    let closedTabIds: number[] = [];
    let failedTabIds: number[] = [];
    let closeError: string | undefined;

    if (!DEBUG_DRY_RUN) {
      const res = await removeTabsSafely(closeTabIds);
      closedTabIds = res.closedTabIds;
      failedTabIds = res.failedTabIds;
      closeError = res.closeError;
    }

    const urlById = new Map<number, string>(closeCandidates.map((c) => [c.tabId, c.url]));
    const failedUrls = failedTabIds.map((id) => urlById.get(id)).filter((x): x is string => !!x);

    await setLastCapture({
      createdAt: startedAt,
      createdSessionId: created.id,
      capturedCount,
      closedCount: closedTabIds.length,
      skippedCount,
      skippedRestrictedCount,
      skippedPinnedCount,
      skippedActiveCount,
      failedToCloseCount: failedTabIds.length,
      failedToCloseTabIds: failedTabIds,
      failedToCloseUrls: failedUrls,
      closeError,
      debugDryRun: DEBUG_DRY_RUN
    });

    await tabsCreate({ url: runtimeGetURL('pages/manager/index.html') });
  } catch (e) {
    const msg = errMsg(e);
    await setLastCapture({
      createdAt: startedAt,
      capturedCount: 0,
      closedCount: 0,
      skippedCount: 0,
      skippedRestrictedCount: 0,
      skippedPinnedCount: 0,
      skippedActiveCount: 0,
      failedToCloseCount: 0,
      failedToCloseTabIds: [],
      failedToCloseUrls: [],
      debugDryRun: DEBUG_DRY_RUN,
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
