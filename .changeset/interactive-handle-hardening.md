---
'@stacknav/core': patch
---

Make the interactive pop handle safe to misuse, and keep a listener's error out
of the navigation it heard about. A handle now ends once: a second `finish()`
hands back the first one's promise instead of settling -- and popping -- again,
which used to take the page beneath with it, and an `update()` after the release
no longer writes onto the page that has left. The handle also gained
`cancel()`, for a pointer sequence that is taken away rather than released
(`pointercancel`): it puts the upper page back with no animation and frees the
stack, where an abandoned handle used to leave it busy for good with every
queued operation stranded behind it.

Event listeners are now called one by one: one that throws no longer rejects the
`push` that mounted the page, nor stops the listeners after it from hearing the
event; the error is rethrown asynchronously, so it still reaches the host's
error reporting. A transition hook that throws leaves the pages at rest rather
than half-transitioned, and navigation still in flight when `destroy()` is
called rejects with an `AbortError`, as navigation after `destroy()` already did.
