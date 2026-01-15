import React, { useEffect, useState } from 'react';
import type { Settings } from '@/shared/types';
import { getSettings, setSettings } from '@/shared/storage';
import { useToast } from '@/pages/ui/toast';

function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export function OptionsApp() {
  const toast = useToast();
  const [settings, setLocalSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!isExtensionContext()) return;
    void (async () => {
      setLocalSettings(await getSettings());
    })();
  }, []);

  if (!isExtensionContext()) {
    return (
      <div style={{ padding: 18 }}>
        <div style={{ maxWidth: 720 }} className="toast toast--info">
          Open this page via the installed extension. Vite dev server doesn’t provide{' '}
          <code>chrome.*</code> APIs.
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: 18 }}>
        <div className="toast toast--info">Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 18, maxWidth: 820 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <img src={chrome.runtime.getURL('icons/icon32.png')} width={28} height={28} alt="BTM" />
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Options</div>
          <div style={{ color: 'var(--muted)' }}>Basic capture settings</div>
        </div>
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 14,
          padding: 14
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.keepActiveTab}
              onChange={(e) => setLocalSettings({ ...settings, keepActiveTab: e.target.checked })}
            />
            Keep active tab (don’t close it)
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.excludePinnedTabs}
              onChange={(e) =>
                setLocalSettings({ ...settings, excludePinnedTabs: e.target.checked })
              }
            />
            Exclude pinned tabs
          </label>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Session name prefix</div>
            <input
              className="input"
              value={settings.sessionNamePrefix}
              onChange={(e) => setLocalSettings({ ...settings, sessionNamePrefix: e.target.value })}
              placeholder="Session"
            />
            <div style={{ color: 'var(--muted)', marginTop: 6, fontSize: 12 }}>
              Title will be “{settings.sessionNamePrefix || 'Session'} — YYYY-MM-DD HH:mm” in your
              locale.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            className="btn btnPrimary"
            onClick={async () => {
              try {
                await setSettings(settings);
                toast.push('success', 'Saved');
              } catch (e) {
                toast.push('error', e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Save
          </button>
          <button
            className="btn"
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL('pages/manager/index.html') })
            }
          >
            Back to Manager
          </button>
        </div>
      </div>
    </div>
  );
}
