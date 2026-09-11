import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FakeApi, type Photo } from '../fake-api';
import { BackButton, DEMO_UI } from '../shared';

const paint = (p: Photo) => `linear-gradient(${p.angle}deg, hsl(${p.hues[0]} 70% 55%), hsl(${p.hues[1]} 65% 35%))`;

/** A dense three-column grid of tiles, on a light page. */
@Component({
  selector: 'gallery-grid',
  imports: [RouterLink, BackButton, ...DEMO_UI],
  template: `
    <div class="page gal">
      <header class="hdr gal-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1>Gallery</h1>
        <button type="button" class="gal-toggle" (click)="columns.set(columns() === 3 ? 2 : 3)" [attr.aria-label]="'Show ' + (columns() === 3 ? 2 : 3) + ' columns'">{{ columns() === 3 ? '▦' : '▤' }}</button>
      </header>
      @if (photos.error(); as e) {
        <demo-error [error]="e" (retry)="photos.reload()" />
      } @else if (photos.isLoading()) {
        <div class="gal-grid" [style.--cols]="columns()">
          @for (i of placeholders; track i) {
            <div class="gal-tile skel-tile"></div>
          }
        </div>
      } @else if (photos.hasValue()) {
        <div class="gal-grid" [style.--cols]="columns()">
          @for (p of photos.value(); track p.id) {
            <a class="gal-tile" [routerLink]="['/gallery', p.id]" [style.background]="paint(p)" [attr.aria-label]="p.title"></a>
          }
        </div>
      }
    </div>
  `,
})
export class GalleryGrid {
  private readonly api = inject(FakeApi);
  readonly photos = resource({ loader: () => this.api.photos() });
  readonly columns = signal(3);
  readonly placeholders = Array.from({ length: 18 }, (_, i) => i);
  readonly paint = paint;
}

/**
 * A dark viewer. The filmstrip's links are siblings in the route tree, so they
 * replace this page in place; "Next" is an explicit push so the stack grows
 * and swiping back retraces the photos you opened. A deferred block brings
 * the details in a moment after the page lands.
 */
@Component({
  selector: 'gallery-photo',
  imports: [RouterLink, BackButton, ...DEMO_UI],
  template: `
    <div class="page gal gal-dark">
      <header class="hdr gal-hdr-dark">
        <button type="button" class="back" snBack="/gallery">‹ Gallery</button>
        <h1>{{ photo.hasValue() ? photo.value().title : 'Photo' }}</h1>
        <button type="button" class="gal-like" [class.on]="liked()" (click)="liked.set(!liked())" aria-label="Like">{{ liked() ? '♥' : '♡' }}</button>
      </header>
      @if (photo.error(); as e) {
        <demo-error [error]="e" (retry)="photo.reload()" />
      } @else if (photo.hasValue()) {
        <div class="gal-stage">
          <div class="gal-photo" [style.background]="paint(photo.value())" [style.aspectRatio]="photo.value().ratio"></div>
        </div>
        <div class="gal-caption">
          <b>{{ photo.value().title }}</b>
          <span>{{ photo.value().place }}</span>
        </div>
        @defer (on timer(400ms)) {
          <dl class="gal-exif">
            <div><dt>Camera</dt><dd>Fable X100</dd></div>
            <div><dt>Lens</dt><dd>23 mm ƒ/2</dd></div>
            <div><dt>Exposure</dt><dd>1/{{ 60 + photo.value().id * 20 }} s</dd></div>
            <div><dt>ISO</dt><dd>{{ 100 * (1 + (photo.value().id % 5)) }}</dd></div>
          </dl>
        } @placeholder {
          <demo-skeleton [lines]="2" />
        }
        <div class="gal-strip">
          @for (n of strip(); track n) {
            <a [routerLink]="['/gallery', n]" [class.on]="n === id()" [style.background]="'hsl(' + ((n * 47) % 360) + ' 60% 45%)'" [attr.aria-label]="'Photo ' + n"></a>
          }
        </div>
        <div class="gal-nav">
          <span>{{ id() }} / {{ count }}</span>
          @if (id() < count) {
            <a [pushTo]="['/gallery', id() + 1]">Next ›</a>
          }
        </div>
      } @else {
        <demo-spinner />
      }
    </div>
  `,
})
export class GalleryPhoto {
  readonly idParam = input.required<string>({ alias: 'id' });
  private readonly api = inject(FakeApi);
  readonly id = computed(() => Number(this.idParam()));
  readonly count = this.api.photoCount();
  readonly photo = resource({ params: () => this.id(), loader: ({ params }) => this.api.photo(params) });
  readonly liked = signal(false);
  readonly strip = computed(() => {
    const lo = Math.max(1, Math.min(this.id() - 3, this.count - 6));
    return Array.from({ length: 7 }, (_, i) => lo + i);
  });
  readonly paint = paint;
}
