---
'@stacknav/angular': patch
---

Back animates again. The previous release stopped animating any history-triggered navigation on an iOS browser, to avoid doubling up on the snapshot Safari slides across during its edge-swipe gesture. The reasoning held only for the swipe, and `popstate` never says that is what happened: the edge swipe, the browser's own Back button and an app calling `location.back()` from a back button of its own all reach the page as one event with one shape. Refusing all three to spare the one left every back in the app an instant cut with nothing moving, which is much the worse trade. It reached further than iPhones, too -- `isIOSBrowser()` answers for iPadOS as well, which reports itself as `MacIntel`, so any Mac reporting touch points was caught by a rule about a gesture it does not have.

Every navigation animates by default again. An app that does want the swipe handled can say so itself, in the `animated` predicate, which is told what triggered the navigation: `animated: ({ trigger }) => !(trigger === 'history' && isIOSBrowser())`.

`@stacknav/core`'s `attachBrowserHistory` still defaults `animateHistoryPop` to off on iOS browsers. That default predates this and is documented, so it is left alone, but it rests on the same reasoning and an app driving the stack itself may want to pass `animateHistoryPop: true`.
