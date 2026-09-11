import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { StackNavBack } from '@stacknav/angular';
import { FakeApi, type SearchResult } from '../fake-api';
import { DEMO_UI } from '../shared';

const ICONS: Record<SearchResult['kind'], string> = { person: '◉', product: '◱', post: '◌', photo: '▣' };

/**
 * Type-ahead search: every keystroke waits 300 ms, then queries the backend and
 * aborts any request still in flight. The query lives in the URL, replaced
 * rather than pushed. Results link into the other demos, and a pop back to this
 * page finds the text, the results and the scroll position unchanged.
 */
@Component({
  selector: 'search-home',
  imports: [StackNavBack, ...DEMO_UI],
  template: `
    <div class="page srch">
      <header class="hdr srch-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1 class="sr-only">Search</h1>
        <div class="srch-box">
          <span aria-hidden="true">⌕</span>
          <input #box type="search" placeholder="Search people, products, posts…" [value]="text()" (input)="text.set($any($event.target).value)" autocomplete="off" />
          @if (text()) {
            <button type="button" (click)="text.set(''); box.focus()" aria-label="Clear">×</button>
          }
        </div>
      </header>
      @if (!text().trim()) {
        <div class="srch-hint">
          <p>Try one of these:</p>
          @for (s of suggestions; track s) {
            <button type="button" class="srch-chip" (click)="text.set(s)">{{ s }}</button>
          }
        </div>
      } @else if (error(); as e) {
        <demo-error [error]="e" (retry)="run(text())" />
      } @else {
        <div class="srch-status">
          @if (loading()) {
            <demo-spinner /> Searching…
          } @else {
            {{ results().length }} result{{ results().length === 1 ? '' : 's' }} for “{{ searched() }}”
          }
        </div>
        @for (r of results(); track r.id) {
          <a class="srch-row" [pushTo]="r.link">
            <i [attr.data-kind]="r.kind">{{ icons[r.kind] }}</i>
            <span><b>{{ r.title }}</b><small>{{ r.subtitle }}</small></span>
            <em>›</em>
          </a>
        } @empty {
          @if (!loading()) {
            <p class="srch-empty">Nothing matches “{{ searched() }}”.</p>
          }
        }
      }
    </div>
  `,
})
export class SearchHome {
  /** Read once from `?q=`, so later URL updates do not overwrite what is being typed. */
  readonly q = input<string>();
  private readonly api = inject(FakeApi);
  private readonly router = inject(Router);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  readonly text = signal('');
  readonly searched = signal('');
  readonly results = signal<SearchResult[]>([]);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  readonly suggestions = ['lamp', 'ada', 'swipe', 'fog', 'audio'];
  readonly icons = ICONS;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    let seeded = false;
    effect(() => {
      const q = this.q();
      if (seeded || !q) return;
      seeded = true;
      untracked(() => this.text.set(q));
    });
    effect(() => {
      const t = this.text();
      untracked(() => {
        clearTimeout(this.timer);
        this.abort?.abort();
        this.abort = null;
        this.loading.set(!!t.trim());
        this.error.set(null);
        this.timer = setTimeout(() => void this.run(t), 300);
      });
    });
    afterNextRender(() => {
      if (!this.text()) this.box().nativeElement.focus();
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.abort?.abort();
    });
  }

  async run(t: string): Promise<void> {
    void this.router.navigate([], { queryParams: { q: t.trim() || null }, replaceUrl: true, queryParamsHandling: 'merge' });
    if (!t.trim()) {
      this.results.set([]);
      this.searched.set('');
      this.loading.set(false);
      return;
    }
    const ctrl = (this.abort = new AbortController());
    this.loading.set(true);
    this.error.set(null);
    try {
      const rs = await this.api.search(t, ctrl.signal);
      if (ctrl.signal.aborted) return;
      this.results.set(rs);
      this.searched.set(t.trim());
    } catch (e) {
      if (ctrl.signal.aborted) return;
      this.error.set(e);
    } finally {
      if (this.abort === ctrl) {
        this.abort = null;
        this.loading.set(false);
      }
    }
  }
}
