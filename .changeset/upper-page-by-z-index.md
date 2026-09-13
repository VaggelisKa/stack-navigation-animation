---
"@stacknav/core": patch
---

The upper page of a transition now paints above the lower one by `z-index`
(`.sn-page-upper { z-index: 1 }`, inside a container that is its own stacking
context via `isolation: isolate`) rather than by document order. A host that
lets something else place the page elements -- a framework's router outlet, which
inserts each page next to itself -- no longer has to keep them sorted for a push
to land on top. Nothing changes for a host that appends pages in order.
