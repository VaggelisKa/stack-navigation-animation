---
'@stacknav/core': minor
---

Let CSS run the push/pop animation.

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
