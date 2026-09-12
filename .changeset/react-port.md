---
'@stacknav/react': minor
---

First release of `@stacknav/react`: the iOS push/pop transition for React
Router.

`<StackRoutes>` is `<Routes>` with the transition: an outlet, not a router.
Pages beneath the top stay mounted at the location they were reached at, every
navigation is animated, and a swipe from the leading edge pops through the
router's own history. Direction comes from the core's strategies: a hint in the
navigation `state`, browser history, the kept stack, `handle.stackLevel`
numbers, or the URL tree.
