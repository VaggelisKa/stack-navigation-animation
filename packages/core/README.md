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
- **CSS runs the animation.** The engine writes where the pages should end up
  and hands the browser that phase's duration and curve; the frames in between
  are the compositor's, not the main thread's.
- **Direction resolution** for router-driven apps: composable strategies decide
  push / pop / replace.
- **Browser back** for apps without a router, through an optional history
  adapter. On iOS browsers the pop is instant, because Safari has already
  animated its own snapshot.
- **Tunable from CSS.** Duration, curve, parallax, dim and shadow are custom
  properties on the container, so a media query or theme class can retune the
  animation without touching the app's JS.
- **Custom chrome.** Move a header or a tab bar in step with the pages from CSS,
  or subscribe to `progress` events and drive it from the same `p`.
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

## How it moves

The engine does not animate anything. For each phase it writes two custom properties on the container — `--sn-t` and `--sn-e`, the duration and curve in force — and then writes where the pages should end up. CSS does the rest:

| Phase | `--sn-t` | What is written |
| --- | --- | --- |
| push / pop | the transition's `duration` | the far endpoint, once |
| a finger on the screen | `0s` | the current `p`, per pointer move |
| the release | `settle()`'s duration | the endpoint it is settling to, once |

So a 500 ms push costs about a dozen style writes in total rather than one per page per frame, the travel is a percentage of the page (no layout is ever measured), and `transform` and `opacity` stay on the compositor — a busy main thread no longer stutters the transition. `prefers-reduced-motion` is a media query in the stylesheet, so it wins even over a duration the engine wrote.

## API

### Swipe-back policy

```js
const stack = createIOSStack({ container, swipeBack: 'browser' });
stack.setSwipeBack('custom');   // interactive drag; request browser suppression
stack.setSwipeBack('disabled'); // no custom drag; request browser suppression
stack.setSwipeBack('browser');  // no custom drag; release our suppression request
console.log(stack.swipeBack);
```

`SwipeBackMode` is exported as a type. Mode changes preserve the stack and history
and cancel any active custom drag. Destroying the stack releases its policy.
Gesture options tune `custom` mode; they do not enable it.

**Migration:** custom swiping was previously enabled by default. Pass
`swipeBack: 'custom'` to retain it. A standalone `createEdgePanGesture()` remains
an explicit custom recognizer and does not manage browser suppression.

Browser suppression is **best effort and document-wide**, using
`overscroll-behavior-x: contain` on the document root. Safari and OS gestures may
still navigate. Back/Forward buttons and keyboard navigation continue to work.
Multiple stacks share suppression; `browser` releases only that stack's request.
The original inline value and priority are restored when the last request ends,
unless the application has replaced our declaration in the meantime.
See [CSS overscroll behavior](https://drafts.csswg.org/css-overscroll/) and
[WebKit's limitation](https://bugs.webkit.org/show_bug.cgi?id=240183).
Page retention and transition effects work in every mode.

### `createIOSStack({ container, transition?, gesture?, swipeBack? })`

Builds a `NavigationStack` with the iOS transition. Set `swipeBack: 'custom'`
to attach the edge-pan gesture. The default is `browser`. `transition` and `gesture` are option objects for the two factories
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
`new NavigationStack({ container, transition })`. `apply` is a declarative
write, not a frame: the stack calls it once at each end of a phase and lets CSS
interpolate between them, so keep it to `transform` and `opacity` and the
browser keeps it off the main thread. `ease` is sampled to report `progress`,
but its `css` property is what drives the pixels — `cubicBezier()` and
`parseEasing()` set one, and a bare `(t) => number` of your own does not, so
such a curve runs `linear` on screen unless you give it a `css` property too. `cssVars()` and the
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

The leading edge is whichever edge the container reads from, so in a
right-to-left container the strip sits on the right and back is a drag to the
left. The recognizer and the transition both take that from `--sn-dir`, which
the stylesheet sets under `:dir(rtl)`, falling back to the container's computed
`direction`; set `--sn-dir: -1` yourself to flip both without an RTL document.

### `attachBrowserHistory(stack, { key = "snDepth", animateHistoryPop, onForward })`

For apps without a router. Mirrors stack depth into `history.state`. Returns a
detach function. `animateHistoryPop` defaults to `false` on iOS browsers and
`true` elsewhere. Forward navigation has no page to show, so by default it
bounces back; pass `onForward(targetDepth)` to re-push something instead.

### Your own chrome

A header or tab bar that should move with the pages can read the same state the engine gives CSS — `--sn-t` and `--sn-e` on the container, and the `sn-page-upper` / `sn-page-lower` classes on the two pages taking part — and it will run on the compositor alongside them:

```css
.my-header { transition: opacity var(--sn-t) var(--sn-e); }
```

For chrome that needs the number itself, `progress` still fires with `(lower, upper, p)`. It now costs a frame loop, so the engine only runs one while something is subscribed.

### Styles

`injectStyles()` inserts the engine's rules once. `STACKNAV_CSS` is the same
CSS as a string, minified because it rides along in your JS bundle, and
`@stacknav/core/stacknav.css` is the same CSS as a readable file.

It covers layout and the motion itself — the `transition` rules the pages run
on — and declares none of the tuning variables above: they are listed in a
comment in the file rather than set, so that leaving one out means "use the
default". While a phase is in flight the engine writes two properties of its own
on the container, `--sn-t` and `--sn-e`, and marks the two pages taking part
`sn-page-upper` and `sn-page-lower`. Anything of yours that should move with
them can transition off the same four.

## Footprint

Plain ES modules, no dependencies, no work at module load: a bundler keeps only what you import, whether or not it honours the package's `sideEffects` flag (the tests bundle each entry point with that flag switched off and check what survives). Minified and gzipped, as measured by `pnpm size`:

| You import | Costs |
| --- | --- |
| `createIOSStack` (stack, iOS look, swipe back) | ~4.5 kB |
| `NavigationStack` with your own transition | ~2.4 kB |
| the direction strategies | ~0.6 kB |
| `attachBrowserHistory` | ~0.5 kB |
| `injectStyles` | ~0.5 kB |
| everything | ~5.9 kB |

## Develop

```sh
pnpm test         # node:test with a small DOM stub, no browser; includes the tree-shaking checks
pnpm build        # tsc → dist/, plus dist/stacknav.css
pnpm size         # what each entry point costs, minified + gzipped (after a build)
```

```
src/
  animate.ts            curves CSS and JS can both read, the tween, the waits
  css-vars.ts           reading and parsing the engine's custom properties
  navigation-stack.ts   the stack: mounting, ordering, transition lifecycle, queueing
  ios-transition.ts     the look: the endpoints, the settle timing, the variables
  edge-pan-gesture.ts   pointer-event recognizer that drives the interactive pop
  direction.ts          push / pop / replace strategies and the resolver
  history-adapter.ts    history.state mirroring for apps without a router
  styles.ts             the CSS the engine needs, motion included, and injectStyles()
  index.ts              exports + createIOSStack()
```

### Animation implementation notes

Timed transforms and opacity run as CSS transitions. Pointer handling, velocity
sampling, distance-dependent settle timing, and completion promises remain in
JavaScript. A `progress` subscriber also needs a JavaScript frame loop; omit
that subscription when CSS can drive your page chrome.

The browser resolves `--sn-dim-color` and `--sn-shadow` directly, so theme changes
to these variables take effect during a transition without `refresh()`. The JS
options remain their fallbacks. `resolved` remains a snapshot taken by
`begin()` or `refresh()`; numeric options still use that snapshot, including
support for percentage ratios and bare millisecond values.
