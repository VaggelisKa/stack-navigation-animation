---
'@stacknav/core': minor
'@stacknav/angular': minor
---

Document scrolling, for a stack under a shell header that follows
`window.scrollY`: `createNativeStack({ scroll: 'document' })` and
`provideStackNav({ scroll: 'document' })`, with a `stackNavScroll` input per
outlet.

The default is unchanged: each page is its own scroll container inside a
container of fixed height. In the new mode the page on top sits in the normal
flow and the document scrolls it, so an iOS-style large title that collapses on
the document's offset sees the page; the container needs no height of its own,
and pages kept beneath the top add nothing to the document's height.

Each page's document offset is recorded and put back when the page returns,
and the switch to the destination's offset happens _before_ the slide, not
after it: a shell reading `scrollY` shows the destination's header state from
the first frame of a push, a pop, a history pop and an interactive pop, rather
than catching up once the slide is over. The page leaving is held where the
user saw it while the document moves under it. A released swipe that does not
complete puts the document back the same way. The stack takes
`history.scrollRestoration` to `manual` in this mode, as a router that owns
scrolling does, so the browser does not move the document under a history pop
first.

The measurements this needs are two forced layouts in the navigation task,
which the default mode avoids; the trade is documented on the option.
