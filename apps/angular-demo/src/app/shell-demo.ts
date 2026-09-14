import { afterRenderEffect, Component, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StackNav, StackNavFillViewport } from '@stacknav/angular';

/** Open /?shell to try an auto-height microfrontend slot below a shell header. */
@Component({
  selector: 'app-root',
  host: { 'data-shell-demo': '' },
  imports: [RouterOutlet, StackNav, StackNavFillViewport],
  styles: `
    :host { display: block; width: 100%; height: auto; }
    .shell-header { height: 80px; padding: 12px; background: #dde8ff; color: #111; }
    .shell-header.expanded { height: 140px; }
    .microfrontend { display: block; }
  `,
  template: `
    <header class="shell-header" [class.expanded]="expanded()">
      <strong>Application shell</strong>
      <button (click)="expanded.set(!expanded())">Resize header</button>
      <button (click)="mounted.set(!mounted())">Toggle microfrontend</button>
    </header>
    <main class="microfrontend">
      @if (mounted()) {
        <div class="embedded-stack" stackNavFillViewport style="height: 123px; box-sizing: content-box">
          <router-outlet stackNav />
        </div>
      }
    </main>
  `,
})
export class ShellDemo {
  readonly expanded = signal(false);
  readonly mounted = signal(true);
  private readonly outlet = viewChild(StackNav);

  constructor() {
    afterRenderEffect(() => {
      const outlet = this.outlet();
      if (outlet) (globalThis as { __snStack?: typeof outlet.stack }).__snStack = outlet.stack;
    });
  }
}
