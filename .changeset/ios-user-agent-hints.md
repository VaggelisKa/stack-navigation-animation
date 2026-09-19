---
'@stacknav/core': patch
---

iOS platform detection now checks `navigator.userAgentData` first, falling back to `navigator.platform` (including the touch-capable-Mac check for iPadOS) when hints are absent or inconclusive.
