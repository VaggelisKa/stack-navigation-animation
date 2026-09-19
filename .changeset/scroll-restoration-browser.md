---
'@stacknav/core': minor
'@stacknav/angular': minor
---

`scroll: 'document'` no longer takes `history.scrollRestoration`.

The mode used to set it to `manual` on every stack, reasoning that a history
pop would otherwise have the browser put the document back before the app heard
of the navigation, jumping the page still on top. Measured on Chromium and
WebKit, neither restores a same-document entry -- all a stack like this ever
navigates -- before the app hears the pop, not even behind a route that resolves
ten painted frames late. Meanwhile that one switch is shared by the whole
document, and an app under a shell has other claimants for it: the browser, or
Angular's router under `withInMemoryScrolling()`, which takes it to `manual`
itself. Taking it unasked broke whichever of them the app meant to use.

Nothing else changes: the stack has always recorded each page's document offset
and put it back itself, which a page returning from a refused pop or a released
swipe needs and no history entry can supply.

An app on an engine that does restore early can hand the switch back to the
stack with `scrollRestoration: 'manual'`, on `createNativeStack()` and
`provideStackNav()`.
