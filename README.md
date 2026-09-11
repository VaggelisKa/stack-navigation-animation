# stacknav

iOS-style push/pop navigation for the web: a framework-agnostic core, and ports that sit alongside a framework's router rather than replacing it.

| Package | What it is |
| --- | --- |
| [`@stacknav/core`](packages/core) | The engine. A stack of page elements, the UIKit transition (slide, parallax, dim, shadow), an interactive edge-swipe pop, direction resolution, and a `history.state` adapter for router-less apps. No dependencies. |
| [`@stacknav/angular`](packages/angular) | `<sn-outlet />`, a router outlet for Angular Router that keeps pages alive beneath the top, animates every navigation, and swipes back. No navigation API of its own: the router, `routerLink` and `Location` do that. |
| `@stacknav/react` | Planned. |

Demos: [`apps/demo`](apps/demo) (vanilla, no router) and [`apps/angular-demo`](apps/angular-demo) (Angular router).

## The idea

Everything is a function of one number, `p`: how much of the upper page is showing. Push runs `p` from 0 to 1, pop from 1 to 0, and a swipe sets `p` straight from the finger. Pages beneath the top stay mounted and hidden, so scroll position, form state and focus are untouched when you come back.

**The engine never decides what is a push and what is a pop.** Apps differ: some number their screens, some read the route tree, some trust the browser's back button, some say it outright per navigation. So direction is resolved by a list of small strategies, in the order you trust them, and the first opinion wins:

```ts
import { fromHint, fromHistory, fromStack, fromLevel, fromTree } from '@stacknav/core';

// the default order
[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]
```

| Strategy | Answers when |
| --- | --- |
| `fromHint()` | the navigation carried an explicit `push` / `pop` / `replace` |
| `fromHistory()` | the browser's back button (pop) or forward button (push) triggered it |
| `fromStack()` | the target page is still kept beneath the current one: pop back to it |
| `fromLevel()` | both routes carry a number (`level`): higher pushes, lower pops |
| `fromTree()` | the target is a descendant (push) or an ancestor (pop) of the current route, else deeper pushes and shallower pops |

Write your own as a plain function `(ctx) => 'push' | 'pop' | 'replace' | undefined` and put it anywhere in the list.

## Develop

```sh
pnpm install
pnpm build          # packages/core, then packages/angular
pnpm test           # core unit tests (node:test, no browser)
pnpm e2e            # builds the Angular demo and drives it in Chromium
pnpm dev:demo       # vanilla demo
pnpm dev:angular    # Angular demo on http://localhost:4200
```

Node 22.18+ runs the core (its tests use Node's built-in TypeScript stripping). The Angular tooling wants Node 22.22.3+ or 24.

## Layout

```
packages/core/          @stacknav/core   TypeScript, built with tsc to dist/
packages/angular/       @stacknav/angular  built with ng-packagr to dist/
apps/demo/              vanilla demo (esbuild → dist/demo.html)
apps/angular-demo/      Angular CLI app + Playwright e2e (e2e/run.mjs)
```
