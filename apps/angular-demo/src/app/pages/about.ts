import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { useBack } from '../back';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="hdr"><button type="button" class="back" (click)="back(['/settings'])">‹ Back</button><h1>About</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede"><code>stackLevel = 3</code>. Nothing here is prescribed by the engine: the numbers live on your routes.</p>
        <a class="item" routerLink="/settings"><span>Settings</span><small>pop: 3 → 2</small><i>›</i></a>
      </div>
    </div>
  `,
})
export class About {
  readonly back = useBack();
}
