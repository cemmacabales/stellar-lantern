import { describe, it, expect } from 'vitest';
import { parseOpenLink } from '@core/miniapps/openLink';

const link = (url: string) => `lantern://open?url=${encodeURIComponent(url)}`;

describe('lantern://open links', () => {
  it('opens an https URL as given', () => {
    expect(parseOpenLink(link('https://centient.work/'))).toBe('https://centient.work/');
    expect(parseOpenLink(link('https://centient.work/jobs?x=1#top'))).toBe('https://centient.work/jobs?x=1#top');
  });

  it('opens plain http only on loopback, for a local dev server', () => {
    expect(parseOpenLink(link('http://127.0.0.1:3000/'))).toBe('http://127.0.0.1:3000/');
    expect(parseOpenLink(link('http://localhost:3000/'))).toBe('http://localhost:3000/');
    expect(parseOpenLink(link('http://centient.work/'))).toBeNull();
    expect(parseOpenLink(link('http://10.0.2.2:3000/'))).toBeNull();
  });

  it('refuses other schemes in the url', () => {
    expect(parseOpenLink(link('javascript:alert(1)'))).toBeNull();
    expect(parseOpenLink(link('file:///sdcard/x.html'))).toBeNull();
    expect(parseOpenLink(link('data:text/html,hi'))).toBeNull();
  });

  it('ignores links that are not lantern://open with a url', () => {
    expect(parseOpenLink('lantern://open')).toBeNull();
    expect(parseOpenLink('lantern://other?url=https%3A%2F%2Fcentient.work')).toBeNull();
    expect(parseOpenLink('https://centient.work/?url=https%3A%2F%2Fx.io')).toBeNull();
    expect(parseOpenLink('lantern://open?url=not%20a%20url')).toBeNull();
    expect(parseOpenLink('not a link')).toBeNull();
  });
});
