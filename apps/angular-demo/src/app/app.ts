import { Component, afterRenderEffect, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { StackNavOutlet } from '@stacknav/angular';
import { filter, map } from 'rxjs';
import { FakeApi } from './demos/fake-api';
import { DemoPrefs } from './demos/shared';

@Component({
  selector: 'app-root',
  imports: [StackNavOutlet],
  template: `
    <div class="phone">
      <div class="progress" [class.on]="busy()" [attr.aria-hidden]="!busy()"></div>
      <sn-outlet />
    </div>
  `,
})
export class App {
  private readonly outlet = viewChild.required(StackNavOutlet);
  private readonly prefs = inject(DemoPrefs);
  private readonly api = inject(FakeApi);
  private readonly router = inject(Router);
  /** True while the router is between NavigationStart and its end: resolvers and lazy chunks show up here. */
  private readonly navigating = toSignal(
    this.router.events.pipe(
      map((e) => (e instanceof NavigationStart ? true : e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped ? false : null)),
      filter((v): v is boolean => v !== null),
    ),
    { initialValue: false },
  );
  /** A thin bar over the outlet: chrome that lives outside the stack and animates on its own. */
  readonly busy = computed(() => this.navigating() || this.api.inflight() > 0);

  constructor() {
    // The Lab's knobs go straight to the engine the outlet created.
    afterRenderEffect(() => {
      const { stack } = this.outlet();
      stack.transition.options.timeScale = this.prefs.slow() ? 4 : 1;
      stack.gesture.options.anywhere = this.prefs.anywhere();
      stack.gesture.refresh();
    });
  }
}
