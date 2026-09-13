import { Component, afterRenderEffect, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { StackNav } from '@stacknav/angular';
import { detectPlatform, nativeTransitionPreset } from '@stacknav/core';
import { filter, map } from 'rxjs';
import { FakeApi } from './demos/fake-api';
import { DemoNav, DemoPrefs } from './demos/shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, StackNav],
  template: `
    <!-- The router's own outlet. snStack on the element around it is the whole integration. -->
    <div class="phone" snStack [snSwipeBack]="prefs.swipeBack()">
      <div class="progress" [class.on]="busy()" [attr.aria-hidden]="!busy()"></div>
      <router-outlet />
    </div>
  `,
})
export class App {
  private readonly stack = viewChild.required(StackNav);
  readonly prefs = inject(DemoPrefs);
  private readonly nav = inject(DemoNav);
  private readonly api = inject(FakeApi);
  private readonly router = inject(Router);
  /** True while the router is between NavigationStart and its end, which covers resolvers and lazy chunks. */
  private readonly navigating = toSignal(
    this.router.events.pipe(
      map((e) => (e instanceof NavigationStart ? true : e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped ? false : null)),
      filter((v): v is boolean => v !== null),
    ),
    { initialValue: false },
  );
  /** A thin bar over the pages: chrome that lives inside the stack element but outside the pages, and animates independently. */
  readonly busy = computed(() => this.navigating() || this.api.inflight() > 0);

  constructor() {
    // The Lab's settings are applied directly to the engine the stack created.
    afterRenderEffect(() => {
      const { stack } = this.stack();
      this.nav.stack = this.stack();
      // The platform is chosen once when a transition is created, so switching it
      // means putting the other preset's values into the live options.
      const chosen = this.prefs.platform();
      const platform = chosen === 'auto' ? detectPlatform() : chosen;
      Object.assign(stack.transition.options, nativeTransitionPreset(platform), { platform });
      stack.transition.options.timeScale = this.prefs.slow() ? 4 : 1;
      stack.transition.refresh();
      // The library ships no recognizer. This is the handle an app that owns the
      // edge would drive from its own pointer handling; the e2e suites use it.
      (globalThis as { __snStack?: typeof stack }).__snStack = stack;
    });
  }
}
