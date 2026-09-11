import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTHORS, FakeApi, type Message } from '../fake-api';
import { BackButton, DEMO_UI } from '../shared';

/** An inbox: rows with unread badges, loaded once and kept; a refresh re-asks the backend. */
@Component({
  selector: 'chat-inbox',
  imports: [RouterLink, BackButton, DecimalPipe, ...DEMO_UI],
  template: `
    <div class="page chat">
      <header class="hdr chat-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1>Messages</h1>
        <button type="button" class="chat-refresh" (click)="conversations.reload()" [disabled]="conversations.isLoading()" aria-label="Refresh">↻</button>
      </header>
      <div class="chat-search"><input placeholder="Search" [value]="filter()" (input)="filter.set($any($event.target).value)" /></div>
      @if (conversations.error(); as e) {
        <demo-error [error]="e" (retry)="conversations.reload()" />
      } @else if (conversations.isLoading() && !conversations.hasValue()) {
        @for (i of [1, 2, 3, 4, 5, 6]; track i) {
          <div class="chat-row"><div class="avatar skel-circle"></div><demo-skeleton [lines]="2" /></div>
        }
      } @else if (conversations.hasValue()) {
        @for (c of shown(); track c.id) {
          <a class="chat-row" [routerLink]="['/messages', c.id]" [class.unread]="c.unread > 0">
            <demo-avatar [name]="c.with.name" [hue]="c.with.hue" [size]="48" />
            <div class="chat-row-body">
              <div><b>{{ c.with.name }}</b><time>{{ c.minutesAgo < 60 ? c.minutesAgo + 'm' : (c.minutesAgo / 60 | number: '1.0-0') + 'h' }}</time></div>
              <p>{{ c.last }}</p>
            </div>
            @if (c.unread) {
              <span class="chat-badge">{{ c.unread }}</span>
            }
          </a>
        } @empty {
          <p class="chat-empty">No conversations match.</p>
        }
      }
    </div>
  `,
})
export class ChatInbox {
  private readonly api = inject(FakeApi);
  readonly conversations = resource({ loader: () => this.api.conversations() });
  readonly filter = signal('');
  readonly shown = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.conversations.hasValue() ? this.conversations.value() : [];
    return q ? all.filter((c) => c.with.name.toLowerCase().includes(q)) : all;
  });
}

/**
 * A thread: bubbles, a composer stuck to the bottom of the scroll container,
 * and replies that keep arriving after you have popped back to the inbox.
 */
@Component({
  selector: 'chat-thread',
  imports: [BackButton, ...DEMO_UI],
  template: `
    <div class="page chat chat-thread">
      <header class="hdr chat-hdr">
        <button type="button" class="back" snBack="/messages">‹ Messages</button>
        <div class="chat-peer">
          @if (peer(); as p) {
            <demo-avatar [name]="p.name" [hue]="p.hue" [size]="30" />
            <h1>{{ p.name }}</h1>
          } @else {
            <h1>Conversation</h1>
          }
        </div>
        <span class="spacer"></span>
      </header>
      <div class="chat-log">
        @if (thread.isLoading()) {
          <demo-spinner />
        } @else if (thread.error(); as e) {
          <demo-error [error]="e" (retry)="thread.reload()" />
        } @else {
          @for (m of messages(); track m.id) {
            <div class="chat-bubble" [class.mine]="m.mine">{{ m.text }}<time>{{ m.at }}</time></div>
          }
          @if (typing()) {
            <div class="chat-bubble chat-typing"><i></i><i></i><i></i></div>
          }
        }
      </div>
      <form class="chat-composer" (submit)="send($event)">
        <input name="text" placeholder="Message" autocomplete="off" [value]="draft()" (input)="draft.set($any($event.target).value)" />
        <button type="submit" [disabled]="!draft().trim()" aria-label="Send">↑</button>
      </form>
    </div>
  `,
})
export class ChatThread {
  readonly id = input.required<string>();
  private readonly api = inject(FakeApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Null for an id that names no conversation (`/messages/0`, `/messages/foo`); the thread resource reports the error. */
  readonly peer = computed(() => {
    const n = Number(this.id());
    return Number.isInteger(n) && n >= 1 && n <= AUTHORS.length ? AUTHORS[n - 1] : null;
  });
  readonly thread = resource({ params: () => Number(this.id()), loader: ({ params }) => this.api.thread(params) });
  readonly sent = signal<Message[]>([]);
  /** What the backend gave us plus what happened since; a reload of the thread carries the latter, so dedupe. */
  readonly messages = computed(() => {
    const base = this.thread.hasValue() ? this.thread.value() : [];
    const seen = new Set(base.map((m) => m.id));
    return [...base, ...this.sent().filter((m) => !seen.has(m.id))];
  });
  readonly draft = signal('');
  readonly typing = signal(false);

  constructor() {
    // Keep the newest bubble in view whenever the log grows. The host element is the scroll container.
    afterRenderEffect(() => {
      this.messages();
      this.typing();
      this.host.scrollTop = this.host.scrollHeight;
    });
  }

  async send(e: Event): Promise<void> {
    e.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    const { sent, reply } = this.api.send(Number(this.id()), text);
    this.sent.update((s) => [...s, sent]);
    this.typing.set(true);
    try {
      const r = await reply;
      this.sent.update((s) => [...s, r]);
    } catch {
      this.sent.update((s) => [...s, { id: Date.now(), mine: false, text: '⚠︎ Not delivered', at: 'now' }]);
    } finally {
      this.typing.set(false);
    }
  }
}
