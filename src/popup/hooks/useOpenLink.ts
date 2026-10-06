import { useSyncExternalStore } from 'react';
import { isNativePlatform } from '@shared/kv';
import { parseOpenLink } from '@core/miniapps/openLink';

// A dApp URL handed to Lantern by a `lantern://open` link (see
// core/miniapps/openLink.ts), held until the Apps tab opens it. It lives outside
// React because the link usually arrives while the wallet is locked — the app
// locks on pause, and following a link from Chrome resumes it — and the home
// shell (with the Apps tab) only mounts once the user has unlocked.

let pending: string | null = null;
const listeners = new Set<() => void>();

function setPending(url: string | null) {
  pending = url;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The dApp URL waiting to open, or null. Re-renders when one arrives or is taken. */
export function usePendingOpenLink(): string | null {
  return useSyncExternalStore(subscribe, () => pending);
}

/** Claim the waiting URL (once): the caller opens it. */
export function takeOpenLink(): string | null {
  const url = pending;
  if (url !== null) setPending(null);
  return url;
}

/**
 * Start listening for open links, on native only: the link that launched the
 * app, and any that arrive while it runs (MainActivity is singleTask, so a
 * second link resumes this instance). Anything that isn't a valid open link is
 * ignored. Call once, at startup.
 */
export function listenForOpenLinks(): void {
  if (!isNativePlatform()) return;
  void (async () => {
    try {
      const { App } = await import('@capacitor/app');
      await App.addListener('appUrlOpen', ({ url }) => {
        const target = parseOpenLink(url);
        if (target) setPending(target);
      });
      const launch = await App.getLaunchUrl();
      const target = launch?.url ? parseOpenLink(launch.url) : null;
      if (target) setPending(target);
    } catch {
      /* @capacitor/app unavailable — links simply don't open anything */
    }
  })();
}
