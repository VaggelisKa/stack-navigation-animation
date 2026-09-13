---
"@stacknav/core": minor
"@stacknav/angular": minor
---

Deciding push / pop / replace no longer starts with an array of strategies.

`provideStackNav({ direction: [...] })` asked every app to spell out the whole
default chain — `[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]`
— just to insert one rule or change one option, and to know where in that chain
its rule belonged. In practice there is only one sensible slot: after the three
things the library is sure about (an explicit hint, the browser's back and
forward buttons, a page still kept alive beneath this one) and before the two it
guesses from (route numbers, the route tree). So that slot is now the API:

```ts
provideStackNav({
  direction: ({ to }) => (to.data?.['tab'] ? 'replace' : undefined), // your one rule
  siblings: 'push',                                                  // what a tie means
});
```

`siblings` replaces reaching for `fromLevel({ sameLevel })` and
`fromTree({ sameDepth })` separately; it sets both.

**Breaking.** `direction` no longer accepts an array or a resolver — an array
now throws with a message pointing here. An app that genuinely needs its own
order passes a resolver as `resolveDirection` instead, built from the strategies
`@stacknav/core` still exports:

```ts
provideStackNav({ resolveDirection: createDirectionResolver([myRule, byHint(), byRouteTree()], 'push') });
```

Those strategies were renamed to say what they read: `fromHint` → `byHint`,
`fromHistory` → `byBrowserHistory`, `fromStack` → `byKeptStack`, `fromLevel` →
`byRouteNumber`, `fromTree` → `byRouteTree`. Their `sameLevel` / `sameDepth`
options are both spelled `siblings` now, and `defaultStrategies()` takes
`{ direction, siblings }` to build the standard order with a host's rule in it.
The types `LevelOptions` and `TreeOptions` merged into `SiblingOptions`.
