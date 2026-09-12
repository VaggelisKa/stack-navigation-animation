---
'@stacknav/react': minor
---

First release of `@stacknav/react`: the iOS push/pop transition for React apps.

`<StackRoutes>` is a drop-in for React Router's `<Routes>`. Pages beneath the
top stay mounted at the location they were reached at, every navigation is
animated, and a swipe from the leading edge pops through the router's own
history. Direction comes from the core's strategies: a hint in the navigation
`state`, browser history, the kept stack, `handle.stackLevel` numbers, or the
URL tree.

`<StackNav>` underneath it is router-agnostic: give it a key, a node that
renders the page without live router context, and how to go back.
