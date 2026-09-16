# stacknav

Native-style push and pop navigation for the web. stacknav uses the familiar
iOS transition, or the Android transition when running on Android, while
leaving your pages, routing, and styling in your control.

- [`@stacknav/core`](packages/core) works with any web app.
- [`@stacknav/angular`](packages/angular) adds the transition to Angular's own
  `<router-outlet>`.
- A React integration is planned.

Try the [vanilla demo](apps/demo) or the [Angular demo](apps/angular-demo).

## How it works

stacknav keeps previously visited pages mounted beneath the current page and
animates between them with CSS transforms. Because a page stays mounted, its
scroll position, form values, and other UI state are still there when you go
back.

In Angular, the router continues to own navigation, URLs, guards, and browser
history. The `stackNav` directive only manages the pages shown by the outlet and
chooses whether each navigation should push, pop, or replace the current page.
The framework-agnostic core exposes the same stack behavior directly for apps
without Angular.

The browser keeps control of its native edge-swipe gesture. Apps that own the
edge themselves, such as installed PWAs or native webviews, can drive an
interactive pop through the core API.

## Angular example

Install the Angular integration:

```sh
pnpm add @stacknav/angular
```

Register it alongside the router:

```ts
import { provideStackNav } from '@stacknav/angular';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideStackNav()],
});
```

Then add the directive to your existing outlet. Its parent is the navigation
container, so it needs a height:

```html
<main style="height: 100dvh">
  <router-outlet stackNav />
</main>
```

Keep using `routerLink`, `router.navigate()`, and Angular's `Location` service as
usual. No route annotations or stacknav stylesheet imports are required.

See the [`@stacknav/angular` documentation](packages/angular) for direction
hints, route levels, transition settings, and advanced use.

## Core example

Install the framework-agnostic package:

```sh
pnpm add @stacknav/core
```

Create a stack, add its styles, and push page elements into it:

```ts
import {
  attachBrowserHistory,
  createNativeStack,
  injectStyles,
} from '@stacknav/core';

injectStyles();

const stack = createNativeStack({
  container: document.querySelector<HTMLElement>('#app')!,
});

await stack.push(homePage(), { animated: false });
attachBrowserHistory(stack);

await stack.push(detailsPage());
await stack.pop();
```

The container needs a height. Each page is a regular element created and styled
by your app. See the [`@stacknav/core` documentation](packages/core) for the full
API, browser-history integration, interactive transitions, and customization.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build:all
pnpm e2e
```

`pnpm e2e` drives Chromium by default. Set `E2E_BROWSER=webkit` to run the same
suites on WebKit (CI runs both, one job each); install the engine first with
`pnpm --filter @stacknav/angular-demo exec playwright-core install webkit`.

Run the demos locally with `pnpm dev:demo` or `pnpm dev:angular`.

External dependency versions live in the [pnpm catalog](https://pnpm.io/catalogs)
in `pnpm-workspace.yaml`; the manifests refer to them as `catalog:`, so a version
bump happens in one place. `packages/angular`'s `peerDependencies` stay as
literal ranges on purpose - they are deliberately wider than the versions we
develop against.
