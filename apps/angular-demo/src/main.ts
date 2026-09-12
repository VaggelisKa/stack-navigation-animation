import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { StackNavRouteReuseStrategy, provideStackNav } from '@stacknav/angular';
import { fromHint, fromHistory, fromLevel, fromStack, fromTree } from '@stacknav/core';
import { MAIL_TRANSITIONS, fromAnimationData } from './app/demos/mail/animation';
import { App } from './app/app';
import { routes } from './app/routes';

bootstrapApplication(App, {
  providers: [
    // 'computed' makes a refused back navigation leave history exactly as it was.
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ canceledNavigationResolution: 'computed' })),
    // The default order (an explicit hint, browser history, the kept stack,
    // `data.stackLevel` numbering, the route tree) with one app strategy added:
    // routes that name themselves in `data.animation`, as the Mail demo's do,
    // get their direction from a transition table.
    provideStackNav({
      // Opt in for this interactive demo; the library defaults to browser.
      swipeBack: 'custom',
      direction: [fromHint(), fromHistory(), fromStack(), fromAnimationData(MAIL_TRANSITIONS), fromLevel(), fromTree()],
    }),
    // Opt in: /items/1 → /items/2 becomes a new page instead of a reused component.
    { provide: RouteReuseStrategy, useClass: StackNavRouteReuseStrategy },
  ],
}).catch(console.error);
