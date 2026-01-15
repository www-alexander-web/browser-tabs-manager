/* Promise helpers around chrome.* callback APIs */

export function chromeLastErrorMessage(): string | undefined {
  const err = chrome.runtime?.lastError;
  return err?.message;
}

export function runtimeGetURL(path: string): string {
  return chrome.runtime.getURL(path);
}

export async function storageLocalGet<T extends Record<string, unknown>>(
  keys: string[] | string
): Promise<Partial<T>> {
  return await new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(items as Partial<T>);
    });
  });
}

export async function storageLocalSet(items: Record<string, unknown>): Promise<void> {
  return await new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve();
    });
  });
}

export async function storageLocalRemove(keys: string[] | string): Promise<void> {
  return await new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve();
    });
  });
}

export async function windowsGetCurrent(): Promise<chrome.windows.Window> {
  return await new Promise((resolve, reject) => {
    chrome.windows.getCurrent({}, (win) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(win);
    });
  });
}

export async function windowsCreate(
  createData: chrome.windows.CreateData
): Promise<chrome.windows.Window> {
  return await new Promise((resolve, reject) => {
    chrome.windows.create(createData, (win) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(win);
    });
  });
}

export async function tabsQuery(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return await new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(tabs);
    });
  });
}

export async function tabsRemove(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  return await new Promise((resolve, reject) => {
    chrome.tabs.remove(tabIds, () => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve();
    });
  });
}

export async function tabsCreate(
  createProperties: chrome.tabs.CreateProperties
): Promise<chrome.tabs.Tab> {
  return await new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      const msg = chromeLastErrorMessage();
      if (msg) return reject(new Error(msg));
      resolve(tab);
    });
  });
}
