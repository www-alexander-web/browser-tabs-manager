import React, { useEffect, useMemo, useRef, useState } from 'react';
import './manager.css';
import type { CaptureInfo, Session, Settings, TabItem } from '@/shared/types';
import {
  exportSessionAsJson,
  getAllSessions,
  getLastCapture,
  getSettings,
  importSessionFromJson,
  updateSession,
  deleteSession
} from '@/shared/storage';
import { formatDateTime } from '@/shared/time';
import { useToast } from '@/pages/ui/toast';
import { restoreTabs, type RestoreProgress, type RestoreTarget } from '@/shared/restore';

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
  const [tabSearch, setTabSearch] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [lastCapture, setLastCapture] = useState<CaptureInfo | undefined>(undefined);
  const [settings, setSettings] = useState<Settings | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [selectedTabIdxBySession, setSelectedTabIdxBySession] = useState<Record<string, number[]>>(
    {}
  );
  const [restoreMenuOpen, setRestoreMenuOpen] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);
  const [restoreFailedPreview, setRestoreFailedPreview] = useState<string[]>([]);

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
    setSettings(await getSettings());
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

  function getSelectedIndices(sessionId: string): Set<number> {
    const raw = selectedTabIdxBySession[sessionId] ?? [];
    return new Set<number>(raw.filter((x) => typeof x === 'number' && Number.isFinite(x)));
  }

  function setSelectedIndices(sessionId: string, next: Set<number>) {
    setSelectedTabIdxBySession((prev) => ({
      ...prev,
      [sessionId]: [...next].sort((a, b) => a - b)
    }));
  }

  function toggleSelected(sessionId: string, idx: number, checked: boolean) {
    const next = getSelectedIndices(sessionId);
    if (checked) next.add(idx);
    else next.delete(idx);
    setSelectedIndices(sessionId, next);
  }

  async function onOpenTab(url: string, background: boolean) {
    chrome.tabs.create({ url, active: !background });
  }

  function canShowTabGroupRestore(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      typeof chrome.tabs?.group === 'function' &&
      typeof chrome.tabGroups?.update === 'function'
    );
  }

  function getFilteredTabIndices(items: TabItem[], q: string): number[] {
    const query = q.trim().toLowerCase();
    if (!query) return items.map((_, i) => i);
    const out: number[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (it.title.toLowerCase().includes(query) || it.url.toLowerCase().includes(query)) out.push(i);
    }
    return out;
  }

  async function runRestore(session: Session, indices: number[] | null, target: RestoreTarget) {
    if (!settings) return;
    setRestoreMenuOpen(false);
    setRestoreFailedPreview([]);

    const selectedItems =
      indices === null
        ? session.items
        : indices.map((i) => session.items[i]).filter((x): x is TabItem => Boolean(x));

    if (selectedItems.length === 0) {
      toast.push('info', 'No tabs selected');
      return;
    }

    const failedUrls: string[] = [];
    try {
      setRestoreProgress({
        total: selectedItems.length,
        openedCount: 0,
        skippedDuplicatesCount: 0,
        failedCount: 0,
        phase: 'opening'
      });

      const res = await restoreTabs({
        items: selectedItems,
        target,
        skipDuplicates: settings.skipDuplicatesOnRestore,
        openInBackground: Boolean(settings.restoreInBackgroundDefault),
        onProgress: (p) => setRestoreProgress(p)
      });

      failedUrls.push(...res.failedUrls);
      setRestoreFailedPreview(res.failedUrls.slice(0, 5));

      const summaryParts = [
        `Opened ${res.openedCount}/${selectedItems.length}`,
        settings.skipDuplicatesOnRestore ? `skipped dupes ${res.skippedDuplicatesCount}` : null,
        res.failedCount > 0 ? `failed ${res.failedCount}` : null
      ].filter((x): x is string => Boolean(x));

      const suffix =
        res.failedUrls.length > 0 ? ` · failed (first 3): ${res.failedUrls.slice(0, 3).join(' · ')}` : '';
      toast.push('success', summaryParts.join(' · ') + suffix);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.push('error', `Restore failed: ${msg}`);
    } finally {
      setRestoreProgress(null);
    }
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
                saved {lastCapture.capturedCount} · closed {lastCapture.closedCount}
              </span>
            </div>
            <div style={{ marginTop: 6 }} className="muted">
              Skipped: restricted{' '}
              {lastCapture.skippedRestrictedCount ?? lastCapture.skippedCount ?? 0} · pinned{' '}
              {lastCapture.skippedPinnedCount ?? 0} · kept active {lastCapture.skippedActiveCount ?? 0}
              {typeof lastCapture.failedToCloseCount === 'number' && lastCapture.failedToCloseCount > 0
                ? ` · failed to close ${lastCapture.failedToCloseCount}`
                : ''}
              {lastCapture.debugDryRun ? ' · dry-run (no tabs were closed)' : ''}
            </div>
            {lastCapture.error ? (
              <div style={{ marginTop: 6 }} className="muted">
                Error: {lastCapture.error}
              </div>
            ) : null}
            {!lastCapture.error && lastCapture.closeError ? (
              <div style={{ marginTop: 6 }} className="muted">
                Close warning: {lastCapture.closeError}
              </div>
            ) : null}
            {!lastCapture.error &&
            Array.isArray(lastCapture.failedToCloseUrls) &&
            lastCapture.failedToCloseUrls.length > 0 ? (
              <div style={{ marginTop: 6 }} className="muted">
                Failed to close (first 5): {lastCapture.failedToCloseUrls.slice(0, 5).join(' · ')}
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
                {restoreProgress ? (
                  <div className="progressRow">
                    <span className="pill">
                      Opening {restoreProgress.openedCount}/{restoreProgress.total}…
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {restoreProgress.skippedDuplicatesCount > 0
                        ? `Skipped dupes: ${restoreProgress.skippedDuplicatesCount} · `
                        : ''}
                      {restoreProgress.failedCount > 0 ? `Failed: ${restoreProgress.failedCount}` : ''}
                    </span>
                  </div>
                ) : null}
                {restoreFailedPreview.length > 0 ? (
                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    Failed to open (first 5): {restoreFailedPreview.join(' · ')}
                  </div>
                ) : null}
              </div>

              <div className="row">
                <div className="menuWrap">
                  <button
                    className="btn btnPrimary"
                    disabled={!settings || !!restoreProgress}
                    onClick={() => setRestoreMenuOpen((v) => !v)}
                  >
                    Restore…
                  </button>
                  {restoreMenuOpen ? (
                    <div className="menu" role="menu">
                      <button
                        className="menuItem"
                        onClick={() =>
                          void runRestore(selected, null, {
                            kind: 'current-window'
                          })
                        }
                      >
                        Restore all → Current window
                      </button>
                      <button
                        className="menuItem"
                        onClick={() =>
                          void runRestore(selected, null, {
                            kind: 'new-window'
                          })
                        }
                      >
                        Restore all → New window
                      </button>
                      {canShowTabGroupRestore() ? (
                        <button
                          className="menuItem"
                          onClick={() =>
                            void runRestore(selected, null, {
                              kind: 'new-window-tab-group',
                              groupTitle: selected.title
                            })
                          }
                        >
                          Restore all → New window (tab group)
                        </button>
                      ) : null}
                      <div className="menuSep" />
                      <button
                        className="menuItem"
                        disabled={getSelectedIndices(selected.id).size === 0}
                        onClick={() =>
                          void runRestore(
                            selected,
                            [...getSelectedIndices(selected.id)].sort((a, b) => a - b),
                            { kind: 'current-window' }
                          )
                        }
                      >
                        Restore selected → Current window
                      </button>
                      <button
                        className="menuItem"
                        disabled={getSelectedIndices(selected.id).size === 0}
                        onClick={() =>
                          void runRestore(
                            selected,
                            [...getSelectedIndices(selected.id)].sort((a, b) => a - b),
                            { kind: 'new-window' }
                          )
                        }
                      >
                        Restore selected → New window
                      </button>
                      {canShowTabGroupRestore() ? (
                        <button
                          className="menuItem"
                          disabled={getSelectedIndices(selected.id).size === 0}
                          onClick={() =>
                            void runRestore(
                              selected,
                              [...getSelectedIndices(selected.id)].sort((a, b) => a - b),
                              { kind: 'new-window-tab-group', groupTitle: selected.title }
                            )
                          }
                        >
                          Restore selected → New window (tab group)
                        </button>
                      ) : null}
                      <div className="menuSep" />
                      <button className="menuItem" onClick={() => setRestoreMenuOpen(false)}>
                        Close
                      </button>
                    </div>
                  ) : null}
                </div>
                <button className="btn" onClick={() => void onExportSession(selected.id)}>
                  Export JSON
                </button>
                <button className="btn btnDanger" onClick={() => void onDeleteSession(selected.id)}>
                  Delete
                </button>
              </div>
            </div>

            <div className="tabsToolbar">
              <div className="tabsToolbarLeft">
                <input
                  className="input"
                  placeholder="Search tabs in this session…"
                  value={tabSearch}
                  onChange={(e) => setTabSearch(e.target.value)}
                />
                <button
                  className="btn"
                  onClick={() => {
                    const cur = getSelectedIndices(selected.id);
                    const filtered = getFilteredTabIndices(selected.items, tabSearch);
                    for (const idx of filtered) cur.add(idx);
                    setSelectedIndices(selected.id, cur);
                  }}
                >
                  Select all filtered
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setSelectedIndices(selected.id, new Set());
                  }}
                >
                  Select none
                </button>
              </div>
              <div className="tabsToolbarRight">
                <label className="row" style={{ gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={showOnlySelected}
                    onChange={(e) => setShowOnlySelected(e.target.checked)}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    show only selected
                  </span>
                </label>
                <span className="pill">
                  selected {getSelectedIndices(selected.id).size}/{selected.items.length}
                </span>
              </div>
            </div>

            <div className="items">
              {(() => {
                const selectedSet = getSelectedIndices(selected.id);
                const indices = getFilteredTabIndices(selected.items, tabSearch);
                const filtered = showOnlySelected
                  ? indices.filter((idx) => selectedSet.has(idx))
                  : indices;

                if (filtered.length === 0) {
                  return <div className="empty">No tabs match your filter.</div>;
                }

                return filtered.map((idx) => {
                  const it = selected.items[idx];
                  const checked = selectedSet.has(idx);
                  return (
                    <div key={`${it.url}_${idx}`} className="tabRow">
                      <input
                        className="tabRowCheckbox"
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleSelected(selected.id, idx, e.target.checked)}
                      />
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
                    <button className="btn" onClick={() => void onOpenTab(it.url, false)}>
                      Open tab
                    </button>
                    <button className="btn" onClick={() => void onOpenTab(it.url, true)}>
                      Open bg
                    </button>
                  </div>
                </div>
                  );
                });
              })()}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
