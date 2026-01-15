import type { CaptureInfo } from '@/shared/types';

export type CaptureCurrentWindowRequest = { type: 'CAPTURE_CURRENT_WINDOW' };
export type OpenManagerRequest = { type: 'OPEN_MANAGER' };
export type OpenOptionsRequest = { type: 'OPEN_OPTIONS' };
export type GetLastCaptureRequest = { type: 'GET_LAST_CAPTURE' };

export type BackgroundRequest =
  | CaptureCurrentWindowRequest
  | OpenManagerRequest
  | OpenOptionsRequest
  | GetLastCaptureRequest;

export type CaptureCurrentWindowResponse = {
  ok: boolean;
  error?: string;
  lastCapture: CaptureInfo | null;
};

export type OpenManagerResponse = { ok: true };
export type OpenOptionsResponse = { ok: true };
export type GetLastCaptureResponse = { lastCapture: CaptureInfo | null };

export type BackgroundResponseByType = {
  CAPTURE_CURRENT_WINDOW: CaptureCurrentWindowResponse;
  OPEN_MANAGER: OpenManagerResponse;
  OPEN_OPTIONS: OpenOptionsResponse;
  GET_LAST_CAPTURE: GetLastCaptureResponse;
};

function chromeLastErrorMessage(): string | undefined {
  const err = chrome.runtime?.lastError;
  return err?.message;
}

function isExtensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function';
}

export async function sendMessage<T extends BackgroundRequest>(
  msg: T
): Promise<BackgroundResponseByType[T['type']]> {
  if (!isExtensionRuntime()) {
    throw new Error('Extension context required (chrome.runtime is unavailable)');
  }
  return await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: BackgroundResponseByType[T['type']]) => {
      const err = chromeLastErrorMessage();
      if (err) return reject(new Error(err));
      resolve(response);
    });
  });
}

