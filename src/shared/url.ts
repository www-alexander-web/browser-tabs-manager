export function isRestrictedUrl(url: string): boolean {
  /**
   * Manifest V3 extensions cannot reliably re-open / manage many non-http(s) URLs:
   * - browser-internal pages: chrome://, edge://, about:
   * - extension pages: chrome-extension://
   * - derived URLs: view-source:
   *
   * Default policy:
   * - allow only http(s)
   * - treat everything else as restricted (including file:, blob:, data:, chrome-search:, etc.)
   *
   * Note: file: URLs can be restorable only when the extension has explicit access
   * (“Allow access to file URLs” toggle) and appropriate permissions; we default to skipping.
   */
  const u = url.trim();
  if (!u) return true;

  const lower = u.toLowerCase();
  if (
    lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('about:') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('view-source:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(u);
    return !(parsed.protocol === 'http:' || parsed.protocol === 'https:');
  } catch {
    // Not a valid absolute URL (or a special internal scheme). Skip to be safe.
    return true;
  }
}
