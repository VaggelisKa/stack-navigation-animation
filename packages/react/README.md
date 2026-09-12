# @stacknav/react

`<StackRoutes>`: React Router's `<Routes>` with the iOS push/pop transition,
built on [`@stacknav/core`](../core).

It is an outlet, not a router. React Router keeps doing everything it does:
`<Link>`, `useNavigate`, `useParams`, `useLocation`, browser history. The
outlet only changes what happens when the location changes: the page that was
showing stays alive beneath the new one, the change is animated, and a swipe
from the leading edge pops.

- **Works alongside the router.** There is no navigation API of its own. You
  navigate with `<Link>` and `useNavigate()`, go back with `navigate(-1)`, and
  read params as you already do.
- **Pages stay alive.** The page you came from is kept beneath the top one,
  hidden. Its scroll position, form state and effects are intact when you pop
  back, with nothing to restore.
- **Swipe back.** Drag from the leading edge and the page follows the pointer;
  the router follows the gesture, through `navigate(-1)` when that lands on
  the right page.
- **Configurable direction.** Whether a navigation is a push, a pop or a
  replace comes from strategies you order: an explicit hint, the browser's
  back/forward, the kept stack, numbers on your routes, or the URL tree.

## Use

```tsx
import { BrowserRouter, Link, Route, useNavigate, useParams } from 'react-router';
import { StackRoutes } from '@stacknav/react';

function App() {
  return (
    <BrowserRouter>
      {/* the outlet needs a height; it is the pages' scroll container */}
      <StackRoutes style={{ height: '100dvh' }}>
        <Route path="/" element={<Home />} />
        <Route path="items/:id" element={<Item />} />
        <Route path="items/:id/reviews" element={<Reviews />} />
      </StackRoutes>
    </BrowserRouter>
  );
}

// a page, using nothing from this library
function Item() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>‹ Back</button>
      <h1>Item {id}</h1>
      <Link to="reviews" relative="path">Reviews</Link>
    </>
  );
}
```

```css
/* the transition's options are custom properties, all optional */
:root { --sn-duration: 340ms; --sn-parallax: 20%; }
```

A variable that is set wins over the matching `transition` prop, so the
stylesheet has the final say on how the animation feels. The
[core README](../core#tuning-from-css) lists every variable.

`<StackRoutes>` takes `<Route>` elements like `<Routes>` does, or route objects
through `routes={[...]}` like `useRoutes()`. It nests like `<Routes>` too: under
a splat route (`/feed/*`) it matches what the splat caught.

## Deciding the direction

### Implicit: number your routes

Put a number on a route's `handle` and the outlet does the rest. Navigating to
a higher number pushes, a lower one pops, and the same number replaces. This
needs no hints and no extra calls: use `<Link>` and `navigate()` as usual.

```tsx
<Route path="/" element={<Home />} handle={{ stackLevel: 1 }} />
<Route path="settings" element={<Settings />} handle={{ stackLevel: 2 }} />
<Route path="about" element={<About />} handle={{ stackLevel: 3 }} />
```

The property name is configurable:
`levelOf={(matches) => matches?.at(-1)?.route.handle?.depth}`. Routes without
a number fall through to the URL tree, where a descendant pushes and an
ancestor pops, so you only need to number the screens the tree gets wrong.

### Explicit: a hint on the navigation

For a navigation that should go against the numbers, put a hint in the
router's own navigation `state`, under the `stacknav` key:

```tsx
navigate('/items/2', { state: { stacknav: 'push' } });                            // force a push
<Link to="/login" state={{ stacknav: 'replace' }} />                              // swap the top page
navigate('/x', { state: { stacknav: { direction: 'pop', animated: false } } }); // no animation
```

Hints are ignored on browser back and forward, where history decides.

### The full order

The defaults are the core's
`[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]`, which give:

| Navigation | Direction | Because |
| --- | --- | --- |
| `/items` → `/items/42` | push | descendant in the URL |
| `/items/42` → `/items` | pop | ancestor |
| browser back / forward | pop / push | history |
| a `<Link>` to a page still kept beneath | pop | the stack |
| `/settings` (`handle.stackLevel: 2`) → `/about` (`stackLevel: 3`) | push | numbering |
| `/items/1` → `/items/2` | replace | siblings |
| `navigate('/items/2', { state: { stacknav: 'push' } })` | push | explicit hint |

Change the order, drop a strategy, or add your own:

```tsx
<StackRoutes
  direction={[fromHint(), fromHistory(), myTabStrategy, fromTree({ sameDepth: 'push' })]}
  levelOf={(matches) => matches?.at(-1)?.route.handle?.order}   // where numbers live
  keyOf={(location) => location.pathname + location.search}    // what identifies a page
/>
```

A strategy receives `{ from, to, trigger, historyDelta, hint, stack }`, where
`from` and `to` carry `{ key, segments, level, location, matches }`.

## Pages stay alive, at their own location

A kept page is rendered through `useRoutes(routes, location)` with the location
it was reached at, which is React Router's own way of rendering a page for a
location other than the current one. So `useLocation()`, `useParams()`,
`useSearchParams()` and relative `<Link>`s inside it keep answering for that
page, and a `useNavigate()` call from it still navigates the live router.

`keyOf` defaults to the pathname, so a navigation that changes only the search
or the hash stays on the same page and does not go through the stack; a hint on
such a navigation has nothing to apply to.

This is React Router's declarative mode (`<BrowserRouter>` and `<Route>`
elements). Data routers (`createBrowserRouter`) hand each route one
`loaderData` by route id, which cannot describe two pages of the same route
kept alive at once, so they are not supported. TanStack Router is not supported
for the same kind of reason: its `<Outlet>` and `useMatch()` read the current
match by route id from the router's store, and a match that is no longer active
is not there to read, so a kept page cannot render with public API.

