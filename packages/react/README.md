# @stacknav/react

The iOS push/pop transition for React apps, built on
[`@stacknav/core`](../core). Two pieces:

- **`<StackRoutes>`**, a drop-in for React Router's `<Routes>`. The router
  keeps doing everything it does: `<Link>`, `useNavigate`, `useParams`, browser
  history. The page that was showing stays alive beneath the new one, the change
  is animated, and a swipe from the leading edge pops.
- **`<StackNav>`**, the router-agnostic component underneath it. Give it the
  page the app wants on screen and what renders it; it keeps the pages it came
  from, animates, and tells you when a swipe went back.

Neither adds a navigation API of its own. There is no `push()` or `pop()` to
call: you navigate with your router, and the stack follows.

## With React Router

```tsx
import { BrowserRouter, Link, Route, useNavigate, useParams } from 'react-router';
import { StackRoutes } from '@stacknav/react/react-router';

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
through `routes={[...]}` like `useRoutes()`.

### Pages stay alive, at their own location

The page you came from is kept beneath the top one, hidden. Its scroll
position, form state and effects are intact when you pop back, with nothing to
restore.

A kept page is rendered through `useRoutes(routes, location)` with the location
it was reached at, which is React Router's own way of rendering a page for a
location other than the current one. So `useLocation()`, `useParams()`,
`useSearchParams()` and relative `<Link>`s inside it keep answering for that
page, and a `useNavigate()` call from it still navigates the live router.

This is React Router's declarative mode (`<BrowserRouter>` and `<Route>`
elements). Data routers (`createBrowserRouter`) hand each route one
`loaderData` by route id, which cannot describe two pages of the same route
kept alive at once, so they are not supported.

### Deciding the direction

Whether a navigation pushes, pops or replaces comes from strategies you order.
The defaults are the core's
`[fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()]`:

| Navigation | Direction | Because |
| --- | --- | --- |
| `/items` → `/items/42` | push | descendant in the URL |
| `/items/42` → `/items` | pop | ancestor |
| browser back / forward | pop / push | history |
| a `<Link>` to a page still kept beneath | pop | the stack |
| `/settings` (`handle.stackLevel: 2`) → `/about` (`stackLevel: 3`) | push | numbering |
| `/items/1` → `/items/2` | replace | siblings |
| `navigate('/items/2', { state: { stacknav: 'push' } })` | push | explicit hint |

**Numbers.** Put a number on a route's `handle` and it is compared with the
page on screen: higher pushes, lower pops, equal replaces. Routes without a
number fall through to the URL, so you only need to number the screens the
tree gets wrong.

```tsx
<Route path="settings" element={<Settings />} handle={{ stackLevel: 2 }} />
<Route path="about" element={<About />} handle={{ stackLevel: 3 }} />
```

**Hints.** For a navigation that should go against the rules, put a hint in the
router's own navigation `state`, under the `stacknav` key:

```tsx
navigate('/items/2', { state: { stacknav: 'push' } });                            // force a push
<Link to="/login" state={{ stacknav: 'replace' }} />                              // swap the top page
navigate('/x', { state: { stacknav: { direction: 'pop', animated: false } } }); // no animation
```

Hints are ignored on browser back and forward, where history decides.

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

### Back buttons

A back button is `navigate(-1)`. After a deep link there is nothing to go back
to, so an app typically falls back to a route as a pop. That is a few lines of
app code using the router and the browser's `navigation.canGoBack`; see
[`apps/react-demo/src/back.ts`](../../apps/react-demo/src/back.ts).

### Swiping back

A swipe pops the page and then brings the router in line: `navigate(-1)` when
the entry behind the current one is the page that was revealed, otherwise a
`replace` navigation to that page with a `pop` hint. Until the router lands
somewhere, the popped page stays rendered off screen, so its state is intact if
the router refuses and it is put back.

`keyOf` defaults to the pathname, so a navigation that changes only the search
or the hash stays on the same page and does not go through the stack; a hint on
such a navigation has nothing to apply to.

## Without React Router

`<StackNav>` needs three things: a `route` with a `key` that identifies the
page, `children` that render it, and, in `onSwipeBack`, how to go back.

```tsx
import { StackNav } from '@stacknav/react';

