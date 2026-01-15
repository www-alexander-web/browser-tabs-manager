import type { Settings, TabItem } from '@/shared/types';
import { isRestrictedUrl } from '@/shared/url';

export type TabForCapture = Pick<
  chrome.tabs.Tab,
  'id' | 'index' | 'url' | 'title' | 'favIconUrl' | 'pinned' | 'active'
>;

export type CloseCandidate = { tabId: number; url: string };

export type CapturePlan = {
  /**
   * Ordered items to store in the session. Ordering is deterministic (tab.index asc).
   */
  items: TabItem[];

  /**
   * Deterministic set of tabs we are allowed to close for this capture.
   * This MUST be the only source of tabIds passed to chrome.tabs.remove().
   */
  closeCandidates: CloseCandidate[];

  /**
   * Convenience projection of `closeCandidates`.
   */
  closeTabIds: number[];

  capturedCount: number;
  skippedCount: number; // capture-skipped total (pinned + restricted)
  skippedRestrictedCount: number;
  skippedPinnedCount: number;
  skippedActiveCount: number; // not closed due to keepActiveTab (but still captured)

  /**
   * For diagnostics/logging only (first few captured URLs).
   */
  capturedUrlsPreview: string[];
};

function stableTabSort(a: TabForCapture, b: TabForCapture): number {
  const ai = typeof a.index === 'number' ? a.index : Number.MAX_SAFE_INTEGER;
  const bi = typeof b.index === 'number' ? b.index : Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  const aid = typeof a.id === 'number' ? a.id : Number.MAX_SAFE_INTEGER;
  const bid = typeof b.id === 'number' ? b.id : Number.MAX_SAFE_INTEGER;
  return aid - bid;
}

/**
 * Computes a deterministic capture/close plan for a specific window's tab list.
 *
 * Policy choices (intentional):
 * - excludePinnedTabs=true means pinned tabs are neither saved nor closed.
 * - keepActiveTab=true means the active tab is still saved (if otherwise eligible),
 *   but is never closed. This keeps restore consistent while remaining safe.
 */
export function buildCapturePlan(tabs: TabForCapture[], settings: Settings): CapturePlan {
  const ordered = [...tabs].sort(stableTabSort);

  let skippedRestrictedCount = 0;
  let skippedPinnedCount = 0;
  let skippedActiveCount = 0;

  const items: TabItem[] = [];
  const closeCandidates: CloseCandidate[] = [];

  for (const t of ordered) {
    if (settings.excludePinnedTabs && Boolean(t.pinned)) {
      skippedPinnedCount += 1;
      continue;
    }

    const url = (t.url ?? '').trim();
    if (!url || isRestrictedUrl(url)) {
      skippedRestrictedCount += 1;
      continue;
    }

    const title = ((t.title ?? url).trim() || url) as string;
    items.push({
      title,
      url,
      favIconUrl: t.favIconUrl ?? undefined
    });

    const tabId = typeof t.id === 'number' ? t.id : undefined;
    if (typeof tabId !== 'number') continue;

    if (settings.keepActiveTab && Boolean(t.active)) {
      skippedActiveCount += 1;
      continue;
    }

    closeCandidates.push({ tabId, url });
  }

  return {
    items,
    closeCandidates,
    closeTabIds: closeCandidates.map((c) => c.tabId),
    capturedCount: items.length,
    skippedRestrictedCount,
    skippedPinnedCount,
    skippedActiveCount,
    skippedCount: skippedRestrictedCount + skippedPinnedCount,
    capturedUrlsPreview: items.slice(0, 5).map((it) => it.url)
  };
}