## Back buttons

A back button is `navigate(-1)`. After a deep link there is nothing to go back
to, so an app typically falls back to a route as a pop. That is a few lines of
app code using the router and the browser's `navigation.canGoBack`; see
[`apps/react-demo/src/back.ts`](../../apps/react-demo/src/back.ts).

## Swiping back

A swipe pops the page and then brings the router in line: `navigate(-1)` when
the entry behind the current one is the page that was revealed, otherwise a
`replace` navigation to that page with a `pop` hint. Until the router lands
somewhere, the popped page stays rendered off screen, so its state is intact if
it is put back.

## API

| Prop | Default | Description |
| --- | --- | --- |
| `children` | | `<Route>` elements, as for `<Routes>` |
| `routes` | | route objects, as for `useRoutes()`; takes precedence over `children` |
| `keyOf(location)` | the pathname | what identifies a page |
| `levelOf(matches, location)` | `handle.stackLevel` of the deepest match | the route's number |
| `stateKey` | `'stacknav'` | key in `location.state` for hints |
| `direction` | core defaults | strategies in order, or one resolver function |
| `fallbackDirection` | `'push'` | used when no strategy has an answer |
| `transition` | `{}` | `createIOSTransition` options; the same options are `--sn-*` variables read off the outlet |
| `gesture` | `{}` | `createEdgePanGesture` options; `false` disables swiping |
| `animated` | `true` | animate at all |
| `injectStyles` | `true` | insert the core stylesheet at runtime |
| `onNavigate({ page, direction, animated, reused })` | | every activation |
| `className`, `style` | | on the outlet element |

`ref` and `useStackNav()` give `{ stack, container, pages, canPop, lastDirection }`:
the core `NavigationStack` (for `progress` events), the kept pages bottom to
top, and the direction of the last activation. `useStackNav()` re-renders when
pages come and go.

Chrome that only has to move with the pages does not need `progress` at all:
the outlet carries `--sn-t` and `--sn-e` while a phase is in flight, and the
two pages taking part carry `sn-page-upper` and `sn-page-lower`, so a header or
a tab bar can transition off them and stay on the compositor with them.

## How it works

Each page renders into an element the outlet owns, through a portal, and that
element is what the core stack mounts, moves and drops. React never inserts or
removes the page elements itself, so the two never disagree about the DOM;
context and events still flow through the portal as if the page were an
ordinary child.

Which page to show, and whether that is a push, a pop or a replace, is decided
during render, so the first commit of a new page already puts its content in
its own element. The move itself runs in a layout effect after that commit, so
the first frame of the transition shows a page that is fully rendered.

## Develop

```sh
pnpm test         # node:test, the model and the history tracker, no DOM
pnpm build        # tsc → dist/
pnpm size         # what the outlet costs, minified + gzipped (after a build)
```

The component itself is covered by the React demo's e2e suite:
`pnpm --filter @stacknav/react-demo build && pnpm --filter @stacknav/react-demo e2e`.

```
src/
  stack-routes.tsx     <StackRoutes>: useRoutes(routes, location) + history + hints, useStackNav()
  stack-nav.tsx        the stack component underneath: the core stack, portals, effects
  model.ts             the stack bookkeeping: direction, placement, what stays mounted
  history-tracker.ts   back or forward, from a key per history entry
  hint.ts              reading a hint out of a navigation state
```
