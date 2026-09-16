---
'@stacknav/core': patch
---

Two pieces of hardening for the browsers and the moments the engine cannot control.

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
