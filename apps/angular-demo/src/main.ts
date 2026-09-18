import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideStackNav } from '@stacknav/angular';
import { MAIL_TRANSITIONS, byAnimationData } from './app/demos/mail/animation';
import { App } from './app/app';
import { ShellDemo, SHELL_DEMO_ROUTES } from './app/shell-demo';
import { DocumentShellDemo, DOCUMENT_SHELL_ROUTES } from './app/document-shell-demo';
import { routes } from './app/routes';

// `?shell`: a microfrontend below a shell header, sized to the viewport.
// `?shell=document`: the same, but the document scrolls the pages and the
// shell's header collapses on `window.scrollY`.
const shell = new URLSearchParams(location.search).get('shell');
const documentShell = shell === 'document';
const shellDemo = shell !== null && !documentShell;
bootstrapApplication(documentShell ? DocumentShellDemo : shellDemo ? ShellDemo : App, {
  providers: [
    // 'computed' makes a refused back navigation leave history exactly as it was.
    provideRouter(
      documentShell ? DOCUMENT_SHELL_ROUTES : shellDemo ? SHELL_DEMO_ROUTES : routes,
      withComponentInputBinding(),
      withRouterConfig({ canceledNavigationResolution: 'computed' }),
    ),
    provideStackNav({
      // One rule of the app's own, on top of what the library already decides:
      // routes that name themselves in `data.animation`, as the Mail demo's do,
      // get their direction from a transition table. Everything else falls
      // through to `data.stackLevel` numbering and the route tree.
      direction: byAnimationData(MAIL_TRANSITIONS),
      // No `swipeBack` here: the browser keeps the gesture, which is both the
      // library default and the only thing it offers. Lab switches to `disabled`.
      // The document-scrolling shell is the one place the pages are not their
      // own scroll containers.
      scroll: documentShell ? 'document' : 'page',
    }),
    // Nothing else: provideStackNav() also installs StackNavRouteReuseStrategy,
    // so /items/1 → /items/2 is a page of its own rather than a reused component.
  ],
}).catch(console.error);
