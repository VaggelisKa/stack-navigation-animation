import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { detectPlatform } from '@stacknav/core';
import { FakeApi } from '../fake-api';
import { BackButton, DEMO_UI, DemoNav, DemoPrefs } from '../shared';

/** Controls for the engine and the fake backend, plus pages that stress them. */
@Component({
  selector: 'lab-home',
  imports: [RouterLink, BackButton],
  template: `
    <div class="page lab">
      <header class="hdr"><button type="button" class="back" snBack="/">‹ Demos</button><h1>Lab</h1><span class="spacer"></span></header>
      <div class="body">
        <h2>Transition</h2>
        <div class="frm-group">
          <label class="lab-row"><span>Platform</span>
            <select [value]="prefs.platform()" (change)="prefs.platform.set($any($event.target).value)">
              <option value="auto">Auto ({{ detected }})</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
            </select>
          </label>
          <label class="switch"><span>Slow motion (4×)</span><input type="checkbox" [checked]="prefs.slow()" (change)="prefs.slow.set($any($event.target).checked)" /><i></i></label>
          <label class="switch"><span>Swipe back from anywhere</span><input type="checkbox" [disabled]="prefs.swipeBack() !== 'custom'" [checked]="prefs.anywhere()" (change)="prefs.anywhere.set($any($event.target).checked)" /><i></i></label>
        </div>
        <section aria-labelledby="swipe-title">
          <h2 id="swipe-title">Swipe back</h2>
          <fieldset class="swipe-modes" aria-describedby="swipe-help">
            <legend>Choose who handles the gesture</legend>
            @for (mode of swipeModes; track mode.value) {
              <label class="swipe-mode">
                <input type="radio" name="swipe-back" [value]="mode.value" [checked]="prefs.swipeBack() === mode.value" (change)="prefs.swipeBack.set(mode.value)" />
                <span><strong>{{ mode.label }}</strong><small>{{ mode.description }}</small></span>
              </label>
            }
          </fieldset>
          <p id="swipe-help" class="muted">This demo starts in Custom. Browser is the library default. Browser gesture suppression depends on your browser and OS; Back buttons work in every mode.</p>
          <p class="muted" role="status">Active mode: {{ prefs.swipeBack() }}. Applies immediately to the main demo outlet.</p>
          <a class="item" routerLink="/lab/deep/1"><span>Try the selected mode</span><small>Open a page, then swipe back or use Back</small><i>›</i></a>
        </section>
        <h2>Fake backend</h2>
        <div class="frm-group">
          <label class="lab-range"><span>Latency <b>{{ api.latency() }} ms</b></span><input type="range" min="0" max="3000" step="100" [value]="api.latency()" (input)="api.latency.set(+$any($event.target).value)" /></label>
          <label class="switch"><span>Every request fails</span><input type="checkbox" [checked]="api.failing()" (change)="api.failing.set($any($event.target).checked)" /><i></i></label>
          <div class="lab-row"><span>In flight</span><b>{{ api.inflight() }}</b></div>
        </div>
        <h2>Stress</h2>
        <a class="item" routerLink="/lab/stress"><span>Heavy page</span><small>600 rows, gradients, blur</small><i>›</i></a>
        <a class="item" routerLink="/lab/deep/1"><span>Deep stack</span><small>push without end, pop to root</small><i>›</i></a>
        <a class="item" routerLink="/lab/slow"><span>Slow page</span><small>a resolver that takes 2 s</small><i>›</i></a>
        <a class="item" routerLink="/lab/wide"><span>Wide content</span><small>horizontal scrollers vs the edge swipe</small><i>›</i></a>
      </div>
    </div>
  `,
})
export class LabHome {
  readonly swipeModes = [
    { value: 'custom', label: 'Custom', description: 'Drag the page with our interactive preview. Requests browser swipe suppression.' },
    { value: 'browser', label: 'Browser', description: 'Our gesture is off. Use your browser’s normal back gesture.' },
    { value: 'disabled', label: 'Disabled', description: 'Our gesture is off. Requests browser swipe suppression where supported.' },
  ] as const;
  readonly prefs = inject(DemoPrefs);
  readonly api = inject(FakeApi);
  readonly detected = detectPlatform() === 'android' ? 'Android' : 'iOS';
}

