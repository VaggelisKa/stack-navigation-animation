import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StackNav } from '@stacknav/angular';

export const ITEMS = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="hdr"><span class="spacer"></span><h1>stacknav</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">An Angular router outlet with the iOS push/pop transition. Pages stay alive beneath the top: scroll down, open something, swipe back.</p>
        <h2>State survives</h2>
        <div class="counter item"><span>Counter (kept while you are away)</span>
          <button type="button" (click)="count.set(count() - 1)">−</button><b>{{ count() }}</b><button type="button" (click)="count.set(count() + 1)">+</button>
        </div>
        <h2>Numbered screens</h2>
        <a class="item" routerLink="/settings"><span>Settings</span><small>stackLevel 2</small><i>›</i></a>
        <a class="item" routerLink="/about"><span>About</span><small>stackLevel 3</small><i>›</i></a>
        <h2>Explicit direction</h2>
        <button class="item" type="button" (click)="nav.replace(['/settings'])"><span>Settings, as a replace</span><i>›</i></button>
        <button class="item" type="button" (click)="nav.push(['/items', 7], { animated: false })"><span>Item 7, no animation</span><i>›</i></button>
        <h2>From the route tree</h2>
        @for (item of items; track item.id) {
          <a class="item" [routerLink]="['/items', item.id]"><span>{{ item.name }}</span><i>›</i></a>
        }
      </div>
    </div>
  `,
})
export class Home {
  readonly items = ITEMS;
  readonly count = signal(0);
  readonly nav = inject(StackNav);
}
