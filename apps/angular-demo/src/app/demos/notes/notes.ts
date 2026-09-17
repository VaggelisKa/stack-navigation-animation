import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FakeApi, type Note } from '../fake-api';
import { DEMO_UI } from '../shared';
import { LargeTitle } from './large-title';

const when = (m: number) =>
  m < 60
    ? `${m} min ago`
    : m < 1440
      ? `${Math.round(m / 60)}h ago`
      : m < 2880
        ? 'Yesterday'
        : `${Math.round(m / 1440)} days ago`;

/**
 * The list, with the header iOS gives a first screen: large title at rest,
 * collapsed into the bar once scrolled. The collapse is read from the page's
 * scroll offset and nothing else, and the stack keeps that offset while the
 * page sits beneath a note, so coming back finds the header exactly as it was.
 */
@Component({
  selector: 'notes-list',
  imports: [RouterLink, LargeTitle, ...DEMO_UI],
  template: `
    <div class="page notes">
      <demo-large-title title="Notes" back="/" backLabel="Demos">
        <button type="button" class="notes-sort" aria-label="Change sort order" (click)="sort.set(sort() === 'recent' ? 'title' : 'recent')">{{ sort() === 'recent' ? 'Recent' : 'A–Z' }}</button>
      </demo-large-title>
      @if (notes.error(); as e) {
        <demo-error [error]="e" (retry)="notes.reload()" />
      } @else if (notes.hasValue()) {
        @for (group of groups(); track group.name) {
          <h2 class="notes-h2">{{ group.name }}</h2>
          <div class="notes-list">
            @for (n of group.notes; track n.id) {
              <a class="notes-row" [routerLink]="['/notes', n.id]">
                <b>{{ n.title }}</b>
                <span><time>{{ when(n.minutesAgo) }}</time><small>{{ n.body[0] }}</small></span>
              </a>
            }
          </div>
        }
        <p class="notes-count">{{ notes.value().length }} notes</p>
      } @else {
        <div class="notes-list">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="notes-row"><demo-skeleton [lines]="2" /></div>
          }
        </div>
      }
      <div class="body notes-about">
        <h2>How this header works</h2>
        <p class="lede">The bar is sticky and the large title is not, so the title scrolls out from under a bar that stays. A passive listener on the page's own scroll container turns its <code>scrollTop</code> into the opacity of each title; no signal is written, so scrolling costs no change detection.</p>
        <div class="notes-rules">
          <div><code>scrollTop 0</code><b>52 + 52px, large title</b></div>
          <div><code>scrolled past it</code><b>52px, title in the bar</b></div>
          <div><code>pulled down</code><b>the large title stretches</b></div>
        </div>
        <p class="lede">There is no state to restore: the header is a function of the scroll offset, and a page kept beneath another keeps that offset. Open a note, swipe back, and the list is where you left it, still collapsed. A note whose title wraps gets a taller header than this one, and the bar collapses over the longer distance.</p>
      </div>
    </div>
  `,
})
export class NotesList {
  private readonly api = inject(FakeApi);
  readonly notes = resource({ loader: () => this.api.notes() });
  readonly sort = signal<'recent' | 'title'>('recent');
  /** Pinned first, as the real app does, then everything else in the chosen order. */
  readonly groups = computed(() => {
    const all = this.notes.value() ?? [];
    const order = (a: Note, b: Note) =>
      this.sort() === 'recent' ? a.minutesAgo - b.minutesAgo : a.title.localeCompare(b.title);
    const group = (name: string, notes: Note[]) => ({ name, notes: notes.sort(order) });
    return [
      group(
        'Pinned',
        all.filter((n) => n.pinned),
      ),
      group(
        'All notes',
        all.filter((n) => !n.pinned),
      ),
    ].filter((g) => g.notes.length > 0);
  });
  readonly when = when;
}

/**
 * One note, pushed over the list. Its large title is the note's own, so the
 * header is as tall as the title needs: the long one wraps to several lines,
 * and the same scroll offset collapses it that collapses the list's.
 */
@Component({
  selector: 'notes-note',
  imports: [LargeTitle, ...DEMO_UI],
  template: `
    <div class="page notes">
      <demo-large-title [title]="note.hasValue() ? note.value().title : 'Note'" back="/notes" backLabel="Notes" />
      @if (note.error(); as e) {
        <demo-error [error]="e" (retry)="note.reload()" />
      } @else if (note.hasValue()) {
        <div class="notes-body">
          <p class="notes-when">Edited {{ when(note.value().minutesAgo) }}</p>
          @for (p of note.value().body; track $index) {
            <p>{{ p }}</p>
          }
        </div>
      } @else {
        <div class="notes-body"><demo-skeleton [lines]="6" /></div>
      }
    </div>
  `,
})
export class NotesNote {
  readonly id = input.required<string>();
  private readonly api = inject(FakeApi);
  readonly note = resource({
    params: () => Number(this.id()),
    loader: ({ params }) => this.api.note(params),
  });
  readonly when = when;
}
