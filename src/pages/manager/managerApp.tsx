import React, { useEffect, useMemo, useRef, useState } from 'react';
import './manager.css';
import type { CaptureInfo, Session } from '@/shared/types';
import {
  exportSessionAsJson,
  getAllSessions,
  getLastCapture,
  importSessionFromJson,
  updateSession,
  deleteSession
} from '@/shared/storage';
import { formatDateTime } from '@/shared/time';
import { useToast } from '@/pages/ui/toast';
import { windowsCreate } from '@/shared/chrome';

function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ManagerApp() {
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [lastCapture, setLastCapture] = useState<CaptureInfo | undefined>(undefined);
  const importRef = useRef<HTMLInputElement | null>(null);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      return s.items.some(
        (it) => it.title.toLowerCase().includes(q) || it.url.toLowerCase().includes(q)
      );
    });
  }, [search, sessions]);

  const selected = useMemo(() => sessions.find((s) => s.id === selectedId), [sessions, selectedId]);

  async function refresh() {
    if (!isExtensionContext()) return;
    const all = await getAllSessions();
    setSessions(all);
    if (!selectedId && all[0]) setSelectedId(all[0].id);
    if (selectedId && !all.some((s) => s.id === selectedId)) setSelectedId(all[0]?.id);
    setLastCapture(await getLastCapture());
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isExtensionContext()) {
    return (
      <div style={{ padding: 18 }}>
        <div className="empty">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Extension context required</div>
          <div>
            Open this page via the installed extension (e.g. after clicking the toolbar action).
            Vite dev server doesn’t provide <code>chrome.*</code> APIs.
          </div>
        </div>
      </div>
    );
  }

  async function onUpdateTitle(next: string) {
    if (!selected) return;
    await updateSession(selected.id, { title: next });
    toast.push('success', 'Title updated');
    await refresh();
  }

  async function onDeleteSession(id: string) {
    await deleteSession(id);
    toast.push('success', 'Session deleted');
    await refresh();
  }

  async function onExportSession(id: string) {
    const json = await exportSessionAsJson(id);
    downloadTextFile(`browser-tabs-manager-session-${id}.json`, json);
    toast.push('success', 'Exported JSON');
  }

  async function onImportJsonFile(file: File) {
    const text = await file.text();
    const created = await importSessionFromJson(text);
    toast.push('success', 'Imported session');
    await refresh();
    setSelectedId(created.id);
  }

  async function onOpenAllNewWindow(session: Session) {
    const urls = session.items.map((it) => it.url);
    if (urls.length === 0) return;
    await windowsCreate({ url: urls });
    toast.push('success', `Opened ${urls.length} tabs`);
  }

  async function onOpenTab(url: string) {
    // Open in the current window as a normal tab.
    chrome.tabs.create({ url });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src={chrome.runtime.getURL('icons/icon32.png')} width={28} height={28} alt="BTM" />
          <div>
            <div className="brandTitle">Browser Tabs Manager</div>
            <div className="brandSub">Sessions: {sessions.length}</div>
          </div>
        </div>

        <div className="row">
          <input
            className="input"
            placeholder="Search title / url…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 10 }} className="row">
          <button
            className="btn"
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL('pages/options/index.html') })
            }
          >
            Options
          </button>
          <button className="btn" onClick={() => importRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                await onImportJsonFile(f);
              } catch (err) {
                toast.push('error', err instanceof Error ? err.message : String(err));
              } finally {
                e.currentTarget.value = '';
              }
            }}
          />
        </div>

        <div className="sessionsList">
          {filteredSessions.length === 0 ? (
            <div className="empty">No sessions found.</div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className={`sessionItem ${s.id === selectedId ? 'sessionItemActive' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <p className="sessionTitle" title={s.title}>
                  {s.title}
                </p>
                <div className="sessionMeta">
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  <span>
                    {s.items.length} tabs
                    {typeof s.skippedCount === 'number' && s.skippedCount > 0
                      ? ` · ${s.skippedCount} skipped`
                      : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="main">
        {lastCapture ? (
          <div className={`banner ${lastCapture.error ? 'bannerError' : 'bannerOk'}`}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'baseline'
              }}
            >
              <div style={{ fontWeight: 800 }}>
                Last capture ·{' '}
                <span className="muted">{formatDateTime(lastCapture.createdAt)}</span>
              </div>
              <span className="pill">
                saved {lastCapture.capturedCount} · closed {lastCapture.closedCount} · skipped{' '}
                {lastCapture.skippedCount}
              </span>
            </div>
            {lastCapture.error ? (
              <div style={{ marginTop: 6 }} className="muted">
                Error: {lastCapture.error}
              </div>
            ) : null}
          </div>
        ) : null}

        {!selected ? (
          <div className="empty">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>No session selected</div>
            <div>Click the extension action to capture tabs into a new session.</div>
          </div>
        ) : (
          <>
            <div className="header">
              <div style={{ minWidth: 380, flex: 1 }}>
                <input
                  className="input titleInput"
                  value={selected.title}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSessions((prev) =>
                      prev.map((s) => (s.id === selected.id ? { ...s, title: next } : s))
                    );
                  }}
                  onBlur={(e) => {
                    const next = e.target.value.trim() || selected.title;
                    void onUpdateTitle(next);
                  }}
                />
                <div className="muted" style={{ marginTop: 6 }}>
                  Created: {formatDateTime(selected.createdAt)} · Tabs: {selected.items.length}
                  {selected.skippedCount > 0 ? ` · Skipped: ${selected.skippedCount}` : ''}
                </div>
              </div>

              <div className="row">
                <button
                  className="btn btnPrimary"
                  onClick={() => void onOpenAllNewWindow(selected)}
                >
                  Open all in new window
                </button>
                <button className="btn" onClick={() => void onExportSession(selected.id)}>
                  Export JSON
                </button>
                <button className="btn btnDanger" onClick={() => void onDeleteSession(selected.id)}>
                  Delete
                </button>
              </div>
            </div>

            <div className="items">
              {selected.items.map((it, idx) => (
                <div key={`${it.url}_${idx}`} className="tabRow">
                  {it.favIconUrl ? (
                    <img
                      className="favicon"
                      src={it.favIconUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="favicon" />
                  )}
                  <div>
                    <div className="tabTitle">{it.title}</div>
                    <div className="tabUrl" title={it.url}>
                      {it.url}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn" onClick={() => void onOpenTab(it.url)}>
                      Open tab
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
