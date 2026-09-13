import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { StackNavRouteReuseStrategy, provideStackNav } from '@stacknav/angular';
import { MAIL_TRANSITIONS, byAnimationData } from './app/demos/mail/animation';
import { App } from './app/app';
import { routes } from './app/routes';

bootstrapApplication(App, {
  providers: [
    // 'computed' makes a refused back navigation leave history exactly as it was.
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ canceledNavigationResolution: 'computed' })),
    provideStackNav({
      // One rule of the app's own, on top of what the library already decides:
      // routes that name themselves in `data.animation`, as the Mail demo's do,
      // get their direction from a transition table. Everything else falls
      // through to `data.stackLevel` numbering and the route tree.
      direction: byAnimationData(MAIL_TRANSITIONS),
      // No `swipeBack` here: the browser keeps the gesture, which is both the
      // library default and the only thing it offers. Lab switches to `disabled`.
    }),
    // Opt in: /items/1 → /items/2 becomes a new page instead of a reused component.
    { provide: RouteReuseStrategy, useClass: StackNavRouteReuseStrategy },
  ],
}).catch(console.error);
