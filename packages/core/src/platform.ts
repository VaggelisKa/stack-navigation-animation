// Which native platform the page is running on, so the transition can follow
// that platform's own push/pop. Nothing here is certain: user agents lie, and
// desktop browsers are neither. iOS is the default when nothing is recognized,
// because that is the look most web apps expect from a stack transition.
// Where available, the User-Agent Client Hints `platform` is trusted first;
// falling back to the deprecated `navigator.platform` (and, for iPadOS
// pretending to be a Mac, `maxTouchPoints`) only when hints are absent or
// don't already answer the question.

export type Platform = 'ios' | 'android';

export function isIOSBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hints = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  if (hints?.platform) {
    if (hints.platform === 'iOS') return true;
    // Safari on iPad reports itself as macOS even in userAgentData, so fall
    // through to the touch-capable Mac check below for that one case.
    if (hints.platform !== 'macOS') return false;
  }
  return (
    /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const hints = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  if (hints?.platform) return hints.platform === 'Android';
  return /\bAndroid\b/.test(navigator.userAgent ?? '');
}

/** `android` on an Android browser, otherwise `ios`. */
export function detectPlatform(): Platform {
  return !isIOSBrowser() && isAndroidBrowser() ? 'android' : 'ios';
}
