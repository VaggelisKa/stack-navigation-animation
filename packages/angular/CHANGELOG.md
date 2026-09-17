# @stacknav/angular

## 1.0.2

### Patch Changes

- [#51](https://github.com/VaggelisKa/stack-navigation-animation/pull/51) [`c189b9e`](https://github.com/VaggelisKa/stack-navigation-animation/commit/c189b9ef93c760395897c50164b6b7766b2032fb) - Point the published manifests at the repository. npm rejects a provenance
  attestation whose `repository.url` does not match the repository that built the
  tarball, and both manifests had no `repository` field at all, so the 0.6.1 /
  1.0.1 publish failed with E422. The packages now carry `repository`, `homepage`
  and `bugs`.
- Updated dependencies [[`c189b9e`](https://github.com/VaggelisKa/stack-navigation-animation/commit/c189b9ef93c760395897c50164b6b7766b2032fb)]:
  - @stacknav/core@0.6.2

## 1.0.1

### Patch Changes

- [#45](https://github.com/VaggelisKa/stack-navigation-animation/pull/45) [`6f13365`](https://github.com/VaggelisKa/stack-navigation-animation/commit/6f1336582d3b25045242d959b638a80167a65825) - Stop double-animating the browser's back button on iOS. Safari animates its own snapshot of the previous page during the edge swipe and only then fires `popstate`, so the pop the outlet ran on top of that played the transition a second time; `@stacknav/core`'s `attachBrowserHistory` has always defaulted `animateHistoryPop` off there, and the directive now agrees. A history-triggered navigation on an iOS browser is no longer animated by default, and a navigation that asks for it with `info: { stacknav: { animated: true } }` still is.
  
  The `animated` option's predicate now receives the navigation it is being asked about — `{ trigger, from, to }` — so an app can decide per navigation rather than only per device. A predicate that takes no arguments, which is all the option accepted before, keeps working unchanged.
  
  `watchScroll` also prunes itself. It records a scroll offset per scroller in a page, and only `restoreScroll` dropped elements the page had replaced, which runs when the page is reached again: a page that stays on screen for a long time while its scrollers churn — a virtual list, a tab strip — held every element it had ever scrolled. Recording now sweeps disconnected elements once the map outgrows any real page's scroller count, without walking the DOM on the scroll path.

- [#47](https://github.com/VaggelisKa/stack-navigation-animation/pull/47) [`497eaf9`](https://github.com/VaggelisKa/stack-navigation-animation/commit/497eaf975a7cd559ab0a1330674845a35fbb40ee) - Both packages now ship the MIT `LICENSE` inside their tarball and are published
  with npm provenance. The manifests have always said MIT, but the file the terms
  actually live in was only in the repository: anyone reading the package from a
  `node_modules` directory, a vendored copy or an offline mirror had the badge and
  not the text. The release workflow now signs each publish, so npm can show what
  commit and what workflow run a version was built from.

- [#50](https://github.com/VaggelisKa/stack-navigation-animation/pull/50) [`91170f1`](https://github.com/VaggelisKa/stack-navigation-animation/commit/91170f164f987f786dad933031a4cecba753c37a) - Back animates again. The previous release stopped animating any history-triggered navigation on an iOS browser, to avoid doubling up on the snapshot Safari slides across during its edge-swipe gesture. The reasoning held only for the swipe, and `popstate` never says that is what happened: the edge swipe, the browser's own Back button and an app calling `location.back()` from a back button of its own all reach the page as one event with one shape. Refusing all three to spare the one left every back in the app an instant cut with nothing moving, which is much the worse trade. It reached further than iPhones, too -- `isIOSBrowser()` answers for iPadOS as well, which reports itself as `MacIntel`, so any Mac reporting touch points was caught by a rule about a gesture it does not have.
  
  Every navigation animates by default again. An app that does want the swipe handled can say so itself, in the `animated` predicate, which is told what triggered the navigation: `animated: ({ trigger }) => !(trigger === 'history' && isIOSBrowser())`.
  
  `@stacknav/core`'s `attachBrowserHistory` still defaults `animateHistoryPop` to off on iOS browsers. That default predates this and is documented, so it is left alone, but it rests on the same reasoning and an app driving the stack itself may want to pass `animateHistoryPop: true`.
- Updated dependencies [[`497eaf9`](https://github.com/VaggelisKa/stack-navigation-animation/commit/497eaf975a7cd559ab0a1330674845a35fbb40ee), [`e40760c`](https://github.com/VaggelisKa/stack-navigation-animation/commit/e40760c97b1e927be8f929f5b66196676786efa9)]:
  - @stacknav/core@0.6.1

## 1.0.0

### Major Changes

- [#40](https://github.com/VaggelisKa/stack-navigation-animation/pull/40) [`6bd2f05`](https://github.com/VaggelisKa/stack-navigation-animation/commit/6bd2f05c2ce163f7edb23bb33bcf1c79a958015c) - Angular 22 is now required. The `@angular/*` peer ranges narrow from `>=19.0.0` to `^22.0.0`, and the fallbacks that existed only for older routers are gone.

### Minor Changes

- [#42](https://github.com/VaggelisKa/stack-navigation-animation/pull/42) [`9ffc602`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9ffc602be515721590cee58068e12ebcb26e9903) - Add opt-in focus management. With `manageFocus: true` the stack moves focus into the page arriving on top and gives it back to the revealed page on a pop, the way a native stack does; it is off by default and never takes focus that has moved outside the container.

### Patch Changes

- [#39](https://github.com/VaggelisKa/stack-navigation-animation/pull/39) [`acf1f01`](https://github.com/VaggelisKa/stack-navigation-animation/commit/acf1f013476a9497308b839f138a6af8a655d2c1) - `injectStyles(target?, { nonce })` now accepts a `ShadowRoot` as well as a `Document`, adopting a constructed sheet where `adoptedStyleSheets` is supported and falling back to a `<style>` element, and puts a `nonce` on that element for pages with a strict `style-src`. The Angular stack passes `CSP_NONCE` through and injects into the shadow root the stack is in.
- Updated dependencies [[`acf1f01`](https://github.com/VaggelisKa/stack-navigation-animation/commit/acf1f013476a9497308b839f138a6af8a655d2c1), [`7b42092`](https://github.com/VaggelisKa/stack-navigation-animation/commit/7b420924c0199a16d8c2762f2a7dbdfdf5125f02), [`9ffc602`](https://github.com/VaggelisKa/stack-navigation-animation/commit/9ffc602be515721590cee58068e12ebcb26e9903)]:
  - @stacknav/core@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [[`c4aacde`](https://github.com/VaggelisKa/stack-navigation-animation/commit/c4aacde9dd0409407bc8bdf86ff3d3266b9da86a)]:
  - @stacknav/core@0.5.2

## 0.5.0

### Minor Changes

- [#31](https://github.com/VaggelisKa/stack-navigation-animation/pull/31) [`77c34e1`](https://github.com/VaggelisKa/stack-navigation-animation/commit/77c34e1479c722fe893c6b0372d19ffb4ec25b63) Thanks [@VaggelisKa](https://github.com/VaggelisKa)! - Add the optional `StackNavFillViewport` directive. Put `stackNavFillViewport` on the stack's wrapper to fill the visible viewport below a shell header, without changing the shell or hard-coding its height. It follows layout and viewport changes and restores the original inline sizing on destruction.

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
