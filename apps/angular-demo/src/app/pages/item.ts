import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { useBack } from '../back';

@Component({
  selector: 'app-item',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="hdr"><button type="button" class="back" (click)="back(['/'])">‹ Back</button><h1>Item {{ id() }}</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">Route <code>/items/{{ id() }}</code>. The id arrives through the router's <code>withComponentInputBinding()</code>, and keeps arriving when this page is reached again.</p>
        <h2>Deeper in the tree</h2>
        <a class="item" routerLink="reviews"><span>Reviews</span><i>›</i></a>
        <h2>Siblings</h2>
        <a class="item" [routerLink]="['/items', next()]"><span>Item {{ next() }}, via routerLink</span><small>tree says replace</small><i>›</i></a>
        <button class="item" type="button" (click)="router.navigate(['/items', next()], { info: { stacknav: 'push' } })"><span>Item {{ next() }}, via info hint</span><small>hinted push</small><i>›</i></button>
        <h2>Back</h2>
        <button class="item" type="button" (click)="back(['/'])"><span>Back</span><small>history back, or / after a deep link</small><i>›</i></button>
      </div>
    </div>
  `,
})
export class Item {
  readonly id = input.required<string>();
  readonly next = computed(() => Number(this.id()) + 1);
  readonly router = inject(Router);
  readonly back = useBack();
}
