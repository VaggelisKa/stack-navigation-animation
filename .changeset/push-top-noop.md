---
'@stacknav/core': patch
---

`push` of the page already on top is now a no-op, matching `replace` and
`popWith`, and `attachBrowserHistory` detaches its own `popstate` listener the
first time it fires after the stack is destroyed.
