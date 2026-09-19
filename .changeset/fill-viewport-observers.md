---
'@stacknav/angular': patch
---

`stackNavFillViewport` no longer runs a permanent `requestAnimationFrame` loop. It now measures on resize observers, viewport and scroll events, and transition/animation ends, with a short frame burst after each trigger and a slow 500ms fallback sample that pauses while the document is hidden.
