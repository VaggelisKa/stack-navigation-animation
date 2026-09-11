# @stacknav/core

An iOS push/pop navigation transition for any web app. Pages, headers and
styling stay the app's own; the engine only moves them.

- **Push / pop** with the UIKit curve, parallax and dim on the page beneath, and
  a shadow on the leading edge of the incoming page.
- **Interactive pop**: drag from the leading edge (or from anywhere, if
  configured) and the page follows the pointer. Release past half the width or
  with a flick to complete; a flick back cancels.
- **Scroll and state are preserved.** Pages beneath the top stay mounted and
  hidden. Only `transform` is written, so scroll offsets, form state and focus
  survive.
- **Direction resolution** for router-driven apps: composable strategies decide
  push / pop / replace.
- **Browser back** for apps without a router, through an optional history
  adapter. On iOS browsers the pop is instant, because Safari has already
  animated its own snapshot.
- **Tunable from CSS.** Duration, curve, parallax, dim and shadow are custom
  properties on the container, so a media query or theme class can retune the
  animation without touching the app's JS.
- **Custom chrome.** Subscribe to `progress` events and drive a fixed header or
  tab bar from the same `p`.
- No dependencies. Plain ES modules with type declarations.

## Use

```html
<div id="app"></div>
<script type="module">
  import { createIOSStack, attachBrowserHistory, injectStyles } from '@stacknav/core';

  injectStyles(); // or <link rel="stylesheet" href="@stacknav/core/stacknav.css">
  const nav = createIOSStack({ container: document.getElementById('app') });
  await nav.push(homePage(), { animated: false });
  attachBrowserHistory(nav);

  nav.push(detailPage(item));   // resolves when the animation ends
  nav.pop();
  nav.popTo(1);                 // back to the root
</script>
```

The container needs a height; it becomes `position: relative; overflow: hidden`.
Each page is an element you create. The stack gives it
`position: absolute; inset: 0; overflow-y: auto` and manages its visibility.

## API

### `createIOSStack({ container, transition?, gesture? })`

Builds a `NavigationStack` with the iOS transition and the edge-pan gesture
attached. `transition` and `gesture` are option objects for the two factories
below. The gesture is exposed as `stack.gesture`; `stack.destroy()` detaches it.

### `NavigationStack`

| Member | Description |
| --- | --- |
| `push(el \| () => el, { animated, data, key, source })` | Mounts and slides in a page. Resolves with the entry `{ el, index, key, data }`. An element already lower in the stack is moved to the top. |
| `pop({ animated })` | Slides the top page out. Resolves with the removed entry, or `null` at the root. |
| `popTo(depth, { animated })` | Pops until `depth` pages remain. Intermediate pages are removed without animation. |
| `popWith(el, opts)` | Pops the top page, revealing `el`. If `el` is mounted beneath, everything above it is removed; if not, it is placed beneath the top first. Used by routers to pop to a page that no longer exists. |
| `replace(el, opts)` | Swaps the top page for `el`, no animation. |
| `present(el, direction, opts)` | `push`, `pop` (via `popWith`) or `replace`, for callers that already resolved the direction. |
| `remove(el)` | Drops a page wherever it sits, no animation. |
| `reset(elements)` | Replaces the whole stack, no animation. |
| `beginInteractivePop()` | Returns `{ update(p), finish({ complete, velocity }) }` or `null`. Used by the gesture, and usable by a custom recognizer. |
| `depth`, `top`, `entries`, `busy`, `canPop()`, `entryOf(el \| key)` | State. |
| `on(event, fn)` | Events: `push`, `pop`, `replace`, `reset`, `transitionstart`, `progress`, `transitionend`. Returns an unsubscribe function. |
| `destroy()` | Unmounts everything. |

Operations are serialized: a `push` called during a transition waits its turn.

The `pop` event carries `{ entry, removed, entries, source }`, where `source` is
`"api"`, `"gesture"`, `"history"` or whatever a caller passed. Removed elements
are detached, not destroyed.

### Direction resolution

```ts
import { createDirectionResolver, fromHint, fromHistory, fromStack, fromLevel, fromTree, always } from '@stacknav/core';

const resolve = createDirectionResolver([fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()], 'push');

resolve({
  from: { key: '/items', segments: ['items'] },
  to: { key: '/items/42', segments: ['items', '42'], level: 2 },
  trigger: 'imperative',      // or 'history'
  historyDelta: undefined,    // negative = back, positive = forward, when known
  hint: undefined,            // an explicit 'push' | 'pop' | 'replace'
  stack: ['/', '/items'],     // keys of the kept pages, bottom to top
}); // → 'push'
```

A strategy is
`(ctx: NavigationContext) => 'push' | 'pop' | 'replace' | 'auto' | undefined`.
`fromLevel({ sameLevel })` and `fromTree({ sameDepth })` configure what equal
numbers or unrelated siblings mean (default `replace`). `segmentsOf(url)` splits
a path into `segments`.

### `createIOSTransition(options)`

