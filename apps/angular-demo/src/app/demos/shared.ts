import { Location } from '@angular/common';
import { Component, Directive, Injectable, computed, inject, input, output, signal } from '@angular/core';
import { ChildrenOutletContexts, PRIMARY_OUTLET, Router } from '@angular/router';
import { type SwipeBackMode, type StackNavOutlet } from '@stacknav/angular';
import { useBack } from '../back';
import { initials } from './fake-api';

/** Settings the Lab page changes. The App applies them to the outlet. */
@Injectable({ providedIn: 'root' })
export class DemoPrefs {
  /** This demo explicitly opts into custom gestures; the library default is browser. */
  readonly swipeBack = signal<SwipeBackMode>('custom');
  /** 4x slower transitions, for inspecting a transition mid-flight. */
  readonly slow = signal(false);
  /** Start the back gesture from anywhere on the page, not only the leading edge. */
  readonly anywhere = signal(false);
}

/**
 * "Pop to root": goes back to a page still kept beneath, unwinding history by
 * as many entries as there are pages above it. The demos push one history entry
 * per page, and replaced pages use `replaceUrl`, so the counts match and a
 * browser back afterwards lands on the expected page.
 */
@Injectable({ providedIn: 'root' })
export class DemoNav {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly contexts = inject(ChildrenOutletContexts);

  popTo(url: string): void {
    const outlet = this.contexts.getContext(PRIMARY_OUTLET)?.outlet as StackNavOutlet | null;
    const pages = outlet?.pages ?? [];
    const i = pages.findIndex((p) => p.url === url);
    if (i >= 0 && i < pages.length - 1) this.location.historyGo(i - (pages.length - 1));
    else void this.router.navigateByUrl(url, { replaceUrl: true, info: { stacknav: 'pop' } });
  }
}

/**
 * `<button snBack="/shop">`: goes back through history, falling back to that
 * route as a pop after a deep link. The library has no back API of its own.
 * This is the app's `useBack()` wrapped in a directive, so the demo headers stay
 * a single line.
 */
@Directive({
  selector: '[snBack]',
  host: { '(click)': 'onClick($event)' },
})
export class BackButton {
  readonly fallback = input<readonly unknown[] | null, unknown>(null, {
    alias: 'snBack',
    transform: (v: unknown) => (v === '' || v == null ? null : Array.isArray(v) ? (v as readonly unknown[]) : [v]),
  });
  private readonly back = useBack();
  private readonly location = inject(Location);

  onClick(event: Event): void {
    event.preventDefault();
    const fallback = this.fallback();
    if (fallback) this.back(fallback);
    else this.location.back();
  }
}

/**
 * `<a [pushTo]="['/feed/post', 3]">`: a link that always pushes, regardless of
 * what the route tree says. Useful for flows that can grow without bound
 * (post → author → post → author …), where the tree would treat the cross-links
 * as siblings.
 */
@Directive({
  selector: 'a[pushTo]',
  host: { '[attr.href]': 'href()', '(click)': 'onClick($event)' },
})
export class PushLink {
  readonly pushTo = input.required<readonly unknown[]>();
  private readonly router = inject(Router);
  readonly href = computed(() => this.router.serializeUrl(this.router.createUrlTree(this.pushTo() as unknown[])));

  onClick(event: MouseEvent): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.router.navigate([...this.pushTo()], { info: { stacknav: 'push' } });
  }
}

@Component({
  selector: 'demo-avatar',
  template: `{{ text() }}`,
  host: {
    class: 'avatar',
    '[style.background]': '"hsl(" + hue() + " 55% 52%)"',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.fontSize.px]': 'size() * 0.38',
  },
})
export class Avatar {
  readonly name = input.required<string>();
  readonly hue = input.required<number>();
  readonly size = input(40);
  readonly text = computed(() => initials(this.name()));
}

/** A loading placeholder: `[lines]` shimmering grey bars. */
@Component({
  selector: 'demo-skeleton',
  template: `
    @for (w of widths(); track $index) {
      <div class="skel-line" [style.width.%]="w"></div>
    }
  `,
  host: { class: 'skel', 'aria-busy': 'true' },
})
export class Skeleton {
  readonly lines = input(3);
  readonly widths = computed(() => Array.from({ length: this.lines() }, (_, i) => [92, 70, 84, 55, 78][i % 5]));
}

/** An error message with a retry button. */
@Component({
  selector: 'demo-error',
  template: `
    <strong>Couldn't load.</strong>
    <span>{{ message() }}</span>
    <button type="button" (click)="retry.emit()">Try again</button>
  `,
  host: { class: 'err', role: 'alert' },
})
export class ErrorBox {
  readonly error = input.required<unknown>();
  readonly retry = output();
  readonly message = computed(() => (this.error() instanceof Error ? (this.error() as Error).message : String(this.error())));
}

@Component({
  selector: 'demo-spinner',
  template: '',
  host: { class: 'spinner', role: 'progressbar', 'aria-label': 'Loading' },
})
export class Spinner {}

export const DEMO_UI = [Avatar, Skeleton, ErrorBox, Spinner, PushLink, BackButton] as const;
