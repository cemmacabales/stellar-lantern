// `lantern://open?url=…` — a link another app (Chrome, usually) fires to open a
// dApp in the Apps tab. A site that knows Lantern is installed links to
//
//   intent://open?url=<encoded URL>#Intent;scheme=lantern;package=com.lantern.wallet;S.browser_fallback_url=<same URL>;end
//
// and Android hands `lantern://open?url=…` to MainActivity. The URL then opens
// exactly as if it had been typed into the Apps URL bar: same sandbox, same
// scan-gated bridge, "Unverified" chip. The link grants nothing else.

/** Hosts a plain-http dApp link may name: this device's loopback, for local development. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The dApp URL an open link carries, or null when it isn't one. Only `https:`
 * URLs open, plus `http:` on loopback so a developer can point Lantern at a
 * local server (`adb reverse`); anything else is dropped.
 */
export function parseOpenLink(raw: string): string | null {
  let link: URL;
  try {
    link = new URL(raw);
  } catch {
    return null;
  }
  // `lantern://open?…` parses with host "open"; tolerate `lantern:open?…` too.
  if (link.protocol !== 'lantern:') return null;
  const target = link.host || link.pathname.replace(/^\/+/, '');
  if (target !== 'open') return null;

  const param = link.searchParams.get('url');
  if (!param) return null;
  let url: URL;
  try {
    url = new URL(param);
  } catch {
    return null;
  }
  if (url.protocol === 'https:') return url.href;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return url.href;
  return null;
}
