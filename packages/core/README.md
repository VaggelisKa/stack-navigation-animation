# @stacknav/core

A drop-in iOS push/pop navigation transition for any web app. Pages, headers and styling are the app's own; the engine only moves them.

- **Push / pop** with the UIKit curve, parallax and dim on the page beneath, and a soft leading-edge shadow.
- **Interactive pop**: drag from the leading edge (or anywhere, if you like) and the page follows the finger. Release past half the width or with a flick to complete; a flick back cancels.
- **Scroll and state survive.** Pages beneath the top stay mounted and hidden. Only `transform` is written, so scroll offsets, form state and focus are untouched when you return.
- **Direction resolution** for router-driven apps: composable strategies decide push / pop / replace; the engine prescribes nothing.
- **Browser back** for router-less apps through an optional history adapter. On iOS browsers the pop is instant, because Safari already animated its own snapshot.
- **Your chrome.** Subscribe to `progress` events and drive a fixed header or tab bar from the same `p`.
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

The container needs a height (it becomes `position: relative; overflow: hidden`). Each page is an element you create; the stack gives it `position: absolute; inset: 0; overflow-y: auto` and manages visibility.

## API

### `createIOSStack({ container, transition?, gesture? })`

Builds a `NavigationStack` with the iOS transition and the edge-pan gesture attached. `transition` and `gesture` are option objects for the two factories below. The gesture is exposed as `stack.gesture`; `stack.destroy()` detaches it.

### `NavigationStack`

| Member | Description |
| --- | --- |
| `push(el \| () => el, { animated, data, key, source })` | Mounts and slides in a page. Resolves with the entry `{ el, index, key, data }`. An element already lower in the stack is moved to the top. |
| `pop({ animated })` | Slides the top page out. Resolves with the removed entry, or `null` at the root. |
| `popTo(depth, { animated })` | Pops until `depth` pages remain. Intermediates are removed without animation. |
| `popWith(el, opts)` | Pops the top page, revealing `el`. If `el` is mounted beneath, everything above it goes; if not, it is placed beneath the top first. This is how a router pops to a page that no longer exists. |
| `replace(el, opts)` | Swaps the top page for `el`, no animation. |
| `present(el, direction, opts)` | `push`, `pop` (via `popWith`) or `replace`, for callers that already resolved the direction. |
| `remove(el)` | Drops a page wherever it sits, no animation. |
| `reset(elements)` | Replaces the whole stack, no animation. |
| `beginInteractivePop()` | Returns `{ update(p), finish({ complete, velocity }) }` or `null`. Used by the gesture; also usable by your own recognizer. |
| `depth`, `top`, `entries`, `busy`, `canPop()`, `entryOf(el \| key)` | State. |
| `on(event, fn)` | Events: `push`, `pop`, `replace`, `reset`, `transitionstart`, `progress`, `transitionend`. Returns an unsubscribe function. |
| `destroy()` | Unmounts everything. |

Operations are serialized: a `push` called during a transition waits its turn.

The `pop` event carries `{ entry, removed, entries, source }` where `source` is `"api"`, `"gesture"`, `"history"` or whatever a caller passed. Removed elements are detached, not destroyed.

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
  stack: ['/', '/items'],     // keys of the pages kept, bottom to top
}); // → 'push'
```

A strategy is `(ctx: NavigationContext) => 'push' | 'pop' | 'replace' | 'auto' | undefined`. `fromLevel({ sameLevel })` and `fromTree({ sameDepth })` let you pick what equal numbers or unrelated siblings mean (default `replace`). `segmentsOf(url)` splits a path for `segments`.

### `createIOSTransition(options)`

| Option | Default | |
| --- | --- | --- |
| `duration` | `500` | ms for programmatic push/pop |
| `parallax` | `0.3` | fraction of the width the lower page travels |
| `dimColor`, `dimMax` | `"#000"`, `0.1` | overlay on the lower page at full open (`0.35` reads well on dark UIs) |
| `shadow` | `-3px 0 14px rgba(0,0,0,0.16)` | box-shadow on the incoming page |
| `settleMin`, `settleMax` | `120`, `400` | ms bounds when finishing an interactive pop |
| `settleVelocityFloor` | `900` | px/s assumed when the finger was slower |
| `timeScale` | `1` | multiplies every duration (slow motion, tests) |

`prefers-reduced-motion` makes every duration 0.

A transition is just `{ duration, ease, settle(), begin?(), apply(lower, upper, p), end?() }`, so you can write a different one (a fade, a vertical sheet) and pass it to `new NavigationStack({ container, transition })`.

### `createEdgePanGesture(options)`

| Option | Default | |
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

For apps without a router. Mirrors depth into `history.state`. Returns a detach function. `animateHistoryPop` defaults to `false` on iOS browsers and `true` elsewhere. Forward navigation has no page to show, so by default it bounces back; pass `onForward(targetDepth)` to re-push something instead.

### Styles

`injectStyles()` inserts the engine's four rules once; `STACKNAV_CSS` is the string; `@stacknav/core/stacknav.css` is the same as a file.

## Develop

```sh
pnpm test         # node:test with a 60-line DOM stub, no browser
pnpm build        # tsc → dist/, plus dist/stacknav.css
```

```
src/
  animate.ts            cubic-bezier solver, cancellable tween, easings
  navigation-stack.ts   the stack: mounting, ordering, transition lifecycle, queueing
  ios-transition.ts     the look: slide, parallax, dim, shadow, settle timing
  edge-pan-gesture.ts   pointer-event recognizer that drives the interactive pop
  direction.ts          push / pop / replace strategies and the resolver
  history-adapter.ts    history.state mirroring for router-less apps
  styles.ts             the CSS the engine needs, and injectStyles()
  index.ts              exports + createIOSStack()
```
