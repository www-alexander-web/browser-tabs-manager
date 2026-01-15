import React, { useEffect, useMemo, useState } from 'react';
import type { CaptureInfo } from '@/shared/types';
import { formatDateTime } from '@/shared/time';
import { useToast } from '@/pages/ui/toast';
import { sendMessage } from '@/shared/messages';
import '@/pages/popup/popup.css';

function getManifestVersionSafe(): string | undefined {
  try {
    return chrome?.runtime?.getManifest?.().version;
  } catch {
    return undefined;
  }
}

function normalizeCaptureInfo(info: CaptureInfo) {
  return {
    capturedCount: info.capturedCount ?? 0,
    skippedRestrictedCount: info.skippedRestrictedCount ?? 0,
    failedToCloseCount: info.failedToCloseCount ?? 0,
    createdAt: info.createdAt,
    debugDryRun: info.debugDryRun ?? false,
    error: info.error
  };
}

export function PopupApp() {
  const toast = useToast();
  const [lastCapture, setLastCapture] = useState<CaptureInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const version = useMemo(() => getManifestVersionSafe(), []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await sendMessage({ type: 'GET_LAST_CAPTURE' });
        setLastCapture(res.lastCapture);
      } catch (e) {
        // Popup might be opened outside extension context during dev.
        toast.push('error', e instanceof Error ? e.message : String(e));
      }
    })();
  }, [toast]);

  async function openManager() {
    await sendMessage({ type: 'OPEN_MANAGER' });
  }

  async function openOptions() {
    await sendMessage({ type: 'OPEN_OPTIONS' });
  }

  async function onSendTabs() {
    setBusy(true);
    try {
      const res = await sendMessage({ type: 'CAPTURE_CURRENT_WINDOW' });
      setLastCapture(res.lastCapture);

      if (!res.ok) {
        toast.push('error', res.error ?? 'Capture failed');
        return;
      }

      await openManager();
      window.close();
    } catch (e) {
      toast.push('error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const normalized = lastCapture ? normalizeCaptureInfo(lastCapture) : null;

  return (
    <div className="popup">
      <div className="popupHeader">
        <div className="popupTitle">Browser Tabs Manager</div>
        <div className="popupVersion">{version ? `v${version}` : ''}</div>
      </div>

      <div className="popupActions">
        <button className="btn btnPrimary" onClick={onSendTabs} disabled={busy}>
          {busy ? 'Sending…' : 'Send tabs to Manager'}
        </button>

        <div className="popupRow">
          <button className="btn" onClick={openManager} disabled={busy}>
            Open Manager
          </button>
          <button className="btn" onClick={openOptions} disabled={busy}>
            Open Options
          </button>
        </div>

        <button className="btn" onClick={openManager} disabled={busy}>
          Restore last session…
        </button>
      </div>

      <div className="statusCard">
        <div className="statusTitle">Last capture</div>
        {normalized ? (
          <>
            <div className="statusGrid">
              <div className="kv">
                <div className="k">Captured</div>
                <div className="v">{normalized.capturedCount}</div>
              </div>
              <div className="kv">
                <div className="k">Restricted skipped</div>
                <div className="v">{normalized.skippedRestrictedCount}</div>
              </div>
              <div className="kv">
                <div className="k">Failed to close</div>
                <div className="v">{normalized.failedToCloseCount}</div>
              </div>
              <div className="kv">
                <div className="k">Time</div>
                <div className="v">{formatDateTime(normalized.createdAt)}</div>
              </div>
            </div>
            {normalized.debugDryRun ? <div className="dryRunBadge">Dry run mode</div> : null}
            {normalized.error ? <div className="errorBanner">{normalized.error}</div> : null}
          </>
        ) : (
          <div className="statusTitle">No captures yet.</div>
        )}
      </div>

      <div className="popupFooter">
        <span className="hintKbd">Shortcut: Ctrl+Shift+Y / Cmd+Shift+Y</span>
      </div>
    </div>
  );
}