<StackNav
  route={{ key: path, segments: path.split('/').filter(Boolean), level: screens[path]?.level }}
  navigation={{ trigger: cameFromHistory ? 'history' : 'imperative', hint }}
  onSwipeBack={() => history.back()}
  style={{ height: '100dvh' }}
>
  {renderPage(path)}
</StackNav>
```

The one rule: **`children` must not depend on live router context.** Once the
page is beneath the top, that node is what keeps rendering it, so anything it
reads from a context that follows the current URL would show the new page's
data inside the old page. Render from props, or from a context you pin to the
page's own location the way `<StackRoutes>` does with `useRoutes(routes,
location)`.

This is also why there is no TanStack Router adapter. Its `<Outlet>` and
`useMatch()` read the current match by route id from the router's store, and a
match that is no longer active is not there to read, so a kept page cannot
render with public API.

`createHistoryTracker()` and `readHint()` are exported for adapters: the first
models the session history from a key per entry and the action that reached
it, so it can say whether a navigation went back or forward; the second reads a
hint out of an object such as a navigation state.

## API

### `<StackRoutes>`

Everything `<StackNav>` takes except `route`, `navigation`, `children` and
`onSwipeBack`, plus:

| Prop | Default | Description |
| --- | --- | --- |
| `children` | | `<Route>` elements, as for `<Routes>` |
| `routes` | | route objects, as for `useRoutes()`; takes precedence over `children` |
| `keyOf(location)` | the pathname | what identifies a page |
| `levelOf(matches, location)` | `handle.stackLevel` of the deepest match | the route's number |
| `stateKey` | `'stacknav'` | key in `location.state` for hints |

### `<StackNav>`

| Prop | Default | Description |
| --- | --- | --- |
| `route` | required | `{ key, segments?, level?, data? }`: the page the app wants on screen |
| `navigation` | `{}` | `{ trigger?, historyDelta?, hint?, animated? }`: how it got there |
| `children` | | what renders the page; see the rule above |
| `direction` | core defaults | strategies in order, or one resolver function |
| `fallbackDirection` | `'push'` | used when no strategy has an answer |
| `transition` | `{}` | `createIOSTransition` options; the same options are `--sn-*` variables read off the container |
| `gesture` | `{}` | `createEdgePanGesture` options; `false` disables swiping |
| `animated` | `true` | animate at all |
| `injectStyles` | `true` | insert the core stylesheet at runtime |
| `onSwipeBack(revealed, popped)` | `history.back()` | bring the router in line after a swipe; return `false` to put the page back |
| `onNavigate({ page, direction, animated, reused })` | | every activation |
| `className`, `style` | | on the container |

`ref` and `useStackNav()` give `{ stack, container, pages, canPop, lastDirection }`:
the core `NavigationStack` (for `progress` events), the kept pages bottom to
top, and the direction of the last activation. `useStackNav()` re-renders when
pages come and go.

Chrome that only has to move with the pages does not need `progress` at all:
the container carries `--sn-t` and `--sn-e` while a phase is in flight, and the
two pages taking part carry `sn-page-upper` and `sn-page-lower`, so a header or
a tab bar can transition off them and stay on the compositor with them.

## How it works

Each page renders into an element the component owns, through a portal, and
that element is what the core stack mounts, moves and drops. React never
inserts or removes the page elements itself, so the two never disagree about
the DOM; context and events still flow through the portal as if the page were
an ordinary child.

Which page to show, and whether that is a push, a pop or a replace, is decided
during render, so the first commit of a new page already puts its content in
its own element. The move itself runs in a layout effect after that commit, so
the first frame of the transition shows a page that is fully rendered.

## Develop

```sh
pnpm test         # node:test, the model and the history tracker, no DOM
pnpm build        # tsc → dist/
pnpm size         # what each entry point costs, minified + gzipped (after a build)
```

The component itself is covered by the React demo's e2e suite:
`pnpm --filter @stacknav/react-demo build && pnpm --filter @stacknav/react-demo e2e`.

```
src/
  model.ts             the stack bookkeeping: direction, placement, what stays mounted
  stack-nav.tsx        <StackNav>: the core stack, portals, effects, useStackNav()
  react-router.tsx     <StackRoutes>: useRoutes(routes, location) + history + hints
  history-tracker.ts   back or forward, from a key per history entry
  hint.ts              reading a hint out of a navigation state
```
