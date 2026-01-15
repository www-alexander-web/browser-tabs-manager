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
  skippedCount: number;
  error?: string;
};

export type SessionExportV1 = {
  version: 1;
  exportedAt: number;
  session: Session;
};
