import { Component, DestroyRef, Injectable, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FakeApi } from '../fake-api';
import { BackButton, DEMO_UI, DemoNav } from '../shared';

@Component({
  selector: 'forms-home',
  imports: [RouterLink, BackButton],
  template: `
    <div class="page frm">
      <header class="hdr"><button type="button" class="back" snBack="/">‹ Demos</button><h1>Forms</h1><span class="spacer"></span></header>
      <div class="body">
        <p class="lede">Inputs keep their text, toggles keep their state and a half-finished wizard keeps its place, because the pages beneath the top are never destroyed.</p>
        <h2>Pages</h2>
        <a class="item" routerLink="/forms/profile"><span>Edit profile</span><small>long form, async save</small><i>›</i></a>
        <a class="item" routerLink="/forms/wizard/1"><span>Sign-up wizard</span><small>numbered steps, replaced ending</small><i>›</i></a>
        <a class="item" routerLink="/forms/preferences"><span>Preferences</span><small>grouped toggles</small><i>›</i></a>
      </div>
    </div>
  `,
})
export class FormsHome {}

/** A long form with a sticky save bar. Saving takes a while and the button says so. */
@Component({
  selector: 'forms-profile',
  imports: [BackButton, ...DEMO_UI],
  template: `
    <div class="page frm">
      <header class="hdr"><button type="button" class="back" snBack="/forms">‹ Forms</button><h1>Edit profile</h1><span class="spacer"></span></header>
      <form class="frm-form" (submit)="save($event)">
        <div class="frm-avatar"><demo-avatar [name]="name() || 'You'" [hue]="hue()" [size]="80" /><input type="range" min="0" max="360" [value]="hue()" (input)="hue.set(+$any($event.target).value)" aria-label="Avatar colour" /></div>
        <h2>About you</h2>
        <div class="frm-group">
          <label><span>Name</span><input name="name" [value]="name()" (input)="name.set($any($event.target).value)" autocomplete="name" /></label>
          <label><span>Handle</span><input name="handle" [value]="handle()" (input)="handle.set($any($event.target).value)" /></label>
          <label><span>Pronouns</span>
            <select name="pronouns" [value]="pronouns()" (change)="pronouns.set($any($event.target).value)">
              <option value="">—</option><option>she/her</option><option>he/him</option><option>they/them</option>
            </select>
          </label>
          <label class="tall"><span>Bio</span><textarea name="bio" rows="3" [value]="bio()" (input)="bio.set($any($event.target).value)"></textarea></label>
        </div>
        <h2>Contact</h2>
        <div class="frm-group">
          <label><span>Email</span><input name="email" type="email" [value]="email()" (input)="email.set($any($event.target).value)" autocomplete="email" /></label>
          <label><span>Phone</span><input name="phone" type="tel" [value]="phone()" (input)="phone.set($any($event.target).value)" autocomplete="tel" /></label>
          <label><span>Website</span><input name="site" type="url" [value]="site()" (input)="site.set($any($event.target).value)" /></label>
          <label><span>Location</span><input name="location" [value]="location()" (input)="location.set($any($event.target).value)" /></label>
        </div>
        <h2>Visibility</h2>
        <div class="frm-group">
          <label class="switch"><span>Public profile</span><input type="checkbox" [checked]="isPublic()" (change)="isPublic.set($any($event.target).checked)" /><i></i></label>
          <label class="switch"><span>Show email</span><input type="checkbox" [checked]="showEmail()" (change)="showEmail.set($any($event.target).checked)" /><i></i></label>
          <label class="switch"><span>Searchable</span><input type="checkbox" [checked]="searchable()" (change)="searchable.set($any($event.target).checked)" /><i></i></label>
        </div>
        <p class="frm-hint">{{ dirty() ? 'Unsaved changes.' : 'Everything is saved.' }}</p>
        <div class="frm-savebar">
          <button type="submit" [disabled]="saving() || !dirty()">
            @if (saving()) {
              <demo-spinner /> Saving…
            } @else {
              Save
            }
          </button>
        </div>
      </form>
      @if (toast(); as t) {
        <div class="toast" role="status">{{ t }}</div>
      }
    </div>
  `,
})
export class FormsProfile {
  private readonly api = inject(FakeApi);
  readonly name = signal('Ada Lindqvist');
  readonly handle = signal('ada');
  readonly pronouns = signal('she/her');
  readonly bio = signal('Builds small things that move well.');
  readonly email = signal('ada@example.com');
  readonly phone = signal('');
  readonly site = signal('https://example.com');
  readonly location = signal('Stockholm');
  readonly hue = signal(210);
  readonly isPublic = signal(true);
  readonly showEmail = signal(false);
  readonly searchable = signal(true);
  readonly saving = signal(false);
  readonly toast = signal<string | null>(null);
  private readonly fields = [this.name, this.handle, this.pronouns, this.bio, this.email, this.phone, this.site, this.location, this.hue, this.isPublic, this.showEmail, this.searchable] as const;
  private readonly snapshot = signal(this.take());
  readonly dirty = computed(() => this.take() !== this.snapshot());

