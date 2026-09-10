import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StackNavBack } from '@stacknav/angular';
import { FakeApi } from '../fake-api';
import { DEMO_UI } from '../shared';

/**
 * A kept page with a nested `<router-outlet>`: the segmented control swaps
 * children inside this page without touching the stack. When a member's page
 * is pushed over it the router deactivates the child route; the shell stays
 * alive and, on the pop back, the same tab is activated again in it.
 */
@Component({
  selector: 'dash-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, StackNavBack],
  template: `
    <div class="page dash">
      <header class="hdr dash-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1>Dashboard</h1>
        <span class="spacer"></span>
      </header>
      <!-- Tabs replace the history entry, so Back leaves the dashboard instead of walking the tabs. -->
      <nav class="dash-tabs">
        <a routerLink="overview" routerLinkActive="on" replaceUrl>Overview</a>
        <a routerLink="activity" routerLinkActive="on" replaceUrl>Activity</a>
        <a routerLink="team" routerLinkActive="on" replaceUrl>Team</a>
      </nav>
      <router-outlet />
    </div>
  `,
})
export class DashShell {}

@Component({
  selector: 'dash-overview',
  imports: [...DEMO_UI],
  template: `
    <div class="dash-body">
      <div class="dash-range" role="tablist">
        @for (r of ranges; track r) {
          <button type="button" role="tab" [attr.aria-selected]="range() === r" (click)="range.set(r)">{{ r }}</button>
        }
      </div>
      @if (stats.error(); as e) {
        <demo-error [error]="e" (retry)="stats.reload()" />
      } @else if (stats.hasValue()) {
        <div class="dash-tiles" [class.stale]="stats.isLoading()">
          @for (t of stats.value().tiles; track t.label) {
            <div class="dash-tile">
              <small>{{ t.label }}</small>
              <b>{{ t.value }}</b>
              <span [class.up]="t.delta > 0" [class.down]="t.delta < 0">{{ t.delta > 0 ? '▲' : t.delta < 0 ? '▼' : '—' }} {{ abs(t.delta) }}%</span>
            </div>
          }
        </div>
        <div class="dash-card">
          <h3>Requests per {{ range() === 'day' ? 'hour' : 'day' }}</h3>
          <div class="dash-chart" [class.stale]="stats.isLoading()">
            @for (b of stats.value().bars; track $index) {
              <i [style.height.%]="b.value * 100" [title]="b.label"></i>
            }
          </div>
        </div>
      } @else {
        <div class="dash-tiles">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="dash-tile skel-tile"></div>
          }
        </div>
        <div class="dash-card"><demo-skeleton [lines]="4" /></div>
      }
    </div>
  `,
})
export class DashOverview {
  private readonly api = inject(FakeApi);
  readonly ranges = ['day', 'week', 'month'] as const;
  readonly range = signal<(typeof this.ranges)[number]>('week');
  readonly stats = resource({ params: () => this.range(), loader: ({ params }) => this.api.stats(params) });
  readonly abs = Math.abs;
}

/** A table wider than the phone, scrolling sideways inside the page. */
@Component({
  selector: 'dash-activity',
  imports: [...DEMO_UI],
  template: `
    <div class="dash-body">
      @if (rows.error(); as e) {
        <demo-error [error]="e" (retry)="rows.reload()" />
      } @else if (rows.hasValue()) {
        <div class="dash-filters">
          @for (s of ['all', 'ok', 'warn', 'fail']; track s) {
            <button type="button" [class.on]="filter() === s" (click)="filter.set(s)">{{ s }}</button>
          }
        </div>
        <div class="dash-scroll">
          <table class="dash-table">
            <thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Service</th><th>Status</th><th>Duration</th></tr></thead>
            <tbody>
              @for (r of shown(); track r.id) {
                <tr>
                  <td>{{ r.when }}</td><td>{{ r.who }}</td><td>{{ r.what }}</td><td><code>{{ r.where }}</code></td>
                  <td><span class="dash-pill" [attr.data-s]="r.status">{{ r.status }}</span></td><td>{{ r.duration }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <demo-skeleton [lines]="8" />
      }
    </div>
  `,
})
export class DashActivity {
  private readonly api = inject(FakeApi);
  readonly rows = resource({ loader: () => this.api.activity() });
  readonly filter = signal('all');
  readonly shown = computed(() => (this.rows.hasValue() ? this.rows.value().filter((r) => this.filter() === 'all' || r.status === this.filter()) : []));
}

@Component({
  selector: 'dash-team',
  imports: [RouterLink, DecimalPipe, ...DEMO_UI],
  template: `
    <div class="dash-body">
      @if (team.error(); as e) {
        <demo-error [error]="e" (retry)="team.reload()" />
      } @else if (team.hasValue()) {
        <div class="dash-card dash-list">
          @for (m of team.value(); track m.id) {
            <a class="dash-member" [routerLink]="['/dashboard/team', m.id]">
              <demo-avatar [name]="m.name" [hue]="m.hue" [size]="40" />
              <span><b>{{ m.name }}</b><small>{{ m.role }} · {{ m.timezone }}</small></span>
              <em>{{ m.commits | number }}</em>
            </a>
          }
        </div>
      } @else {
        <div class="dash-card"><demo-skeleton [lines]="6" /></div>
      }
    </div>
  `,
})
export class DashTeam {
  private readonly api = inject(FakeApi);
  readonly team = resource({ loader: () => this.api.team() });
}

/** Pushed over the whole dashboard (a descendant in the route tree), with links out to other demos. */
@Component({
  selector: 'dash-member',
  imports: [StackNavBack, DecimalPipe, ...DEMO_UI],
  template: `
    <div class="page dash">
      <header class="hdr dash-hdr">
        <button type="button" class="back" snBack="/dashboard/team">‹ Team</button>
        <h1>{{ member.hasValue() ? member.value().name : 'Member' }}</h1>
        <span class="spacer"></span>
      </header>
      <div class="dash-body">
        @if (member.error(); as e) {
          <demo-error [error]="e" (retry)="member.reload()" />
        } @else if (member.hasValue()) {
          <div class="dash-card dash-profile">
            <demo-avatar [name]="member.value().name" [hue]="member.value().hue" [size]="64" />
            <h2>{{ member.value().name }}</h2>
            <p>{{ member.value().role }} · {{ member.value().timezone }}</p>
            <div class="dash-tiles">
              <div class="dash-tile"><small>Commits</small><b>{{ member.value().commits | number }}</b></div>
              <div class="dash-tile"><small>Focus</small><b>{{ member.value().focus.join(', ') }}</b></div>
            </div>
            <a class="btn" [pushTo]="['/messages', member.value().id]">Message</a>
            <a class="btn ghost" [pushTo]="['/feed/user', member.value().handle]">Posts</a>
          </div>
        } @else {
          <div class="dash-card"><demo-skeleton [lines]="4" /></div>
        }
      </div>
    </div>
  `,
})
export class DashMember {
  readonly id = input.required<string>();
  private readonly api = inject(FakeApi);
  readonly member = resource({ params: () => Number(this.id()), loader: ({ params }) => this.api.member(params) });
}