| Option | CSS variable | Default | Description |
| --- | --- | --- | --- |
| `duration` | `--sn-duration` | `500` | ms for a programmatic push/pop |
| `ease` | `--sn-easing` | `cubic-bezier(0.32, 0.72, 0, 1)` | the curve push/pop runs on |
| `parallax` | `--sn-parallax` | `0.3` | fraction of the width the lower page travels |
| `dimColor`, `dimMax` | `--sn-dim-color`, `--sn-dim-max` | `"#000"`, `0.1` | overlay on the lower page at full open (`0.35` suits dark UIs) |
| `shadow` | `--sn-shadow` | `-3px 0 14px rgba(0,0,0,0.16)` | box-shadow on the incoming page |
| `settleMin`, `settleMax` | `--sn-settle-min`, `--sn-settle-max` | `120`, `400` | ms bounds when finishing an interactive pop |
| `settleEase` | `--sn-settle-easing` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | the curve a released swipe finishes on |
| `settleVelocityFloor` | `--sn-settle-velocity-floor` | `900` | px/s assumed when the pointer was slower |
| `timeScale` | `--sn-time-scale` | `1` | multiplies every duration (slow motion, tests) |

`prefers-reduced-motion` sets every duration to 0.

#### Tuning from CSS

Every option is also a custom property, read off the container when a transition
starts. Custom properties inherit, so set them wherever you like: on `:root`, on
the container, under a theme class, or inside a media query.

```css
:root {
  --sn-duration: 340ms;              /* snappier than iOS */
  --sn-easing: cubic-bezier(0.4, 0, 0.2, 1);
}
.theme-flat {
  --sn-parallax: 0;                  /* no parallax on the page beneath */
  --sn-dim-max: 0;
  --sn-shadow: none;
}
@media (prefers-color-scheme: dark) {
  :root { --sn-dim-max: 35%; }       /* stronger dimming on dark UIs */
}
```

Durations accept `ms`, `s` or a bare number of milliseconds. Fractions accept
`0.3` or `30%`. Easings accept `linear`, `ease`, `ease-in`, `ease-out`,
`ease-in-out`, `cubic-bezier(…)` with x coordinates within `[0, 1]` as CSS
requires, or `ios` / `ios-settle` for the two defaults. The `step` and `linear()`
timing functions are not supported.

Precedence:

1. A variable that is set wins over the JS option, so a stylesheet can retune a
   transition the app configured in code.
2. A variable that is unset falls through to the JS option, so nothing needs to
   be declared to get the defaults.
3. A variable the engine cannot parse also falls through to the JS option. A bad
   value degrades to the default rather than breaking the animation, and never
   reaches the tween. This includes `calc()` and other math: custom properties
   reach `getComputedStyle` unevaluated, so `--sn-duration: calc(var(--speed) *
   2)` cannot be read and falls back. Do the arithmetic where you define the
   variable.

Values are re-read at the start of every transition, which covers media queries
and class changes. `transition.refresh()` re-reads them on demand, for example
after changing `transition.options` mid-animation. `transition.resolved` is what
is currently in force, and `IOS_TRANSITION_CSS_VARS` maps each option to its
variable name.

A transition is just
`{ duration, ease, settle(), begin?(), apply(lower, upper, p), end?() }`, so you
can write a different one (a fade, a vertical sheet) and pass it to
`new NavigationStack({ container, transition })`. `cssVars()` and the
`parseTime` / `parseNumber` / `parseRatio` / `parseEasing` helpers are exported
so a custom transition can read variables the same way. Each returns `undefined`
rather than `NaN` for anything it cannot parse, so `?? yourDefault` is all the
handling a value needs.

### `createEdgePanGesture(options)`

| Option | Default | Description |
| --- | --- | --- |
| `edgeWidth` | `28` | px strip on the leading edge that starts the gesture |
| `anywhere` | `false` | recognize the drag from anywhere on the page |
| `startSlop` | `6` | px of horizontal travel before the drag begins |
| `verticalCancelSlop` | `10` | px of vertical travel that hands the touch to scrolling |
| `completeThreshold` | `0.5` | fraction of the width that completes on a slow release |
| `completeVelocity` | `500` | px/s toward the trailing edge that completes regardless |
| `cancelVelocity` | `-500` | px/s back toward the leading edge that cancels regardless |

Call `gesture.refresh()` after changing options at runtime.

### `attachBrowserHistory(stack, { key = "snDepth", animateHistoryPop, onForward })`

For apps without a router. Mirrors stack depth into `history.state`. Returns a
detach function. `animateHistoryPop` defaults to `false` on iOS browsers and
`true` elsewhere. Forward navigation has no page to show, so by default it
bounces back; pass `onForward(targetDepth)` to re-push something instead.

### Styles

`injectStyles()` inserts the engine's four rules once. `STACKNAV_CSS` is the same
CSS as a string, and `@stacknav/core/stacknav.css` is the same CSS as a file. It
covers layout only and declares no custom properties: the tuning variables above
are listed in a comment there rather than set, so that leaving one out means "use
the default".

## Develop

```sh
pnpm test         # node:test with a 68-line DOM stub, no browser
pnpm build        # tsc → dist/, plus dist/stacknav.css
```

```
src/
  animate.ts            cubic-bezier solver, cancellable tween, easings
  css-vars.ts           reading and parsing the engine's custom properties
  navigation-stack.ts   the stack: mounting, ordering, transition lifecycle, queueing
  ios-transition.ts     the look: slide, parallax, dim, shadow, settle timing
  edge-pan-gesture.ts   pointer-event recognizer that drives the interactive pop
  direction.ts          push / pop / replace strategies and the resolver
  history-adapter.ts    history.state mirroring for apps without a router
  styles.ts             the CSS the engine needs, and injectStyles()
  index.ts              exports + createIOSStack()
```
