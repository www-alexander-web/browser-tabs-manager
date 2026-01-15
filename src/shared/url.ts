export function isRestrictedUrl(url: string): boolean {
  const u = url.trim();
  return (
    u.startsWith('chrome://') ||
    u.startsWith('edge://') ||
    u.startsWith('about:') ||
    u.startsWith('chrome-extension://') ||
    u.startsWith('view-source:')
  );
}