  private take(): string {
    return JSON.stringify(this.fields.map((f) => f()));
  }

  async save(e: Event): Promise<void> {
    e.preventDefault();
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.placeOrder([]); // any slow call will do
      this.snapshot.set(this.take());
      this.showToast('Profile saved');
    } catch (err) {
      this.showToast(err instanceof Error ? err.message : 'Could not save');
    } finally {
      this.saving.set(false);
    }
  }
  private showToast(t: string): void {
    this.toast.set(t);
    setTimeout(() => this.toast.set(null), 1800);
  }
}

/** Shared by the wizard's steps, so a step popped back to still has its answers. */
@Injectable({ providedIn: 'root' })
export class Wizard {
  readonly plan = signal<'free' | 'pro' | 'team'>('pro');
  readonly seats = signal(3);
  readonly org = signal('');
  readonly agree = signal(false);
  readonly submitted = signal<string | null>(null);
  reset(): void {
    this.plan.set('pro');
    this.seats.set(3);
    this.org.set('');
    this.agree.set(false);
    this.submitted.set(null);
  }
}

/**
 * Three steps at `/forms/wizard/1..3`. Siblings in the route tree, but each
 * route carries `stackLevel`, so the numbering strategy pushes forward and
 * pops back. The last step replaces itself with the confirmation.
 */
