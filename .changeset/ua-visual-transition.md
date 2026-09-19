---
'@stacknav/core': minor
'@stacknav/angular': minor
---

A navigation the browser animated itself is no longer animated a second time.

A browser that owns the back gesture slides the previous page across during the
swipe and fires `popstate` at the end of it, so the pop run on top played the
same move again. The library could not tell that case apart before: `popstate`
said only that history had moved, never what moved it, and the edge swipe, the
browser's Back button and an app calling `location.back()` all arrived as one
event with one shape. Refusing all three would have left every back button in
an app dead, so all three animated, and #50 took out the iOS guess that tried
otherwise.

`PopStateEvent.hasUAVisualTransition` is that missing word, and it is Baseline
2026 (Safari 18, Chrome 121): true only when the browser really did animate
this navigation. Both packages now ask it.

- `@stacknav/angular` no longer animates such a navigation. The predicate is
  not asked about one, as it is not asked about the first page of a stack; a
  navigation that wants a transition regardless still asks with
  `info: { stacknav: { animated: true } }`.
- `@stacknav/core`'s `attachBrowserHistory` decides per pop rather than per
  platform. `animateHistoryPop` no longer defaults to `!isIOSBrowser()`: unset,
  it asks the event, and falls back to that guess only on an engine that cannot
  answer. Given a boolean, it still decides every pop.

On an engine older than the property nothing changes.
