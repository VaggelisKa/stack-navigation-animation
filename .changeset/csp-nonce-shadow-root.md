---
'@stacknav/core': minor
'@stacknav/angular': patch
---

`injectStyles(target?, { nonce })` now accepts a `ShadowRoot` as well as a `Document`, adopting a constructed sheet where `adoptedStyleSheets` is supported and falling back to a `<style>` element, and puts a `nonce` on that element for pages with a strict `style-src`. The Angular stack passes `CSP_NONCE` through and injects into the shadow root the stack is in.
