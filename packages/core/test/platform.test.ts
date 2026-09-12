import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, isAndroidBrowser, isIOSBrowser } from '../src/platform.ts';
import { createNativeTransition, nativeTransitionPreset } from '../src/native-transition.ts';
import { easings } from '../src/animate.ts';

const withNavigator = (nav: object | undefined) => {
  if (nav === undefined) delete (globalThis as { navigator?: unknown }).navigator;
  else Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
};

afterEach(() => withNavigator(undefined));

test('without a navigator nothing is recognized and iOS is the default', () => {
  assert.equal(isIOSBrowser(), false);
  assert.equal(isAndroidBrowser(), false);
  assert.equal(detectPlatform(), 'ios');
});

test('an Android user agent is Android', () => {
  withNavigator({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36' });
  assert.equal(isAndroidBrowser(), true);
  assert.equal(detectPlatform(), 'android');
});

test('client hints are trusted over the user agent string', () => {
  withNavigator({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0', userAgentData: { platform: 'Android' } });
  assert.equal(detectPlatform(), 'android');
  withNavigator({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/128.0', userAgentData: { platform: 'Windows' } });
  assert.equal(isAndroidBrowser(), false, 'a hint that names another platform wins');
});

test('iPhone, iPad and desktop browsers all resolve to iOS', () => {
  withNavigator({ platform: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 });
  assert.equal(isIOSBrowser(), true);
  assert.equal(detectPlatform(), 'ios');
  withNavigator({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 });
  assert.equal(isIOSBrowser(), true, 'iPadOS reports itself as a Mac with touch');
  withNavigator({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0', maxTouchPoints: 0 });
  assert.equal(detectPlatform(), 'ios', 'nothing recognized falls back to iOS');
});

test('the transition takes the detected platform and its preset', () => {
  withNavigator({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/128.0' });
  const t = createNativeTransition();
  assert.equal(t.options.platform, 'android');
  assert.deepEqual(t.options, { ...nativeTransitionPreset('android'), platform: 'android' });
  assert.equal(t.resolved.platform, 'android');
  assert.equal(t.duration, 450);
  assert.equal(t.ease, easings.android);
  assert.equal(t.settle({ remainingPx: 100, velocity: 1000 }).ease, easings.androidSettle);
});

test('an explicit platform overrides detection, and explicit options override the preset', () => {
  withNavigator({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/128.0' });
  const t = createNativeTransition({ platform: 'ios', duration: 300 });
  assert.equal(t.options.platform, 'ios');
  assert.equal(t.options.travel, 1);
  assert.equal(t.options.fade, 1);
  assert.equal(t.duration, 300);
  assert.equal(t.ease, easings.ios);
  assert.equal(createNativeTransition({ platform: 'auto' }).options.platform, 'android');
});

test('the two presets differ in what the platforms differ in', () => {
  const ios = nativeTransitionPreset('ios');
  const android = nativeTransitionPreset('android');
  assert.equal(ios.travel, 1);
  assert.ok(android.travel < 0.5, 'Android slides a short way');
  assert.equal(android.parallax, android.travel, 'the whole scene shifts together');
  assert.equal(android.fade, 0);
  assert.equal(android.dimMax, 0);
  assert.equal(android.shadow, 'none');
  assert.equal(android.settleMin, ios.settleMin, 'the gesture bounds are shared');
});
