import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { StackNavBack } from '@stacknav/angular';
import { FakeApi, type Post } from '../fake-api';
import { DEMO_UI } from '../shared';

/** One post as a card; the list, the post page and the profile all use it. */
@Component({
  selector: 'feed-card',
  imports: [...DEMO_UI],
  template: `
    <a class="feed-author" [pushTo]="['/feed/user', post().author.handle]">
      <demo-avatar [name]="post().author.name" [hue]="post().author.hue" [size]="36" />
      <span><b>{{ post().author.name }}</b><small>&#64;{{ post().author.handle }} · {{ ago() }}</small></span>
    </a>
    <p>{{ post().text }}</p>
    @if (post().image; as img) {
      <div class="feed-image" [style.background]="'linear-gradient(135deg, hsl(' + img[0] + ' 70% 60%), hsl(' + img[1] + ' 70% 40%))'"></div>
    }
    <div class="feed-actions">
      <button type="button" (click)="like()" [class.on]="liked()">{{ liked() ? '♥' : '♡' }} {{ post().likes + (liked() ? 1 : 0) }}</button>
      <a [pushTo]="['/feed/post', post().id]">◌ {{ post().comments }}</a>
      <span>↗ share</span>
    </div>
  `,
  host: { class: 'feed-card' },
})
export class FeedCard {
  readonly post = input.required<Post>();
  readonly liked = signal(false);
  readonly ago = computed(() => {
    const m = this.post().minutesAgo;
    return m < 60 ? `${m}m` : m < 60 * 24 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
  });
  like(): void {
    this.liked.update((v) => !v);
  }
}

/**
 * A social timeline: the first page loads behind a shimmering skeleton, more
 * pages append on demand, and every kept card remembers its likes.
 */
@Component({
  selector: 'feed-home',
  imports: [FeedCard, StackNavBack, ...DEMO_UI],
  template: `
    <div class="page feed">
      <header class="hdr feed-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1>Feed</h1>
        <button type="button" class="feed-refresh" (click)="refresh()" [disabled]="loading()" aria-label="Refresh">↻</button>
      </header>
      @if (error(); as e) {
        <demo-error [error]="e" (retry)="refresh()" />
      }
      @for (post of posts(); track post.id) {
        <feed-card [post]="post" />
      }
      @if (loading()) {
        <demo-skeleton [lines]="4" />
        <demo-skeleton [lines]="3" />
        <demo-skeleton [lines]="4" />
      } @else if (!error()) {
        <div class="feed-more">
          @if (done()) {
            <span>You're all caught up.</span>
          } @else {
            <button type="button" (click)="more()">Load more</button>
          }
        </div>
      }
    </div>
  `,
})
export class FeedHome {
  private readonly api = inject(FakeApi);
  readonly posts = signal<Post[]>([]);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);
  readonly done = signal(false);
  private page = 0;

  constructor() {
    void this.more();
  }

  async more(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const batch = await this.api.posts(this.page);
      this.posts.update((p) => [...p, ...batch]);
      this.page++;
      if (batch.length < 10) this.done.set(true);
    } catch (e) {
      this.error.set(e);
    } finally {
      this.loading.set(false);
    }
  }

  refresh(): void {
    this.posts.set([]);
    this.page = 0;
    this.done.set(false);
    void this.more();
  }
}

