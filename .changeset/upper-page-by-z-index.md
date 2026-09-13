---
"@stacknav/core": patch
---

The upper page of a transition now paints above the lower one by `z-index`
(`.sn-page-upper { z-index: 1 }`, inside a container that is its own stacking
context via `isolation: isolate`) rather than by document order. A host that
lets something else place the page elements -- a framework's router outlet, which
inserts each page next to itself -- no longer has to keep them sorted for a push
to land on top.

The `z-index` changes nothing for a host that appends pages in order. The
stacking context is new for every host: chrome placed as a direct child of the
container with `position: fixed` and a large `z-index` -- a toast or a sheet
next to the pages rather than inside one -- now stacks within the container
instead of above everything after it in the document. Page content is not
affected; each page was already a stacking context of its own.
