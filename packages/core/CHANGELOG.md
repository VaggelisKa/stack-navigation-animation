# @stacknav/core

## 0.6.2

### Patch Changes

- [#51](https://github.com/VaggelisKa/stack-navigation-animation/pull/51) [`c189b9e`](https://github.com/VaggelisKa/stack-navigation-animation/commit/c189b9ef93c760395897c50164b6b7766b2032fb) - Point the published manifests at the repository. npm rejects a provenance
  attestation whose `repository.url` does not match the repository that built the
  tarball, and both manifests had no `repository` field at all, so the 0.6.1 /
  1.0.1 publish failed with E422. The packages now carry `repository`, `homepage`
  and `bugs`.

## 0.6.1

### Patch Changes

- [#47](https://github.com/VaggelisKa/stack-navigation-animation/pull/47) [`497eaf9`](https://github.com/VaggelisKa/stack-navigation-animation/commit/497eaf975a7cd559ab0a1330674845a35fbb40ee) - Both packages now ship the MIT `LICENSE` inside their tarball and are published
  with npm provenance. The manifests have always said MIT, but the file the terms
  actually live in was only in the repository: anyone reading the package from a
  `node_modules` directory, a vendored copy or an offline mirror had the badge and
  not the text. The release workflow now signs each publish, so npm can show what
  commit and what workflow run a version was built from.

- [#44](https://github.com/VaggelisKa/stack-navigation-animation/pull/44) [`e40760c`](https://github.com/VaggelisKa/stack-navigation-animation/commit/e40760c97b1e927be8f929f5b66196676786efa9) - Two pieces of hardening for the browsers and the moments the engine cannot control.
  
  Reading direction now has a fallback for browsers without `:dir()`. The rule that
  signs `--sn-dir` for RTL is written with `:dir(rtl)`, which asks for the element's
  resolved directionality and is the right question, but it needs Chrome 120 or
  Safari 16.4, while the sheet itself only needs cascade layers: Chrome 99, Safari
  15.4, Firefox 97. In between, the sheet loaded and that one rule was dropped, so an
  RTL stack pushed and swiped the wrong way. `[dir=rtl] .sn-container,
  .sn-container[dir=rtl]` now covers the attribute, which is how apps declare RTL in
  practice. It is a separate rule, because an unknown pseudo-class invalidates the
  whole selector list it appears in, and it sits inside
  `@supports not selector(:dir(rtl))`, so the approximation it makes -- `dir=auto`
  never matches an attribute selector, and an LTR island inside an RTL page matches
  the descendant form -- never reaches a browser that can answer exactly.
  
  The wait for a transition to finish is now bounded. The stack asks the browser when
  the pages have arrived and stays `busy` until told, with the click shield over the
  container and every queued operation behind it. An animation on an element the
  browser stops rendering part-way through -- a page hidden by an app's own CSS, a
  `display` change on an ancestor, a container detached and re-attached -- neither
  finishes nor is cancelled, and a stack awaiting one was stranded for the lifetime of
  the tab. The wait now also ends after half as long again as the phase plus 150 ms,
  which is far beyond what a late but real animation takes, and the operation
  completes normally from there. `animationsFinished()` takes the bound as an optional
  third argument; its default is still to wait indefinitely.

## 0.6.0

### Minor Changes

- [#39](https://github.com/VaggelisKa/stack-navigation-animation/pull/39) [`acf1f01`](https://github.com/VaggelisKa/stack-navigation-animation/commit/acf1f013476a9497308b839f138a6af8a655d2c1) - `injectStyles(target?, { nonce })` now accepts a `ShadowRoot` as well as a `Document`, adopting a constructed sheet where `adoptedStyleSheets` is supported and falling back to a `<style>` element, and puts a `nonce` on that element for pages with a strict `style-src`. The Angular stack passes `CSP_NONCE` through and injects into the shadow root the stack is in.

- [#38](https://github.com/VaggelisKa/stack-navigation-animation/pull/38) [`7b42092`](https://github.com/VaggelisKa/stack-navigation-animation/commit/7b420924c0199a16d8c2762f2a7dbdfdf5125f02) - Ship the engine stylesheet inside `@layer stacknav`, so an app's own CSS overrides it regardless of load order or specificity.

- [#42](https://github.com/VaggelisKa/stack-navigation-animation/pull/42) [`9ffc602`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9ffc602be515721590cee58068e12ebcb26e9903) - Add opt-in focus management. With `manageFocus: true` the stack moves focus into the page arriving on top and gives it back to the revealed page on a pop, the way a native stack does; it is off by default and never takes focus that has moved outside the container.

## 0.5.2

### Patch Changes

- [#35](https://github.com/VaggelisKa/stack-navigation-animation/pull/35) [`c4aacde`](https://github.com/VaggelisKa/stack-navigation-animation/commit/c4aacde9dd0409407bc8bdf86ff3d3266b9da86a) - Commit the start of a transition with a style resolution instead of a forced layout. A push no longer lays out the page it is mounting inside the navigation task: on an eight-deep stack of 600-row pages in Edge the synchronous main-thread work of a push drops from ~22 ms to ~11 ms, and a pop from ~9 ms to ~7 ms, with the same number of elements restyled and the same painting. The layout still happens, in the browser's own frame, where it was always going to be needed.

## 0.5.1

### Patch Changes

- [#27](https://github.com/VaggelisKa/stack-navigation-animation/pull/27) [`15de15d`](https://github.com/VaggelisKa/stack-navigation-animation/commit/15de15d56fe9218c3963758780a55d5c3114768d) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Shorten the Android page fade independently of the slide to prevent prolonged content overlap during navigation.

- [#29](https://github.com/VaggelisKa/stack-navigation-animation/pull/29) [`9034db0`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9034db0ef3f8b275869be8771dc8367c02506f25) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - The upper page of a transition now paints above the lower one by `z-index`
  (`.sn-page-upper { z-index: 1 }`, inside a container that is its own stacking
  context via `isolation: isolate`) rather than by document order. A host that
  lets something else place the page elements -- a framework's router outlet, which
  inserts each page next to itself -- no longer has to keep them sorted for a push
  to land on top.
  
  The `z-index` changes nothing for a host that appends pages in order. The
  stacking context is new for every host: chrome placed as a direct child of the
  container with `position: fixed` and a large `z-index` -- a toast or a sheet
  next to the pages rather than inside one -- now stacks within the container
  instead of above everything after it in the document. Page content is not
  affected; each page was already a stacking context of its own.

## 0.5.0

### Minor Changes

- [#25](https://github.com/VaggelisKa/stack-navigation-animation/pull/25) [`0510dc7`](https://github.com/VaggelisKa/stack-navigation-animation/commit/0510dc7974d8ff11dab6237a8faa51a5aa87300e) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Deciding push / pop / replace no longer starts with an array of strategies.
  
  `provideStackNav({ direction: [...] })` asked every app to spell out the whole
  default chain — `[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]`
  — just to insert one rule or change one option, and to know where in that chain
  its rule belonged. In practice there is only one sensible slot: after the three
  things the library is sure about (an explicit hint, the browser's back and
  forward buttons, a page still kept alive beneath this one) and before the two it
  guesses from (route numbers, the route tree). So that slot is now the API:
  
  ```ts
  provideStackNav({
    direction: ({ to }) => (to.data?.['tab'] ? 'replace' : undefined), // your one rule
    siblings: 'push',                                                  // what a tie means
  });
  ```
  
  `siblings` replaces reaching for `fromLevel({ sameLevel })` and
  `fromTree({ sameDepth })` separately; it sets both.
  
  **Breaking.** `direction` no longer accepts an array or a resolver — an array
  now throws with a message pointing here. An app that genuinely needs its own
  order passes a resolver as `resolveDirection` instead, built from the strategies
  `@stacknav/core` still exports:
  
  ```ts
  provideStackNav({ resolveDirection: createDirectionResolver([myRule, byHint(), byRouteTree()], 'push') });
  ```
  
  Those strategies were renamed to say what they read: `fromHint` → `byHint`,
  `fromHistory` → `byBrowserHistory`, `fromStack` → `byKeptStack`, `fromLevel` →
  `byRouteNumber`, `fromTree` → `byRouteTree`. Their `sameLevel` / `sameDepth`
  options are both spelled `siblings` now, and `defaultStrategies()` takes
  `{ direction, siblings }` to build the standard order with a host's rule in it.
  The types `LevelOptions` and `TreeOptions` merged into `SiblingOptions`.

- [#23](https://github.com/VaggelisKa/stack-navigation-animation/pull/23) [`f98807d`](https://github.com/VaggelisKa/stack-navigation-animation/commit/f98807da5512b7e82ba60e2973b4d77d8e842e09) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Starting a phase no longer costs a style recalculation of every kept page.
  
  Two things in the stylesheet changed inherited properties on every transition,
  and inherited properties fan out: the browser re-resolves the style of every
  element beneath, which on a deep stack of heavy pages is every row of every
  page, hidden ones included, twice per push or pop. Measured in Chromium on an
  eight-deep stack of 600-row pages, the main-thread work of starting a push fell
  from about 140 ms to about 20 ms, of starting a pop from about 110 ms to about
  10 ms, and of starting an interactive pop from about 60 ms to about 7 ms. The
  cost is now independent of how many pages are kept.
  
  - `--sn-t` and `--sn-e` are still written on the container and still reach the
    page elements, but the stylesheet pins them on each page's children
    (`:where(.sn-page) > * { --sn-t: 0s; --sn-e: linear }`). Chrome inside a page
    that transitions off them needs one rule to lift the barrier, and pays the
    recalculation for that page knowingly:
    `.sn-page > * { --sn-t: inherit; --sn-e: inherit }`. Chrome beside the pages,
    and the pages themselves, are unaffected.
  - `.sn-busy` no longer sets `user-select: none` on the container and
    `pointer-events: none` on the pages. A pseudo-element shield
    (`.sn-busy::after`) covers the container instead. Clicks still do not land on
    a page mid-transition, pointer events still target the container, and a drag
    still does not start a selection. One visible difference: a selection that
    already existed when an interactive pop began stays visible during the drag
    instead of being hidden until it ends.

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
