---
"@stacknav/angular": minor
---

The animation now runs on Angular's own `<router-outlet>`. Nothing is swapped
out.

`<sn-outlet />` was a router outlet of its own: it implemented the outlet
contract, created the page components, proxied `ActivatedRoute`, saved and
restored nested outlet contexts and bound component inputs, all so it could keep
the page that was leaving. That is now a directive on the outlet you already
have:

```html
<div style="height: 100dvh">
  <router-outlet stackNav />
</div>
```

The outlet keeps creating the pages, binding their inputs and hosting nested
outlets; `stackNav` listens to it and moves the elements it made. Keeping a page
alive is the router's own detach/attach mechanism, driven by
`StackNavRouteReuseStrategy` (which `provideStackNav()` already installed), so
the `ActivatedRoute` a page injected keeps emitting when it is reached again and
a nested `<router-outlet>` inside a kept page is re-activated on its own. A
nested `<router-outlet stackNav>` is suspended with its page and resumes, pages
and all, when the page comes back. Direction
resolution, the hints, the kept stack, the interactive pop and every option of
`provideStackNav()` are unchanged.

**Breaking.**

- `StackNavOutlet` / `<sn-outlet>` is gone. Put `stackNav` (`StackNav`) on a
  `<router-outlet>`. The router places the pages next to the outlet, so the
  outlet's parent element is the stack: the pages' scroll container, which needs
  the height the outlet used to.
- Its inputs moved with it and gained the prefix: `[stackNavTransition]`,
  `[stackNavSwipeBack]`; the `navigated` output is `(stackNavActivate)`. `name` and
  `routerOutletData` are the outlet's own again, and so are its `activate`,
  `deactivate`, `attach` and `detach` outputs.
- `StackNavView` is `StackNavPage`, and carries the component `instance`
  rather than a `ComponentRef` (`el`, `key`, `routeRef` and `url` are as
  before). `StackNavActivation.view` is `.page`.
- `StackNavActivatedRoute` is gone; the router advances the page's own
  `ActivatedRoute`.
- `detachInactiveViews` is gone. A page beneath the top is a detached route
  handle now, so it is not change-detected until it is shown again, the way any
  detached route is.
- `provideStackNav({ routeReuse: false })` now means "I provide a strategy that
  extends `StackNavRouteReuseStrategy` myself". Without the strategy the router
  destroys each page as it leaves and there is nothing to animate out; a
  development build says so once.
- The `sn` prefix is not used in templates any more: the prefix already reads
  "stack nav", so `snStack` read as "stack nav stack". The directive and its
  inputs spell it out, as `cdkDropList` / `cdkDropListData` do.

One consequence of using the router's mechanism: detaching takes a page's
element out of the DOM and attaching puts it back. Scroll offsets inside the page
are captured before and restored after, so scroll position survives as before;
an `<iframe>` in a kept page reloads and a playing `<video>` pauses.
