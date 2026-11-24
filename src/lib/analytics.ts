import type { BeforeSendEvent } from '@vercel/analytics';

/** Analytics needs page identity, without arbitrary query, fragment, or path content. */
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.url.length > 8192) return null;
  try {
    const url = new URL(event.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const path = url.pathname.replace(/\/$/, '');
    url.pathname = ['/feedback','/about'].includes(path) ? path : '/';
    url.search = '';
    url.hash = '';
    return { ...event, url: url.href };
  } catch {
    return null;
  }
}
