import { Location } from '@angular/common';
import { Component, Directive, Injectable, computed, inject, input, output, signal } from '@angular/core';
import { ChildrenOutletContexts, PRIMARY_OUTLET, Router } from '@angular/router';
import { StackNav, type StackNavOutlet } from '@stacknav/angular';
import { initials } from './fake-api';

/** Knobs the Lab page turns; the App applies them to the outlet. */
@Injectable({ providedIn: 'root' })
export class DemoPrefs {
  /** 4× slower transitions, to watch what happens mid-flight. */
  readonly slow = signal(false);
  /** Start the back gesture from anywhere on the page, not only the leading edge. */
  readonly anywhere = signal(false);
}

/**
 * "Pop to root": go back to a page that is still kept beneath, unwinding
 * history by as many entries as there are pages above it. The demos push one
 * history entry per page (replaced pages use `replaceUrl` too), so the count
 * matches; a browser back afterwards then lands where a user expects.
 */
@Injectable({ providedIn: 'root' })
export class DemoNav {
  private readonly nav = inject(StackNav);
  private readonly location = inject(Location);
  private readonly contexts = inject(ChildrenOutletContexts);

  popTo(url: string): void {
    const outlet = this.contexts.getContext(PRIMARY_OUTLET)?.outlet as StackNavOutlet | null;
    const pages = outlet?.pages ?? [];
    const i = pages.findIndex((p) => p.url === url);
    if (i >= 0 && i < pages.length - 1) this.location.historyGo(i - (pages.length - 1));
    else void this.nav.navigateByUrl(url, { direction: 'pop', replaceUrl: true });
  }
}

/**
 * `<a [pushTo]="['/feed/post', 3]">`: a link that always pushes, whatever the
 * route tree says. For flows that can grow without bound (post → author →
 * post → author …) where the tree would call the cross-links siblings.
 */
@Directive({
  selector: 'a[pushTo]',
  host: { '[attr.href]': 'href()', '(click)': 'onClick($event)' },
})
export class PushLink {
  readonly pushTo = input.required<readonly unknown[]>();
  private readonly nav = inject(StackNav);
  private readonly router = inject(Router);
  readonly href = computed(() => this.router.serializeUrl(this.router.createUrlTree(this.pushTo() as unknown[])));

  onClick(event: MouseEvent): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void this.nav.push(this.pushTo());
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

/** Grey shimmering placeholders, `[lines]` of them. */
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

export const DEMO_UI = [Avatar, Skeleton, ErrorBox, Spinner, PushLink] as const;
