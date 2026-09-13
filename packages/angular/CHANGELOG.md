# @stacknav/angular

## 0.4.0

### Minor Changes

- [#29](https://github.com/VaggelisKa/stack-navigation-animation/pull/29) [`9034db0`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9034db0ef3f8b275869be8771dc8367c02506f25) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - The animation now runs on Angular's own `<router-outlet>`. Nothing is swapped
  out.
  
  `<sn-outlet />` was a router outlet of its own: it implemented the outlet
  contract, created the page components, proxied `ActivatedRoute`, saved and
  restored nested outlet contexts and bound component inputs, all so it could keep
  the page that was leaving. That is now a directive on the outlet you already
  have:
  
  ```html
  <div style="height: 100dvh">
    <router-outlet stackNav />
  </div>
  ```
  
  The outlet keeps creating the pages, binding their inputs and hosting nested
  outlets; `stackNav` listens to it and moves the elements it made. Keeping a page
  alive is the router's own detach/attach mechanism, driven by
  `StackNavRouteReuseStrategy` (which `provideStackNav()` already installed), so
  the `ActivatedRoute` a page injected keeps emitting when it is reached again and
  a nested `<router-outlet>` inside a kept page is re-activated on its own. A
  nested `<router-outlet stackNav>` is suspended with its page and resumes, pages
  and all, when the page comes back. Direction
  resolution, the hints, the kept stack, the interactive pop and every option of
  `provideStackNav()` are unchanged.
  
  **Breaking.**
  
  - `StackNavOutlet` / `<sn-outlet>` is gone. Put `stackNav` (`StackNav`) on a
    `<router-outlet>`. The router places the pages next to the outlet, so the
    outlet's parent element is the stack: the pages' scroll container, which needs
    the height the outlet used to.
  - Its inputs moved with it and gained the prefix: `[stackNavTransition]`,
    `[stackNavSwipeBack]`; the `navigated` output is `(stackNavActivate)`. `name` and
    `routerOutletData` are the outlet's own again, and so are its `activate`,
    `deactivate`, `attach` and `detach` outputs.
  - `StackNavView` is `StackNavPage`, and carries the component `instance`
    rather than a `ComponentRef` (`el`, `key`, `routeRef` and `url` are as
    before). `StackNavActivation.view` is `.page`.
  - `StackNavActivatedRoute` is gone; the router advances the page's own
    `ActivatedRoute`.
  - `detachInactiveViews` is gone. A page beneath the top is a detached route
    handle now, so it is not change-detected until it is shown again, the way any
    detached route is.
  - `provideStackNav({ routeReuse: false })` now means "I provide a strategy that
    extends `StackNavRouteReuseStrategy` myself". Without the strategy the router
    destroys each page as it leaves and there is nothing to animate out; a
    development build says so once.
  - The `sn` prefix is not used in templates any more: the prefix already reads
    "stack nav", so `snStack` read as "stack nav stack". The directive and its
    inputs spell it out, as `cdkDropList` / `cdkDropListData` do.
  
  One consequence of using the router's mechanism: detaching takes a page's
  element out of the DOM and attaching puts it back. Scroll offsets inside the page
  are captured before and restored after, so scroll position survives as before;
  an `<iframe>` in a kept page reloads and a playing `<video>` pauses.

### Patch Changes

- Updated dependencies [[`15de15d`](https://github.com/VaggelisKa/stack-navigation-animation/commit/15de15d56fe9218c3963758780a55d5c3114768d), [`9034db0`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9034db0ef3f8b275869be8771dc8367c02506f25)]:
  - @stacknav/core@0.5.1

## 0.3.0

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

- [#26](https://github.com/VaggelisKa/stack-navigation-animation/pull/26) [`db17b7f`](https://github.com/VaggelisKa/stack-navigation-animation/commit/db17b7f21c03befdff2760b1963d79fff30c7bec) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - `provideStackNav()` is now the whole Angular setup. It installs
  `StackNavRouteReuseStrategy`, so a navigation that only changes params
  (`/items/1` → `/items/2`) is a page of its own and animates, instead of being
  silently reused by the router. Apps that provided the strategy by hand can drop
  that provider; `provideStackNav({ routeReuse: false })` keeps the router's own
  strategy, and a `RouteReuseStrategy` provided after `provideStackNav()` still
  wins.
  
  A development build also says once, in the console, when the outlet is 0px tall
  or when the router was left on its default `canceledNavigationResolution` -- the
  two setup mistakes that show up as a blank screen or a rewritten history entry
  rather than as an error. Both checks are folded out of a production build.

### Patch Changes

- Updated dependencies [[`0510dc7`](https://github.com/VaggelisKa/stack-navigation-animation/commit/0510dc7974d8ff11dab6237a8faa51a5aa87300e), [`f98807d`](https://github.com/VaggelisKa/stack-navigation-animation/commit/f98807da5512b7e82ba60e2973b4d77d8e842e09)]:
  - @stacknav/core@0.5.0

## 0.2.0

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

### Patch Changes

- Updated dependencies [[`4d0db4b`](https://github.com/VaggelisKa/stack-navigation-animation/commit/4d0db4bc30fd10e4a56bfdea0dabacb1bc5093be), [`8c155b3`](https://github.com/VaggelisKa/stack-navigation-animation/commit/8c155b341a612ffe2a06d7b3b060a073f2aa113d), [`a653541`](https://github.com/VaggelisKa/stack-navigation-animation/commit/a653541268d5acf341ee5f942397049aabc72f1b), [`58ec776`](https://github.com/VaggelisKa/stack-navigation-animation/commit/58ec776388e9f711e97258c3515846035b09fc48)]:
  - @stacknav/core@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`228b6ab`](https://github.com/VaggelisKa/stack-navigation-animation/commit/228b6ab3ff514841e5a3a060a81db835d719eb6e), [`bbc1b20`](https://github.com/VaggelisKa/stack-navigation-animation/commit/bbc1b20ac9ef4f5b68cbb928e61cd94dd346fbaa)]:
  - @stacknav/core@0.3.1

## 0.1.2

### Patch Changes

- Updated dependencies [[`1f61fd8`](https://github.com/VaggelisKa/stack-navigation-animation/commit/1f61fd81a480e806474d751c0a4a1c1c91117dfa)]:
  - @stacknav/core@0.3.0

## 0.1.1

### Patch Changes

- [#8](https://github.com/VaggelisKa/stack-navigation-animation/pull/8) [`9c60641`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9c606419044e6f4eb5aed5c486e7bb3b7eadc59e) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Fix the published package and take `@stacknav/core` as a regular dependency.
  
  The `files: ["dist"]` field was copied into the built `dist/package.json`, so the
  tarball packed from `dist` contained only the manifest and the README — none of
  the actual code. Dropping the field ships `fesm2022/` and `types/` as intended.
  
  `@stacknav/core` moves from `peerDependencies` to `dependencies`, published as a
  caret range rather than the exact pin that `workspace:*` resolved to. Installing
  `@stacknav/angular` now brings the matching core along with it.
