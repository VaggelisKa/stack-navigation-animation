---
'@stacknav/core': minor
'@stacknav/angular': minor
---

Animate on handhelds only, without app code: `provideStackNav({ animated: 'touch' })`
animates where the primary pointer is coarse and navigates instantly elsewhere,
asked again before every navigation. `animated` also takes a predicate, for a
user setting or a width breakpoint. The core exports the two media queries
behind it, `isTouchPrimary()` and `matchesMedia()`, which is also how the swipe
back is limited to touch: `gesture: isTouchPrimary() ? {} : false`.

`ResolvedStackNavConfig.animated` is now `() => boolean` rather than `boolean`,
which only affects code reading `STACKNAV_CONFIG` itself.
