---
'@stacknav/angular': patch
---

Stop double-animating the browser's back button on iOS. Safari animates its own snapshot of the previous page during the edge swipe and only then fires `popstate`, so the pop the outlet ran on top of that played the transition a second time; `@stacknav/core`'s `attachBrowserHistory` has always defaulted `animateHistoryPop` off there, and the directive now agrees. A history-triggered navigation on an iOS browser is no longer animated by default, and a navigation that asks for it with `info: { stacknav: { animated: true } }` still is.

The `animated` option's predicate now receives the navigation it is being asked about — `{ trigger, from, to }` — so an app can decide per navigation rather than only per device. A predicate that takes no arguments, which is all the option accepted before, keeps working unchanged.

`watchScroll` also prunes itself. It records a scroll offset per scroller in a page, and only `restoreScroll` dropped elements the page had replaced, which runs when the page is reached again: a page that stays on screen for a long time while its scrollers churn — a virtual list, a tab strip — held every element it had ever scrolled. Recording now sweeps disconnected elements once the map outgrows any real page's scroller count, without walking the DOM on the scroll path.
