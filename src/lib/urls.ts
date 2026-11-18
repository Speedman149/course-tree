/** Official academic links accept HTTPS Technion hosts, without embedded credentials. */
export function officialSourceURL(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    const officialHost = url.hostname === 'technion.ac.il' || url.hostname.endsWith('.technion.ac.il');
    if (url.protocol !== 'https:' || !officialHost || url.username || url.password || url.port) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
