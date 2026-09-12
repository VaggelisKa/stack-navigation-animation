import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { useBack } from '../../back';
import { FakeApi } from '../fake-api';
import { BackButton, DEMO_UI } from '../shared';
import { MAIL_TRANSITIONS } from './animation';

const ago = (m: number) => (m < 60 ? `${m}m` : m < 60 * 24 ? `${Math.round(m / 60)}h` : `${Math.round(m / 60 / 24)}d`);

/**
 * A folder: Inbox or Sent, one component for both, told which by route data.
 * The two folders are siblings in the route tree and switch with `replaceUrl`,
 * and their `data.animation` names make that switch a replace.
 */
@Component({
  selector: 'mail-folder',
  imports: [RouterLink, RouterLinkActive, BackButton, ...DEMO_UI],
  template: `
    <div class="page mail">
      <header class="hdr mail-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1>{{ folder() === 'sent' ? 'Sent' : 'Inbox' }}</h1>
        <a class="mail-action" routerLink="/mail/compose" aria-label="Compose">✎</a>
      </header>
      <nav class="mail-folders">
        <a routerLink="/mail" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" replaceUrl>Inbox</a>
        <a routerLink="/mail/sent" routerLinkActive="on" replaceUrl>Sent</a>
      </nav>
      @if (mail.error(); as e) {
        <demo-error [error]="e" (retry)="mail.reload()" />
      } @else if (mail.hasValue()) {
        <div class="mail-list">
          @for (m of mail.value(); track m.id) {
            <a class="mail-row" [routerLink]="['/mail/thread', m.id]" [class.unread]="m.unread">
              <demo-avatar [name]="m.from.name" [hue]="m.from.hue" [size]="40" />
              <span class="mail-row-body">
                <span><b>{{ m.from.name }}</b><time>{{ ago(m.minutesAgo) }}</time></span>
                <strong>{{ m.subject }}</strong>
                <p>{{ m.preview }}</p>
              </span>
            </a>
          }
        </div>
      } @else {
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="mail-row"><div class="avatar skel-circle"></div><demo-skeleton [lines]="2" /></div>
        }
      }
      <div class="body mail-about">
        <h2>How this demo decides</h2>
        <p class="lede">Every route here is a sibling. Each names itself in <code>data.animation</code>, as Angular's route-transition recipe does, and a strategy looks the pair up in this table. This page is <code>{{ animation }}</code>.</p>
        <div class="mail-rules">
          @for (r of rules; track r.pair) {
            <div><code>{{ r.pair }}</code><b>{{ r.direction }}</b></div>
          }
        </div>
      </div>
    </div>
  `,
})
export class MailFolder {
  /** Bound from route data by `withComponentInputBinding()`. */
  readonly folder = input<'inbox' | 'sent'>('inbox');
  private readonly api = inject(FakeApi);
  /** Reloads when the folder changes and after a send, so a kept Sent folder shows what was just filed. */
  readonly mail = resource({ params: () => ({ folder: this.folder(), version: this.api.mailVersion() }), loader: ({ params }) => this.api.mail(params.folder) });
  /** The same `data.animation` the strategy reads, from the page's own `ActivatedRoute`. */
  readonly animation: string = inject(ActivatedRoute).snapshot.data['animation'];
  readonly rules = Object.entries(MAIL_TRANSITIONS).map(([pair, direction]) => ({ pair, direction }));
  readonly ago = ago;
}

/** One email, pushed over its folder. Reply opens the composer over this page. */
@Component({
  selector: 'mail-thread',
  imports: [RouterLink, BackButton, ...DEMO_UI],
  template: `
    <div class="page mail">
      <header class="hdr mail-hdr">
        <button type="button" class="back" snBack="/mail">‹ Back</button>
        <h1>{{ email.hasValue() ? email.value().subject : 'Message' }}</h1>
        <a class="mail-action" [routerLink]="['/mail/compose']" [queryParams]="{ re: id() }" aria-label="Reply">↩</a>
      </header>
      @if (email.error(); as e) {
        <demo-error [error]="e" (retry)="email.reload()" />
      } @else if (email.hasValue()) {
        <div class="mail-message">
          <div class="mail-from">
            <demo-avatar [name]="email.value().from.name" [hue]="email.value().from.hue" [size]="44" />
            <span><b>{{ email.value().from.name }}</b><small>{{ email.value().from.handle }}&#64;example.com · {{ ago(email.value().minutesAgo) }}</small></span>
          </div>
          <h2>{{ email.value().subject }}</h2>
          @for (p of email.value().body; track $index) {
            <p>{{ p }}</p>
          }
          <a class="btn" [routerLink]="['/mail/compose']" [queryParams]="{ re: id() }">Reply</a>
        </div>
      } @else {
        <div class="mail-message"><demo-skeleton [lines]="6" /></div>
      }
    </div>
  `,
})
export class MailThread {
  readonly id = input.required<string>();
  private readonly api = inject(FakeApi);
  readonly email = resource({ params: () => Number(this.id()), loader: ({ params }) => this.api.email(params) });
  readonly ago = ago;
}

/**
 * The composer. `* <=> Compose: push` makes it open over whatever page asked
 * for it, a folder or a thread, and Send or Cancel pop back to that page.
 */
@Component({
  selector: 'mail-compose',
  imports: [BackButton, ...DEMO_UI],
  template: `
    <div class="page mail">
      <header class="hdr mail-hdr">
        <button type="button" class="back" snBack="/mail">Cancel</button>
        <h1>{{ re() ? 'Reply' : 'New message' }}</h1>
        <button type="button" class="mail-action" (click)="send()" [disabled]="!canSend() || sending()">{{ sending() ? '…' : 'Send' }}</button>
      </header>
      @if (error(); as e) {
        <demo-error [error]="e" (retry)="send()" />
      }
      <form class="mail-form" (submit)="$event.preventDefault(); send()">
        <label><span>To</span><input name="to" [value]="to()" (input)="to.set($any($event.target).value)" autocomplete="off" /></label>
        <label><span>Subject</span><input name="subject" [value]="subject()" (input)="subject.set($any($event.target).value)" autocomplete="off" /></label>
        <textarea name="text" rows="10" placeholder="Write something…" [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
      </form>
    </div>
  `,
})
export class MailCompose {
  /** `?re=<id>`: a reply to that message, bound from the query param. */
  readonly re = input<string>();
  private readonly api = inject(FakeApi);
  private readonly back = useBack();
  /** The message being replied to, if any. Its arrival prefills the fields below. */
  private readonly original = resource({ params: () => Number(this.re()) || undefined, loader: ({ params }) => this.api.email(params) });
  readonly to = linkedSignal(() => (this.original.hasValue() ? `${this.original.value().from.handle}@example.com` : ''));
  readonly subject = linkedSignal(() => (this.original.hasValue() ? `Re: ${this.original.value().subject}` : ''));
  readonly text = signal('');
  readonly sending = signal(false);
  /** A failed send: shown above the form, the draft kept. */
  readonly error = signal<unknown>(null);
  readonly canSend = computed(() => this.to().trim() !== '' && this.subject().trim() !== '');

  async send(): Promise<void> {
    if (!this.canSend() || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.api.sendMail({ to: this.to(), subject: this.subject(), text: this.text() });
      this.back(['/mail']);
    } catch (e) {
      this.error.set(e);
    } finally {
      this.sending.set(false);
    }
  }
}
