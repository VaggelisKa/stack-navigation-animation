import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideStackNav } from '@stacknav/angular';
import { App } from './app/app';
import { routes } from './app/routes';

bootstrapApplication(App, {
  providers: [
    // 'computed' makes a refused back navigation leave history exactly as it was.
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ canceledNavigationResolution: 'computed' })),
    // The defaults resolve direction from: an explicit hint, browser history,
    // the kept stack, `data.stackLevel` numbering, then the route tree.
    provideStackNav({ bindToComponentInputs: true }),
  ],
}).catch(console.error);
