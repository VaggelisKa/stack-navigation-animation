import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

export const ITEMS = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="hdr"><span class="spacer"></span><h1>stacknav</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">An Angular router outlet with the iOS push/pop transition. Pages stay alive beneath the top: scroll down, open something, swipe back.</p>
        <h2>Demo apps</h2>
        @for (d of demos; track d.path) {
          <a class="item" [routerLink]="d.path"><span>{{ d.name }}</span><small>{{ d.note }}</small><i>›</i></a>
        }
        <h2>State survives</h2>
        <div class="counter item"><span>Counter (kept while you are away)</span>
          <button type="button" (click)="count.set(count() - 1)">−</button><b>{{ count() }}</b><button type="button" (click)="count.set(count() + 1)">+</button>
        </div>
        <h2>Numbered screens</h2>
        <a class="item" routerLink="/settings"><span>Settings</span><small>stackLevel 2</small><i>›</i></a>
        <a class="item" routerLink="/about"><span>About</span><small>stackLevel 3</small><i>›</i></a>
        <h2>Explicit direction, through the router's <code>info</code></h2>
        <button class="item" type="button" (click)="router.navigate(['/settings'], { info: { stacknav: 'replace' } })"><span>Settings, as a replace</span><i>›</i></button>
        <button class="item" type="button" (click)="router.navigate(['/items', 7], { info: { stacknav: { direction: 'push', animated: false } } })"><span>Item 7, no animation</span><i>›</i></button>
        <h2>From the route tree</h2>
        @for (item of items; track item.id) {
          <a class="item" [routerLink]="['/items', item.id]"><span>{{ item.name }}</span><i>›</i></a>
        }
      </div>
    </div>
  `,
})
export class Home {
  readonly demos = [
    { path: '/feed', name: 'Feed', note: 'skeletons, load more, profiles' },
    { path: '/shop', name: 'Shop', note: 'grid, resolver, cart, checkout' },
    { path: '/messages', name: 'Messages', note: 'sticky composer, late replies' },
    { path: '/gallery', name: 'Gallery', note: 'dark viewer, filmstrip, @defer' },
    { path: '/forms', name: 'Forms', note: 'long form, numbered wizard' },
    { path: '/search', name: 'Search', note: 'debounced, cancelled, in the URL' },
    { path: '/dashboard', name: 'Dashboard', note: 'nested outlet, wide table' },
    { path: '/mail', name: 'Mail', note: 'direction from data.animation' },
    { path: '/lab', name: 'Lab', note: 'swipe modes, slow motion, stress' },
  ];
  readonly items = ITEMS;
  readonly count = signal(0);
  readonly router = inject(Router);
}
