import { describe, expect, it } from 'vitest';
import { isRestrictedUrl } from '@/shared/url';

describe('isRestrictedUrl', () => {
  it('allows http and https', () => {
    expect(isRestrictedUrl('https://example.com')).toBe(false);
    expect(isRestrictedUrl('http://example.com/path')).toBe(false);
  });

  it('blocks browser-internal schemes and non-http(s) by default', () => {
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl('edge://settings')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abc/pages/manager/index.html')).toBe(true);
    expect(isRestrictedUrl('view-source:https://example.com')).toBe(true);

    // Default-safe behavior: treat other schemes as restricted.
    expect(isRestrictedUrl('file:///Users/me/test.html')).toBe(true);
    expect(isRestrictedUrl('data:text/plain,hi')).toBe(true);
    expect(isRestrictedUrl('blob:https://example.com/123')).toBe(true);
  });

  it('treats empty/invalid values as restricted', () => {
    expect(isRestrictedUrl('')).toBe(true);
    expect(isRestrictedUrl('   ')).toBe(true);
    expect(isRestrictedUrl('not a url')).toBe(true);
  });
});

