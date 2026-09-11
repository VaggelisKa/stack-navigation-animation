import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { useBack } from '../back';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="hdr"><button type="button" class="back" (click)="back(['/'])">‹ Back</button><h1>Settings</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">This route carries <code>data.stackLevel = 2</code>. Home is unnumbered and About is 3, so About pushes over this and Home is a pop.</p>
        <a class="item" routerLink="/about"><span>About</span><small>stackLevel 3</small><i>›</i></a>
        <a class="item" routerLink="/"><span>Home, via routerLink</span><small>pops: it is kept beneath</small><i>›</i></a>
        <button class="item" type="button" (click)="router.navigate(['/about'], { info: { stacknav: 'replace' } })"><span>About, as a replace</span><small>this page goes away</small><i>›</i></button>
      </div>
    </div>
  `,
})
export class Settings {
  readonly router = inject(Router);
  readonly back = useBack();
}
