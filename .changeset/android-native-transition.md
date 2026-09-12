---
"@stacknav/core": minor
"@stacknav/angular": minor
---

Follow the platform's own push/pop, not only iOS's.

The transition now has two presets: the iOS one it always had, and the Android
framework's activity open/close (`activity_open_enter.xml` and friends since
Android 13): both pages slide 96 dp, about a quarter of a phone, over 450 ms on
`fast_out_extra_slow_in`, while the incoming page fades in, with no shadow or
dim. The curve is a path of two cubics, so it reaches CSS as `linear()`.
`platform: 'auto'` (the default) picks Android on an Android browser and iOS
everywhere else; `'ios'` and `'android'` force one. Two options carry the
difference and are CSS variables like the rest: `travel` (`--sn-travel`, how
far the upper page slides) and `fade` (`--sn-fade`, its opacity when closed).
`parseEasing` and `--sn-easing` accept `linear(…)`, and the keywords `android`
and `android-settle`.

The iOS-specific names are gone, since the look is no longer iOS-specific:

| Before | After |
| --- | --- |
| `createIOSStack`, `IOSStack`, `IOSStackOptions` | `createNativeStack`, `NativeStack`, `NativeStackOptions` |
| `createIOSTransition`, `IOSTransition`, `IOSTransitionOptions` | `createNativeTransition`, `NativeTransition`, `NativeTransitionOptions` |
| `IOS_TRANSITION_CSS_VARS` | `NATIVE_TRANSITION_CSS_VARS` |

New: `nativeTransitionPreset()`, `detectPlatform()`, `isAndroidBrowser()`,
`linearEasing()`, `easings.android`, `easings.androidSettle`. `isIOSBrowser()`
is unchanged. To keep exactly the old behaviour on every device, pass
`{ platform: 'ios' }`.
