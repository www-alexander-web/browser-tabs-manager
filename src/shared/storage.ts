import { storageLocalGet, storageLocalRemove, storageLocalSet } from '@/shared/chrome';
import { createId } from '@/shared/id';
import type { CaptureInfo, Settings, Session, SessionExportV1 } from '@/shared/types';

const SESSIONS_KEY = 'btm.sessions.v1';
const SETTINGS_KEY = 'btm.settings.v1';
const LAST_CAPTURE_KEY = 'btm.lastCapture.v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function defaultSettings(): Settings {
  return {
    keepActiveTab: false,
    excludePinnedTabs: true,
    sessionNamePrefix: 'Session',
    skipDuplicatesOnRestore: false,
    restoreInBackgroundDefault: false
  };
}

export async function getSettings(): Promise<Settings> {
  const res = await storageLocalGet<Record<string, unknown>>(SETTINGS_KEY);
  const raw = res[SETTINGS_KEY];
  if (!raw || typeof raw !== 'object') return defaultSettings();
  const obj = raw as Partial<Settings>;
  const defaults = defaultSettings();
  return {
    keepActiveTab: Boolean(obj.keepActiveTab ?? defaults.keepActiveTab),
    excludePinnedTabs: Boolean(obj.excludePinnedTabs ?? defaults.excludePinnedTabs),
    sessionNamePrefix: String(obj.sessionNamePrefix ?? defaults.sessionNamePrefix),
    skipDuplicatesOnRestore: Boolean(obj.skipDuplicatesOnRestore ?? defaults.skipDuplicatesOnRestore),
    restoreInBackgroundDefault: Boolean(obj.restoreInBackgroundDefault ?? defaults.restoreInBackgroundDefault)
  };
}

export async function setSettings(next: Settings): Promise<void> {
  await storageLocalSet({ [SETTINGS_KEY]: next });
}

export async function getAllSessions(): Promise<Session[]> {
  const res = await storageLocalGet<Record<string, unknown>>(SESSIONS_KEY);
  const raw = res[SESSIONS_KEY];
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw as Session[];
}

async function setAllSessions(sessions: Session[]): Promise<void> {
  await storageLocalSet({ [SESSIONS_KEY]: sessions });
}

export async function addSession(
  session: Omit<Session, 'id'> & Partial<Pick<Session, 'id'>>
): Promise<Session> {
  const sessions = await getAllSessions();
  const created: Session = {
    id: session.id ?? createId(),
    title: session.title,
    createdAt: session.createdAt,
    skippedCount: session.skippedCount ?? 0,
    items: session.items
  };
  await setAllSessions([created, ...sessions]);
  return created;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Pick<Session, 'title' | 'items'>>
): Promise<void> {
  const sessions = await getAllSessions();
  const next = sessions.map((s) => {
    if (s.id !== sessionId) return s;
    return { ...s, ...patch };
  });
  await setAllSessions(next);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getAllSessions();
  await setAllSessions(sessions.filter((s) => s.id !== sessionId));
}

export async function clearAllSessions(): Promise<void> {
  await storageLocalRemove(SESSIONS_KEY);
}

export async function setLastCapture(info: CaptureInfo): Promise<void> {
  await storageLocalSet({ [LAST_CAPTURE_KEY]: info });
}

export async function getLastCapture(): Promise<CaptureInfo | undefined> {
  const res = await storageLocalGet<Record<string, unknown>>(LAST_CAPTURE_KEY);
  const raw = res[LAST_CAPTURE_KEY];
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Partial<CaptureInfo> & Record<string, unknown>;

  // Backwards-compatible, defensive decode. Older versions only had: skippedCount + error.
  const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : Date.now();
  const createdSessionId = typeof obj.createdSessionId === 'string' ? obj.createdSessionId : undefined;
  const capturedCount = typeof obj.capturedCount === 'number' ? obj.capturedCount : 0;
  const closedCount = typeof obj.closedCount === 'number' ? obj.closedCount : 0;

  const skippedPinnedCount = typeof obj.skippedPinnedCount === 'number' ? obj.skippedPinnedCount : 0;
  const skippedRestrictedCount =
    typeof obj.skippedRestrictedCount === 'number'
      ? obj.skippedRestrictedCount
      : typeof obj.skippedCount === 'number'
        ? obj.skippedCount
        : 0;
  const skippedCount =
    typeof obj.skippedCount === 'number' ? obj.skippedCount : skippedPinnedCount + skippedRestrictedCount;

  const skippedActiveCount = typeof obj.skippedActiveCount === 'number' ? obj.skippedActiveCount : 0;

  const failedToCloseTabIds = Array.isArray(obj.failedToCloseTabIds)
    ? obj.failedToCloseTabIds.filter((x): x is number => typeof x === 'number')
    : [];
  const failedToCloseUrls = Array.isArray(obj.failedToCloseUrls)
    ? obj.failedToCloseUrls.filter((x): x is string => typeof x === 'string')
    : [];
  const failedToCloseCount =
    typeof obj.failedToCloseCount === 'number'
      ? obj.failedToCloseCount
      : Math.max(failedToCloseTabIds.length, failedToCloseUrls.length);

  const closeError = typeof obj.closeError === 'string' ? obj.closeError : undefined;
  const debugDryRun = typeof obj.debugDryRun === 'boolean' ? obj.debugDryRun : false;
  const error = typeof obj.error === 'string' ? obj.error : undefined;

  return {
    createdAt,
    createdSessionId,
    capturedCount,
    closedCount,
    skippedCount,
    skippedRestrictedCount,
    skippedPinnedCount,
    skippedActiveCount,
    failedToCloseCount,
    failedToCloseTabIds,
    failedToCloseUrls,
    closeError,
    debugDryRun,
    error
  };
}

export async function exportSessionAsJson(sessionId: string): Promise<string> {
  const sessions = await getAllSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Session not found');
  const payload: SessionExportV1 = { version: 1, exportedAt: Date.now(), session };
  return JSON.stringify(payload, null, 2);
}

export async function importSessionFromJson(jsonText: string): Promise<Session> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!isRecord(parsed)) throw new Error('Invalid JSON shape');

  const version = parsed.version;
  const sessionVal = parsed.session;
  if (version !== 1 || !isRecord(sessionVal)) {
    throw new Error('Unsupported export format');
  }

  // Narrowed to V1 shape, with defensive parsing.
  const createdAt = typeof sessionVal.createdAt === 'number' ? sessionVal.createdAt : Date.now();
  const title = typeof sessionVal.title === 'string' ? sessionVal.title : 'Imported session';
  const itemsRaw = sessionVal.items;

  const items: Session['items'] = Array.isArray(itemsRaw)
    ? itemsRaw
        .map((it): Session['items'][number] | null => {
          if (!isRecord(it)) return null;
          const url = it.url;
          if (typeof url !== 'string') return null;
          const itemTitle = typeof it.title === 'string' ? it.title : url;
          const favIconUrl = typeof it.favIconUrl === 'string' ? it.favIconUrl : undefined;
          return { title: itemTitle, url, favIconUrl };
        })
        .filter((x): x is Session['items'][number] => x !== null)
    : [];

  return await addSession({
    title,
    createdAt,
    skippedCount: typeof sessionVal.skippedCount === 'number' ? sessionVal.skippedCount : 0,
    items
  });
}
