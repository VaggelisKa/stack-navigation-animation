import { Component } from '@angular/core';
import { StackNavOutlet } from '@stacknav/angular';

@Component({
  selector: 'app-root',
  imports: [StackNavOutlet],
  template: `<div class="phone"><sn-outlet /></div>`,
})
export class App {}
