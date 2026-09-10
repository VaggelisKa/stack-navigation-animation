# stacknav

A drop-in iOS push/pop navigation transition for any web app. Pages, headers and styling are the app's own; the engine only moves them.

- **Push / pop** with the UIKit curve, parallax and dim on the page beneath, and a soft leading-edge shadow.
- **Interactive pop**: drag from the leading edge (or anywhere, if you like) and the page follows the finger. Release past half the width or with a flick to complete; a flick back cancels.
- **Scroll and state survive.** Pages beneath the top stay mounted and hidden. Only `transform` is written, so scroll offsets, form state and focus are untouched when you return.
- **Browser back** works through an optional history adapter. On iOS browsers the pop is instant, because Safari already animated its own snapshot.
- **Your chrome.** Subscribe to `progress` events and drive a fixed header or tab bar from the same `p`.
- No dependencies. Plain ES modules, about 8 KB unminified.

[Live demo](https://claude.ai/code/artifact/4752a5b0-881c-4573-8d96-563db288821b)

## Use

```html
<link rel="stylesheet" href="stacknav/stacknav.css">
<div id="app"></div>
<script type="module">
  import { createIOSStack, attachBrowserHistory } from 'stacknav';

  const nav = createIOSStack({ container: document.getElementById('app') });
  await nav.push(homePage(), { animated: false });
  attachBrowserHistory(nav);

  // anywhere in the app
  nav.push(detailPage(item));   // returns a promise that resolves when the animation ends
  nav.pop();
  nav.popTo(1);                 // back to the root
</script>
```

The container needs a height (it is `position: relative; overflow: hidden`). Each page is an element you create; the stack gives it `position: absolute; inset: 0; overflow-y: auto` and manages visibility.

## API

### `createIOSStack({ container, transition?, gesture? })`

Builds a `NavigationStack` with the iOS transition and the edge-pan gesture attached. `transition` and `gesture` are option objects for the two factories below. The gesture is exposed as `stack.gesture`; `stack.destroy()` detaches it.

### `NavigationStack`

| Member | Description |
| --- | --- |
| `push(el \| () => el, { animated = true, data = null })` | Mounts and slides in a page. Resolves with the entry `{ el, index, data }`. |
| `pop({ animated = true })` | Slides the top page out. Resolves with the removed entry, or `null` at the root. |
| `popTo(depth, { animated = true })` | Pops until `depth` pages remain. Intermediates are removed without animation. |
| `reset(elements)` | Replaces the whole stack, no animation. |
| `beginInteractivePop()` | Returns `{ update(p), finish({ complete, velocity }) }` or `null`. Used by the gesture; also usable by your own recognizer. |
| `depth`, `top`, `entries`, `busy`, `canPop()` | State. |
| `on(event, fn)` | Events: `push`, `pop`, `reset`, `transitionstart`, `progress`, `transitionend`. Returns an unsubscribe function. |
| `destroy()` | Unmounts everything. |

Operations are serialized: a `push` called during a transition waits its turn.

The `pop` event carries `{ entry, removed, entries, source }` where `source` is `"api"`, `"gesture"` or `"history"`. Removed elements are detached, not destroyed; the demo dispatches a `sn:destroyed` event on them so pages can clean up.

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

Mirrors depth into `history.state`. Returns a detach function. `animateHistoryPop` defaults to `false` on iOS browsers and `true` elsewhere. Forward navigation has no page to show, so by default it bounces back; pass `onForward(targetDepth)` to re-push something instead.

## Develop

```sh
npm install
npm test          # node:test, no browser needed
npm run build     # dist/stacknav.js (ESM bundle) and dist/demo.html (single-file demo)
npm run dev       # serve the repo; open /demo/
```

## Layout

```
lib/
  animate.js            cubic-bezier solver, cancellable tween, easings
  navigation-stack.js   the stack: mounting, ordering, transition lifecycle, queueing
  ios-transition.js     the look: slide, parallax, dim, shadow, settle timing
  edge-pan-gesture.js   pointer-event recognizer that drives the interactive pop
  history-adapter.js    history.state mirroring
  index.js              exports + createIOSStack()
  stacknav.css          the four rules the engine needs
demo/                   a small app that exercises everything
scripts/build.mjs       esbuild: library bundle + single-file demo
test/                   node:test suites with a 60-line DOM stub
```
