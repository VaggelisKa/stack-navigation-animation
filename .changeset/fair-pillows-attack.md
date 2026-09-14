---
'@stacknav/core': patch
---

Commit the start of a transition with a style resolution instead of a forced layout. A push no longer lays out the page it is mounting inside the navigation task: on an eight-deep stack of 600-row pages in Edge the synchronous main-thread work of a push drops from ~22 ms to ~11 ms, and a pop from ~9 ms to ~7 ms, with the same number of elements restyled and the same painting. The layout still happens, in the browser's own frame, where it was always going to be needed.
