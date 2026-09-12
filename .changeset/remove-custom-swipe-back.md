---
"@stacknav/core": minor
"@stacknav/angular": minor
---

Remove the custom swipe-back gesture. `swipeBack` is now `'browser' | 'disabled'`;
`'custom'` throws, and `createEdgePanGesture()`, the `EdgePanGesture` types and the
`gesture` option (on `createNativeStack()`, `provideStackNav()` and `<sn-outlet />`)
are gone, along with the `.sn-edge`, `.sn-swipe-custom`, `.sn-anywhere` and
`.sn-can-pop` rules.

Browser suppression uses `overscroll-behavior-x`, which Safari ignores for its edge
swipe, so in a browser tab our recognizer ran alongside the browser's and read as two
backs at once. `'disabled'` still requests suppression.

`NavigationStack.beginInteractivePop()` is unchanged and is now the supported way to
drive a finger-tracking pop: an app that owns the edge -- an installed PWA, a native
webview -- supplies the pointer handling, and the Angular outlet syncs the router for
the pop it emits exactly as before.

**Migration:** drop `swipeBack: 'custom'` and any `gesture` option. To keep an
interactive pop, drive `beginInteractivePop()` from your own pointer handling.
