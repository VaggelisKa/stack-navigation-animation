---
"@stacknav/angular": minor
---

`provideStackNav()` is now the whole Angular setup. It installs
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
