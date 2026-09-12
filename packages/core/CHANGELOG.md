# @stacknav/core

## 0.4.0

### Minor Changes

- [#20](https://github.com/VaggelisKa/stack-navigation-animation/pull/20) [`4d0db4b`](https://github.com/VaggelisKa/stack-navigation-animation/commit/4d0db4bc30fd10e4a56bfdea0dabacb1bc5093be) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Follow the platform's own push/pop, not only iOS's.
  
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

- [#18](https://github.com/VaggelisKa/stack-navigation-animation/pull/18) [`8c155b3`](https://github.com/VaggelisKa/stack-navigation-animation/commit/8c155b341a612ffe2a06d7b3b060a073f2aa113d) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Animate on handhelds only, without app code: `provideStackNav({ animated: 'touch' })`
  animates where the primary pointer is coarse and navigates instantly elsewhere,
  asked again before every navigation. `animated` also takes a predicate, for a
  user setting or a width breakpoint. The core exports the two media queries
  behind it, `isTouchPrimary()` and `matchesMedia()`, which is also how the swipe
  back is limited to touch: `gesture: isTouchPrimary() ? {} : false`.
  
  `ResolvedStackNavConfig.animated` is now `() => boolean` rather than `boolean`,
  which only affects code reading `STACKNAV_CONFIG` itself.

- [#22](https://github.com/VaggelisKa/stack-navigation-animation/pull/22) [`a653541`](https://github.com/VaggelisKa/stack-navigation-animation/commit/a653541268d5acf341ee5f942397049aabc72f1b) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Remove the custom swipe-back gesture. `swipeBack` is now `'browser' | 'disabled'`;
  `'custom'` throws, and `createEdgePanGesture()`, the `EdgePanGesture` types and the
  `gesture` option (on `createNativeStack()`, `provideStackNav()` and `<sn-outlet />`)
  are gone, along with the `.sn-edge`, `.sn-swipe-custom`, `.sn-anywhere` and
  `.sn-can-pop` rules.
  
  Browser suppression uses `overscroll-behavior-x`, which Safari ignores for its edge
  swipe, so in a browser tab our recognizer ran alongside the browser's and read as two
  backs at once. `'disabled'` still requests suppression.
  
  `NavigationStack.beginInteractivePop()` is unchanged and is now the supported way to
  drive a finger-tracking pop: an app that owns the edge -- an installed PWA, a native
  webview -- supplies the pointer handling, and the Angular outlet syncs the router for
  the pop it emits exactly as before.
  
  **Migration:** drop `swipeBack: 'custom'` and any `gesture` option. To keep an
  interactive pop, drive `beginInteractivePop()` from your own pointer handling.

- [#16](https://github.com/VaggelisKa/stack-navigation-animation/pull/16) [`58ec776`](https://github.com/VaggelisKa/stack-navigation-animation/commit/58ec776388e9f711e97258c3515846035b09fc48) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Add `swipeBack: 'custom' | 'browser' | 'disabled'` with live mode switching and browser mode as the new default. Existing consumers should set `swipeBack: 'custom'` to keep custom swiping; gesture tuning alone no longer enables it. Custom and disabled modes request document-wide browser swipe suppression where supported, without blocking Back/Forward buttons. Release shared suppression on mode changes and destruction, cancel active drags safely, and keep native touch handling when custom swiping is off.
  
  Destroying a stack cancels queued navigation with `AbortError` and prevents late drag completion from remounting pages or emitting events. Navigation requested after destruction also rejects.

## 0.3.1

### Patch Changes

- [#15](https://github.com/VaggelisKa/stack-navigation-animation/pull/15) [`228b6ab`](https://github.com/VaggelisKa/stack-navigation-animation/commit/228b6ab3ff514841e5a3a060a81db835d719eb6e) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Disable browser-owned stack transitions when `prefers-reduced-motion: reduce` is active, including when the preference changes during an animation or an inline duration has already been applied.

- [#13](https://github.com/VaggelisKa/stack-navigation-animation/pull/13) [`bbc1b20`](https://github.com/VaggelisKa/stack-navigation-animation/commit/bbc1b20ac9ef4f5b68cbb928e61cd94dd346fbaa) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Process bubbling edge gestures once per pointer move, avoid repeated overlay setup and zero-distance animation layout, and resolve dim colour and shadow directly through CSS variables. Fix Bézier progress sampling for flat curves and resolve cancelled tweens without scheduling another frame.

## 0.3.0

### Minor Changes

- [#10](https://github.com/VaggelisKa/stack-navigation-animation/pull/10) [`1f61fd8`](https://github.com/VaggelisKa/stack-navigation-animation/commit/1f61fd81a480e806474d751c0a4a1c1c91117dfa) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Let CSS run the push/pop animation.
  
  The engine used to animate in JavaScript: a `requestAnimationFrame` loop that
  solved the bezier, read `clientWidth` and wrote three styles every frame. It now
  writes where the pages should end up and puts that phase's duration and curve in
  `--sn-t` / `--sn-e` on the container, and the browser interpolates between the
  two writes. A 500 ms push went from ~100 style writes to ~12, nothing measures
  layout any more, and `transform` and `opacity` stay on the compositor, so a busy
  main thread no longer stutters the transition.
  
  The tuning variables are unchanged: `--sn-duration`, `--sn-easing`,
  `--sn-parallax` and the rest are still read off the container when a phase
  starts, and still win over the JS options. They are simply spent on one CSS
  transition instead of sixty frames of JavaScript.
  
  Three things to know if you had gone past the defaults:
  
  - **A stylesheet you vendored needs updating.** The transition now lives in the
    engine's CSS: `.sn-page-upper` / `.sn-page-lower` carry the `transition` rules,
    `.sn-dim` and `.sn-edge` are classed, and `--sn-dir` signs the travel so
    right-to-left works. `injectStyles()` and `@stacknav/core/stacknav.css` are up
    to date; a copy you pasted somewhere is not.
  - **A custom `Transition` gets `apply` twice per phase, not once per frame.**
    Write the state at `p` declaratively and let CSS get there; keep it to
    `transform` and `opacity` to stay composited.
  - **A custom easing needs a CSS spelling.** `cubicBezier()` and `parseEasing()`
    attach one. A bare `(t) => number` has none, so the pages would run `linear`
    while `progress` reported your curve — give it a `css` property.
  
  Right-to-left containers work now, as a side effect of the geometry moving into
  CSS: `--sn-dir` signs the travel, the swipe strip sits on the reading-leading
  edge, and the gesture takes its direction from the same place, so back is a drag
  to the left there.
  
  `progress` still fires with `(lower, upper, p)`, but reporting it now costs a
  frame loop, so one only runs while something is subscribed. Chrome that only has
  to move with the pages can transition off `--sn-t` / `--sn-e` and the
  `sn-page-upper` / `sn-page-lower` classes instead, and stay on the compositor.
