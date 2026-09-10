import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StackNavBack } from '@stacknav/angular';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, StackNavBack],
  template: `
    <div class="page">
      <header class="hdr"><button type="button" class="back" snBack="/">‹ Back</button><h1>Settings</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">This route carries <code>data.stackLevel = 2</code>. Home is unnumbered and About is 3, so About pushes over this and Home is a pop.</p>
        <a class="item" routerLink="/about"><span>About</span><small>stackLevel 3</small><i>›</i></a>
        <a class="item" routerLink="/"><span>Home, via routerLink</span><small>pops: it is kept beneath</small><i>›</i></a>
      </div>
    </div>
  `,
})
export class Settings {}
