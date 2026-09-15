# @stacknav/core

Native-style push and pop navigation for any web app. The package keeps pages
mounted in a stack and animates them with the iOS transition, or the Android
transition on Android. It has no framework or runtime dependencies.

Use it directly when your app owns navigation. Angular apps can use
[`@stacknav/angular`](../angular) instead.

## Install

```sh
pnpm add @stacknav/core
```

## Quick start

```ts
import {
  attachBrowserHistory,
  createNativeStack,
  injectStyles,
} from '@stacknav/core';

injectStyles();

const stack = createNativeStack({
  container: document.querySelector<HTMLElement>('#app')!,
});

await stack.push(homePage(), { animated: false });
attachBrowserHistory(stack);

await stack.push(detailsPage());
await stack.pop();
```

The container needs a height. Each page is a normal element created and styled
by your app. stacknav positions pages inside the container and keeps inactive
pages mounted, preserving their scroll position, form values, and UI state.

`injectStyles()` adds the required CSS once. You can import
`@stacknav/core/stacknav.css` instead.

## Navigation stack

`createNativeStack({ container, transition?, swipeBack?, manageFocus? })`
returns a `NavigationStack` configured with the native transition.

`manageFocus` is off by default. Turn it on and the stack moves focus the way a
native stack does: into the page arriving on top, and back to whatever had focus
inside a page when that page is revealed again. A page with nothing focusable of
its own is given `tabindex="-1"` while it is mounted, and focus that has already
moved outside the container is never taken back.

| Member | Purpose |
| --- | --- |
| `push(page, options?)` | Adds a page. A mounted page is moved to the top. |
| `pop(options?)` | Removes the top page, unless it is the root. |
| `popTo(depth, options?)` | Pops until the requested number of pages remain. |
| `popWith(page, options?)` | Pops while revealing a supplied or previously mounted page. |
| `replace(page, options?)` | Replaces the top page without a transition. |
| `present(page, direction, options?)` | Applies a resolved `push`, `pop`, or `replace`. |
| `remove(page)` | Removes a mounted page without a transition. |
| `reset(pages)` | Replaces the entire stack without a transition. |
| `beginInteractivePop()` | Starts a pop controlled by your own gesture. |
| `on(event, listener)` | Subscribes to stack and transition events. |
| `destroy()` | Removes every page and releases the stack. |

Pages may be elements or factories. Navigation options can include `animated`,
`data`, `key`, and `source`. Operations are serialized, so a call made during a
transition waits for the current transition to finish.

State is available through `depth`, `top`, `entries`, `busy`, `canPop()`, and
`entryOf()`. Events are `push`, `pop`, `replace`, `reset`, `transitionstart`,
`progress`, and `transitionend`.

`destroy()` is terminal. Pending and later navigation promises reject with an
`AbortError`.

### Interactive pop

The package does not install a pointer recognizer. Apps that own the gesture,
such as installed PWAs and native webviews, can drive one directly:

```ts
const pop = stack.beginInteractivePop();

pop?.update(progress); // 1 is open; 0 is popped
await pop?.finish({ complete: progress < 0.5, velocity });
```

In a normal browser tab, keep `swipeBack: 'browser'` so the browser owns its
native edge gesture. `swipeBack: 'disabled'` requests document-wide suppression
with `overscroll-behavior-x`, but browsers and operating systems may ignore it.
You can change the policy with `stack.setSwipeBack(mode)`.

## Direction resolution

Router integrations can resolve a navigation to `push`, `pop`, or `replace`:

```ts
import { createDirectionResolver } from '@stacknav/core';

const resolve = createDirectionResolver();

const direction = resolve({
  from: { key: '/items', segments: ['items'] },
  to: { key: '/items/42', segments: ['items', '42'], level: 2 },
  trigger: 'imperative',
  stack: ['/', '/items'],
});
```

The default strategies run in this order:

| Strategy | Resolves from |
| --- | --- |
| `byHint()` | An explicit direction on the navigation. |
| `byBrowserHistory()` | Browser back or forward history. |
| `byKeptStack()` | A target already kept beneath the current page. |
| `byRouteNumber()` | Numeric route levels. |
| `byRouteTree()` | Ancestor, descendant, and sibling route segments. |

