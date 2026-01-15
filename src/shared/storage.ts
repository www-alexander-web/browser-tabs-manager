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
    keepActiveTab: true,
    excludePinnedTabs: true,
    sessionNamePrefix: 'Session'
  };
}

export async function getSettings(): Promise<Settings> {
  const res = await storageLocalGet<Record<string, unknown>>(SETTINGS_KEY);
  const raw = res[SETTINGS_KEY];
  if (!raw || typeof raw !== 'object') return defaultSettings();
  const obj = raw as Partial<Settings>;
  return {
    keepActiveTab: Boolean(obj.keepActiveTab ?? defaultSettings().keepActiveTab),
    excludePinnedTabs: Boolean(obj.excludePinnedTabs ?? defaultSettings().excludePinnedTabs),
    sessionNamePrefix: String(obj.sessionNamePrefix ?? defaultSettings().sessionNamePrefix)
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
  return raw as CaptureInfo;
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
