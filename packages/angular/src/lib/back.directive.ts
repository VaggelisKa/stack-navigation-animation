import { Directive, inject, input } from '@angular/core';
import type { UrlTree } from '@angular/router';
import { StackNav } from './stacknav.service';

/**
 * A back button: `<button snBack>` goes back through history, and
 * `<button snBack="/items">` (or `[snBack]="['/']"`) navigates there with a
 * pop when there is no history to go back to (after a deep link, say).
 */
@Directive({
  selector: '[snBack]',
  host: { '(click)': 'onClick($event)' },
})
export class StackNavBack {
  readonly fallback = input<readonly unknown[] | string | UrlTree | null | undefined, unknown>(null, {
    alias: 'snBack',
    transform: (v: unknown) => (v === '' || v == null ? null : (v as readonly unknown[] | string | UrlTree)),
  });
  private readonly nav = inject(StackNav);

  onClick(event: Event): void {
    event.preventDefault();
    void this.nav.pop(this.fallback() ?? undefined);
  }
}