`defaultStrategies({ direction, siblings })` creates that list and can insert
one application rule before the route-number and route-tree guesses.
`createDirectionResolver(strategies, fallback)` accepts a custom list.
`always(direction)` creates an unconditional strategy, and `segmentsOf(url)`
creates route segments from a URL.

## Native transition

`createNativeTransition(options?)` selects the iOS or Android preset from the
browser. Set `platform: 'ios'` or `'android'` to force one. The transition
honors `prefers-reduced-motion`.

| Option | CSS property | iOS default | Android default |
| --- | --- | --- | --- |
| `duration` | `--sn-duration` | `500` ms | `450` ms |
| `ease` | `--sn-easing` | iOS curve | Android curve |
| `travel` | `--sn-travel` | `1` | `0.25` |
| `parallax` | `--sn-parallax` | `0.3` | `0.25` |
| `fade` | `--sn-fade` | `1` | `0` |
| `dimColor` | `--sn-dim-color` | `#000` | `#000` |
| `dimMax` | `--sn-dim-max` | `0.1` | `0` |
| `shadow` | `--sn-shadow` | iOS edge shadow | `none` |
| `settleMin` / `settleMax` | `--sn-settle-min` / `--sn-settle-max` | `120` / `400` ms | `120` / `400` ms |
| `settleEase` | `--sn-settle-easing` | iOS settle curve | Android settle curve |
| `settleVelocityFloor` | `--sn-settle-velocity-floor` | `900` px/s | `900` px/s |
| `timeScale` | `--sn-time-scale` | `1` | `1` |

CSS properties override JavaScript options and are read at the start of each
transition:

```css
:root {
  --sn-duration: 340ms;
  --sn-parallax: 20%;
}

.theme-flat {
  --sn-dim-max: 0;
  --sn-shadow: none;
}
```

Durations accept `ms`, `s`, or bare milliseconds. Ratios accept decimals or
percentages. Invalid values fall back to the JavaScript option. Call
`transition.refresh()` after changing options during a transition;
`transition.resolved` contains the values currently in force.

`nativeTransitionPreset(platform)` returns a preset, and
`NATIVE_TRANSITION_CSS_VARS` maps transition options to CSS properties.

## Browser history

`attachBrowserHistory(stack, options?)` mirrors the stack depth into
`history.state` and returns a detach function. On iOS, history pops are instant
by default because the browser already animates its own snapshot. Use
`animateHistoryPop` to override that behavior and `onForward(targetDepth)` to
restore a page for forward navigation.

## Custom transitions and chrome

Pass a `Transition` to `new NavigationStack({ container, transition })` to use a
different animation. A transition defines `duration`, `ease`, `settle()`, and
`apply()`, with optional `begin()` and `end()` hooks.

During a transition, the container exposes `--sn-t` and `--sn-e`; the active
pages receive `sn-page-upper` and `sn-page-lower`. Headers, tab bars, and other
chrome can use those values in CSS and remain compositor-driven. Subscribe to
`progress` only when you need the numeric progress value.

## Utilities

The package also exports:

- Platform helpers: `detectPlatform`, `isIOSBrowser`, `isAndroidBrowser`.
- Easing helpers: `cubicBezier`, `linearEasing`, `easings`, `cssEasing`.
- CSS parsing helpers: `cssVars`, `parseTime`, `parseNumber`, `parseRatio`,
  `parseEasing`.
- Animation helpers: `tween`, `commitStyles`, `animationsFinished`,
  `prefersReducedMotion`, `matchesMedia`, `isTouchPrimary`.
- Styles: `STACKNAV_CSS`, `STACKNAV_STYLE_ID`, `injectStyles`.

## Size and development

The package is tree-shakeable, side-effect free unless its CSS is imported, and
has no runtime dependencies. Run `pnpm size` after a build for current bundle
measurements.

```sh
pnpm test
pnpm build
pnpm size
```
