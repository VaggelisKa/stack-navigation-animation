import { Component, input, signal } from '@angular/core';
import { StackNavBack } from '@stacknav/angular';

@Component({
  selector: 'app-reviews',
  imports: [StackNavBack],
  template: `
    <div class="page">
      <header class="hdr"><button type="button" class="back" [snBack]="['/items', id()]">‹ Item {{ id() }}</button><h1>Reviews</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">Three levels deep. Swipe from the left edge, press the browser back button, or tap Back: all three pop.</p>
        @for (r of reviews; track r) {<div class="item"><span>{{ r }}</span></div>}
        <h2>Guards</h2>
        <label class="item"><span>Block leaving (canDeactivate)</span><input type="checkbox" [checked]="lock()" (change)="lock.set($any($event.target).checked)"></label>
        <p class="lede">With this on, a swipe or back press is refused by the router and the page settles back into place.</p>
      </div>
    </div>
  `,
})
export class Reviews {
  readonly id = input.required<string>();
  readonly lock = signal(false);
  readonly reviews = ['Five stars, would push again.', 'Popped right back where I was.', 'The parallax is subtle. I like it.'];
}
