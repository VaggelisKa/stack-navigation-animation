---
'@stacknav/angular': patch
---

Keep the outgoing page in the DOM under Angular's animation renderer. With
`provideAnimations()` (or `provideNoopAnimations()`) the renderer only notes a
`removeChild` and the animation engine carries it out when change detection
ends, from wherever the element is by then -- so the page the outlet had just
detached, put back in the container by the directive, was taken out again on
the same tick, and the new page animated over nothing. The directive now
re-inserts the page through Angular's own renderer, which is how Angular moves a
view and tells the engine to drop the pending removal. Fixes #55.
