export type TabItem = {
  title: string;
  url: string;
  favIconUrl?: string;
};

export type Session = {
  id: string;
  title: string;
  createdAt: number; // epoch ms
  skippedCount: number;
  items: TabItem[];
};

export type Settings = {
  keepActiveTab: boolean;
  excludePinnedTabs: boolean;
  sessionNamePrefix: string;
};

export type CaptureInfo = {
  createdAt: number; // epoch ms
  createdSessionId?: string;
  capturedCount: number;
  closedCount: number;
  skippedCount: number; // capture-skipped total (pinned + restricted)
  skippedRestrictedCount?: number;
  skippedPinnedCount?: number;
  skippedActiveCount?: number; // not closed due to keepActiveTab (but still captured)
  failedToCloseCount?: number;
  failedToCloseTabIds?: number[];
  failedToCloseUrls?: string[];
  closeError?: string; // closing-specific error (non-fatal; session is already saved)
  debugDryRun?: boolean;
  error?: string; // fatal capture error (saving session failed, query failed, etc.)
};

export type SessionExportV1 = {
  version: 1;
  exportedAt: number;
  session: Session;
};
