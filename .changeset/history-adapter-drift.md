---
'@stacknav/core': patch
---

`attachBrowserHistory` keeps history the same length as the stack whatever
moved it. It used to mirror pushes and pops alone, so a `reset` left history
standing in pages that were gone -- the next back press was spent catching it
up instead of popping. The adapter now remembers the depth it last mirrored
and answers every `push`, `pop`, `replace` and `reset` with the entries it is
worth: one pushed per level gained, or a single walk back over the levels
lost.

A back press that reaches a destroyed stack no longer raises an unhandled
`AbortError`. An app that drops its stack without calling the detach function
leaves the listener attached, and the navigation a destroyed stack refuses is
the back press going nowhere, not an error.

`linearEasing` now throws a `TypeError` when given fewer than two points,
where the curve it built used to throw at its first call instead.

The native transition no longer needs `begin` before `apply`: `begin` is
optional on a `Transition`, and a host driving the frames itself reached the
dim overlay before anything had made it.
