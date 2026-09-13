---
"@stacknav/core": minor
---

Starting a phase no longer costs a style recalculation of every kept page.

Two things in the stylesheet changed inherited properties on every transition,
and inherited properties fan out: the browser re-resolves the style of every
element beneath, which on a deep stack of heavy pages is every row of every
page, hidden ones included, twice per push or pop. Measured in Chromium on an
eight-deep stack of 600-row pages, the main-thread work of starting a push fell
from about 140 ms to about 20 ms, of starting a pop from about 110 ms to about
10 ms, and of starting an interactive pop from about 60 ms to about 7 ms. The
cost is now independent of how many pages are kept.

- `--sn-t` and `--sn-e` are still written on the container and still reach the
  page elements, but the stylesheet pins them on each page's children
  (`:where(.sn-page) > * { --sn-t: 0s; --sn-e: linear }`). Chrome inside a page
  that transitions off them needs one rule to lift the barrier, and pays the
  recalculation for that page knowingly:
  `.sn-page > * { --sn-t: inherit; --sn-e: inherit }`. Chrome beside the pages,
  and the pages themselves, are unaffected.
- `.sn-busy` no longer sets `user-select: none` on the container and
  `pointer-events: none` on the pages. A pseudo-element shield
  (`.sn-busy::after`) covers the container instead. Clicks still do not land on
  a page mid-transition, pointer events still target the container, and a drag
  still does not start a selection. One visible difference: a selection that
  already existed when an interactive pop began stays visible during the drag
  instead of being hidden until it ends.
