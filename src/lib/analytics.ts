import type { BeforeSendEvent } from '@vercel/analytics';

/** Analytics needs page identity, without arbitrary query, fragment, or path content. */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.url.length > 8192) return null;
  try {
    const url = new URL(event.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.pathname = url.pathname.replace(/\/$/, '') === '/feedback' ? '/feedback' : '/';
    url.search = '';
    url.hash = '';
    return { ...event, url: url.href };
  } catch {
    return null;
  }
}