@Component({
  selector: 'lab-stress',
  imports: [BackButton],
  template: `
    <div class="page lab">
      <header class="hdr"><button type="button" class="back" snBack="/lab">‹ Lab</button><h1>Heavy page</h1><span class="spacer"></span></header>
      <div class="lab-stress">
        @for (r of rows; track r) {
          <div class="lab-stress-row" [style.--h]="(r * 13) % 360">
            <i></i>
            <span><b>Row {{ r }}</b><small>{{ (r * 7919) % 1000 }} things · {{ (r * 31) % 60 }} min ago</small></span>
            <em>{{ (r * 17) % 100 }}%</em>
          </div>
        }
      </div>
    </div>
  `,
})
export class LabStress {
  readonly rows = Array.from({ length: 600 }, (_, i) => i + 1);
}

/** `/lab/deep/1`, `/lab/deep/2`, …: siblings pushed by hint. A pop to a kept page unwinds them all. */
@Component({
  selector: 'lab-deep',
  imports: [BackButton, ...DEMO_UI],
  template: `
    <div class="page lab" [style.background]="'hsl(' + ((depth() * 37) % 360) + ' 40% 96%)'">
      <header class="hdr"><button type="button" class="back" [snBack]="depth() === 1 ? '/lab' : ['/lab/deep', depth() - 1]">‹ Back</button><h1>Depth {{ depth() }}</h1><span class="spacer"></span></header>
      <div class="body">
        <div class="lab-depth">
          @for (d of stack(); track d) {
            <i [style.--h]="(d * 37) % 360" [class.top]="d === depth()"></i>
          }
        </div>
        <p class="lede">{{ depth() }} page{{ depth() === 1 ? '' : 's' }} kept in the stack, plus whatever came before.</p>
        <a class="item" [pushTo]="['/lab/deep', depth() + 1]"><span>Push depth {{ depth() + 1 }}</span><i>›</i></a>
        <button class="item" type="button" (click)="nav.popTo('/lab')"><span>Pop to the lab</span><small>one animation, {{ depth() }} pages dropped</small><i>›</i></button>
        <button class="item" type="button" (click)="nav.popTo('/')"><span>Pop to the demos</span><i>›</i></button>
      </div>
    </div>
  `,
})
export class LabDeep {
  readonly n = input.required<string>();
  readonly nav = inject(DemoNav);
  readonly depth = computed(() => Math.max(1, Number(this.n()) || 1));
  readonly stack = computed(() => Array.from({ length: this.depth() }, (_, i) => i + 1));
}

@Component({
  selector: 'lab-slow',
  imports: [BackButton],
  template: `
    <div class="page lab">
      <header class="hdr"><button type="button" class="back" snBack="/lab">‹ Lab</button><h1>Slow page</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">A resolver held this navigation for {{ ms() }} ms. The lab page stayed interactive, the progress bar ran, and the push began only once the data was here: <b>{{ word() }}</b>.</p>
      </div>
    </div>
  `,
})
export class LabSlow {
  readonly slowly = input.required<{ ms: number; word: string }>();
  readonly ms = computed(() => this.slowly().ms);
  readonly word = computed(() => this.slowly().word);
}

@Component({
  selector: 'lab-wide',
  imports: [BackButton],
  template: `
    <div class="page lab">
      <header class="hdr"><button type="button" class="back" snBack="/lab">‹ Lab</button><h1>Wide content</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">Horizontal scrollers start at the page's left edge. The swipe wins inside the edge strip; the scroller wins everywhere else.</p>
        @for (row of rows; track row) {
          <h2>Row {{ row }}</h2>
          <div class="lab-scroller">
            @for (i of cells; track i) {
              <div [style.--h]="(row * 50 + i * 20) % 360">{{ i }}</div>
            }
          </div>
        }
        <h2>A wide table</h2>
        <div class="dash-scroll">
          <table class="dash-table">
            <thead><tr>@for (c of cells; track c) {<th>Col {{ c }}</th>}</tr></thead>
            <tbody>@for (r of rows; track r) {<tr>@for (c of cells; track c) {<td>{{ r * c }}</td>}</tr>}</tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class LabWide {
  readonly rows = [1, 2, 3, 4, 5];
  readonly cells = Array.from({ length: 12 }, (_, i) => i + 1);
}