/** A post with its comments arriving a beat later, and a reply box at the bottom. */
@Component({
  selector: 'feed-post',
  imports: [FeedCard, StackNavBack, ...DEMO_UI],
  template: `
    <div class="page feed">
      <header class="hdr feed-hdr">
        <button type="button" class="back" snBack="/feed">‹ Back</button>
        <h1>Post</h1>
        <span class="spacer"></span>
      </header>
      @if (post.isLoading()) {
        <demo-skeleton [lines]="4" />
      } @else if (post.error(); as e) {
        <demo-error [error]="e" (retry)="post.reload()" />
      } @else if (post.hasValue()) {
        <feed-card [post]="post.value()" />
        <h2 class="feed-h2">Comments</h2>
        @if (comments.isLoading()) {
          <demo-skeleton [lines]="2" />
          <demo-skeleton [lines]="2" />
        } @else if (comments.error(); as e) {
          <demo-error [error]="e" (retry)="comments.reload()" />
        } @else if (comments.hasValue()) {
          @for (c of comments.value(); track c.id) {
            <div class="feed-comment">
              <demo-avatar [name]="c.author.name" [hue]="c.author.hue" [size]="28" />
              <div><b>{{ c.author.name }}</b><p>{{ c.text }}</p></div>
            </div>
          }
          @for (c of mine(); track $index) {
            <div class="feed-comment mine">
              <demo-avatar name="You" [hue]="200" [size]="28" />
              <div><b>You</b><p>{{ c }}</p></div>
            </div>
          }
        }
        <form class="feed-reply" (submit)="reply($event)">
          <input name="reply" placeholder="Write a reply…" [value]="draft()" (input)="draft.set($any($event.target).value)" />
          <button type="submit" [disabled]="!draft().trim()">Post</button>
        </form>
      }
    </div>
  `,
})
export class FeedPost {
  readonly id = input.required<string>();
  private readonly api = inject(FakeApi);
  readonly post = resource({ params: () => Number(this.id()), loader: ({ params }) => this.api.post(params) });
  readonly comments = resource({ params: () => Number(this.id()), loader: ({ params }) => this.api.comments(params) });
  readonly draft = signal('');
  readonly mine = signal<string[]>([]);

  reply(e: Event): void {
    e.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.mine.update((m) => [...m, text]);
    this.draft.set('');
  }
}

/** A profile with a cover, stats and tabs; posts link back to post pages, always as a push. */
@Component({
  selector: 'feed-profile',
  imports: [FeedCard, StackNavBack, DecimalPipe, ...DEMO_UI],
  template: `
    <div class="page feed">
      <header class="hdr feed-hdr feed-hdr-over">
        <button type="button" class="back" snBack="/feed">‹ Back</button>
        <h1>{{ author.hasValue() ? author.value().name : 'Profile' }}</h1>
        <span class="spacer"></span>
      </header>
      <div class="feed-cover" [style.background]="cover()"></div>
      @if (author.isLoading()) {
        <demo-skeleton [lines]="3" />
      } @else if (author.error(); as e) {
        <demo-error [error]="e" (retry)="author.reload()" />
      } @else if (author.hasValue()) {
        <div class="feed-profile">
          <demo-avatar [name]="author.value().name" [hue]="author.value().hue" [size]="72" />
          <button type="button" class="feed-follow" [class.on]="following()" (click)="following.set(!following())">{{ following() ? 'Following' : 'Follow' }}</button>
          <h2>{{ author.value().name }}</h2>
          <small>&#64;{{ author.value().handle }}</small>
          <p>{{ author.value().bio }}</p>
          <div class="feed-stats">
            <span><b>{{ author.value().followers | number }}</b> followers</span>
            <span><b>{{ author.value().following | number }}</b> following</span>
          </div>
        </div>
        <div class="feed-tabs" role="tablist">
          @for (t of tabs; track t) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === t" (click)="tab.set(t)">{{ t }}</button>
          }
        </div>
        @if (posts.isLoading()) {
          <demo-skeleton [lines]="3" />
          <demo-skeleton [lines]="3" />
        } @else if (posts.hasValue()) {
          @for (post of shown(); track post.id) {
            <feed-card [post]="post" />
          } @empty {
            <p class="feed-empty">Nothing here yet.</p>
          }
        }
      }
    </div>
  `,
})
export class FeedProfile {
  readonly handle = input.required<string>();
  private readonly api = inject(FakeApi);
  readonly author = resource({ params: () => this.handle(), loader: ({ params }) => this.api.author(params) });
  readonly posts = resource({ params: () => this.handle(), loader: ({ params }) => this.api.authorPosts(params) });
  readonly tabs = ['Posts', 'Media', 'Likes'] as const;
  readonly tab = signal<(typeof this.tabs)[number]>('Posts');
  readonly following = signal(false);
  readonly cover = computed(() => {
    const hue = this.author.hasValue() ? this.author.value().hue : 210;
    return `linear-gradient(120deg, hsl(${hue} 60% 45%), hsl(${(hue + 60) % 360} 70% 60%))`;
  });
  readonly shown = computed(() => {
    const all = this.posts.hasValue() ? this.posts.value() : [];
    switch (this.tab()) {
      case 'Media':
        return all.filter((p) => p.image);
      case 'Likes':
        return all.filter((p) => p.likes > 500);
      default:
        return all;
    }
  });
}