@Component({
  selector: 'forms-wizard',
  imports: [RouterLink, BackButton, ...DEMO_UI],
  template: `
    <div class="page frm">
      <header class="hdr">
        <button type="button" class="back" [snBack]="stepNo() === 1 ? '/forms' : ['/forms/wizard', stepNo() - 1]">‹ Back</button>
        <h1>Step {{ stepNo() }} of 3</h1>
        <span class="spacer"></span>
      </header>
      <div class="frm-progress"><i [style.width.%]="(stepNo() / 3) * 100"></i></div>
      <div class="body">
        @switch (stepNo()) {
          @case (1) {
            <h2>Choose a plan</h2>
            <div class="frm-plans">
              @for (p of plans; track p.id) {
                <button type="button" class="frm-plan" [class.on]="wizard.plan() === p.id" (click)="wizard.plan.set(p.id)">
                  <b>{{ p.name }}</b><span>{{ p.price }}</span><small>{{ p.blurb }}</small>
                </button>
              }
            </div>
            <div class="frm-savebar static"><a class="btn" routerLink="/forms/wizard/2">Continue</a></div>
          }
          @case (2) {
            <h2>Your team</h2>
            <div class="frm-group">
              <label><span>Organisation</span><input name="org" [value]="wizard.org()" (input)="wizard.org.set($any($event.target).value)" placeholder="Acme" /></label>
              <label><span>Seats</span>
                <span class="frm-stepper">
                  <button type="button" (click)="wizard.seats.set(max(1, wizard.seats() - 1))" aria-label="Fewer">−</button>
                  <b>{{ wizard.seats() }}</b>
                  <button type="button" (click)="wizard.seats.set(wizard.seats() + 1)" aria-label="More">＋</button>
                </span>
              </label>
            </div>
            <p class="frm-hint">{{ wizard.seats() }} × {{ wizard.plan() }} plan</p>
            <div class="frm-savebar static"><a class="btn" routerLink="/forms/wizard/3" [class.disabled]="!wizard.org().trim()">Continue</a></div>
          }
          @case (3) {
            <h2>Review</h2>
            <div class="frm-group frm-review">
              <div><span>Plan</span><b>{{ wizard.plan() }}</b></div>
              <div><span>Organisation</span><b>{{ wizard.org() }}</b></div>
              <div><span>Seats</span><b>{{ wizard.seats() }}</b></div>
            </div>
            <div class="frm-group"><label class="switch frm-agree"><span>I agree to the terms</span><input type="checkbox" [checked]="wizard.agree()" (change)="wizard.agree.set($any($event.target).checked)" /><i></i></label></div>
            @if (error(); as e) {
              <demo-error [error]="e" (retry)="error.set(null)" />
            }
            <div class="frm-savebar static">
              <button type="button" class="btn" [disabled]="!wizard.agree() || busy()" (click)="finish()">
                @if (busy()) {
                  <demo-spinner /> Creating account…
                } @else {
                  Create account
                }
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class FormsWizard {
  readonly step = input.required<string>();
  readonly stepNo = computed(() => Math.min(3, Math.max(1, Number(this.step()) || 1)));
  readonly wizard = inject(Wizard);
  private readonly api = inject(FakeApi);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal<unknown>(null);
  readonly max = Math.max;
  readonly plans = [
    { id: 'free', name: 'Free', price: '$0', blurb: 'For trying it out.' },
    { id: 'pro', name: 'Pro', price: '$12 / seat', blurb: 'For people who ship.' },
    { id: 'team', name: 'Team', price: '$29 / seat', blurb: 'For everyone at once.' },
  ] as const;

  async finish(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const order = await this.api.placeOrder([]);
      this.wizard.submitted.set(order.id);
      await this.router.navigate(['/forms/wizard/done'], { replaceUrl: true, info: { stacknav: 'replace' } });
    } catch (e) {
      this.error.set(e);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'forms-done',
  template: `
    <div class="page frm frm-done">
      <header class="hdr"><span class="spacer"></span><h1>All set</h1><span class="spacer"></span></header>
      <div class="frm-done-body">
        <div class="frm-check">✓</div>
        <h2>Welcome, {{ wizard.org() || 'friend' }}</h2>
        <p>{{ wizard.seats() }} seats on the {{ wizard.plan() }} plan. Reference {{ wizard.submitted() }}.</p>
        <p class="muted">This page replaced step 3. Steps 1 and 2 are still kept beneath, so a swipe lands on step 2; the button below pops all the way to the forms list.</p>
        <button type="button" class="btn" (click)="finish()">Done</button>
      </div>
    </div>
  `,
})
export class FormsDone {
  readonly wizard = inject(Wizard);
  private readonly nav = inject(DemoNav);
  constructor() {
    // Reset once this page is gone, not while it is still animating out.
    inject(DestroyRef).onDestroy(() => this.wizard.reset());
  }
  finish(): void {
    this.nav.popTo('/forms');
  }
}

/** An iOS-style grouped settings list: plenty of toggles, all kept. */
@Component({
  selector: 'forms-preferences',
  imports: [BackButton],
  template: `
    <div class="page frm">
      <header class="hdr"><button type="button" class="back" snBack="/forms">‹ Forms</button><h1>Preferences</h1><span class="spacer"></span></header>
      <div class="body">
        @for (group of groups; track group.title) {
          <h2>{{ group.title }}</h2>
          <div class="frm-group">
            @for (row of group.rows; track row.key) {
              @if (row.options) {
                <label><span>{{ row.label }}</span>
                  <select [value]="values()[row.key]" (change)="set(row.key, $any($event.target).value)">
                    @for (o of row.options; track o) {
                      <option [value]="o">{{ o }}</option>
                    }
                  </select>
                </label>
              } @else {
                <label class="switch"><span>{{ row.label }}</span><input type="checkbox" [checked]="values()[row.key]" (change)="set(row.key, $any($event.target).checked)" /><i></i></label>
              }
            }
          </div>
        }
        <p class="frm-hint">{{ changed() }} setting{{ changed() === 1 ? '' : 's' }} changed from the defaults.</p>
      </div>
    </div>
  `,
})
export class FormsPreferences {
  readonly groups = [
    { title: 'Notifications', rows: [{ key: 'push', label: 'Push notifications' }, { key: 'email', label: 'Email digests' }, { key: 'sounds', label: 'Sounds' }, { key: 'badge', label: 'Badge count' }] },
    { title: 'Appearance', rows: [{ key: 'theme', label: 'Theme', options: ['System', 'Light', 'Dark'] }, { key: 'size', label: 'Text size', options: ['Small', 'Default', 'Large'] }, { key: 'motion', label: 'Reduce motion' }, { key: 'contrast', label: 'High contrast' }] },
    { title: 'Privacy', rows: [{ key: 'analytics', label: 'Share analytics' }, { key: 'crash', label: 'Crash reports' }, { key: 'ads', label: 'Personalised ads' }, { key: 'location', label: 'Location', options: ['Never', 'While using', 'Always'] }] },
    { title: 'Data', rows: [{ key: 'wifi', label: 'Sync on Wi-Fi only' }, { key: 'quality', label: 'Image quality', options: ['Low', 'Medium', 'High'] }, { key: 'cache', label: 'Keep cache' }] },
  ] as { title: string; rows: { key: string; label: string; options?: string[] }[] }[];
  private readonly defaults: Record<string, string | boolean> = { push: true, email: false, sounds: true, badge: true, theme: 'System', size: 'Default', motion: false, contrast: false, analytics: true, crash: true, ads: false, location: 'While using', wifi: true, quality: 'Medium', cache: true };
  readonly values = signal({ ...this.defaults });
  readonly changed = computed(() => Object.keys(this.defaults).filter((k) => this.values()[k] !== this.defaults[k]).length);
  set(key: string, value: string | boolean): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }
}
