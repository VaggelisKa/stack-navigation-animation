import { Injectable, signal } from '@angular/core';

// ---------------------------------------------------------------- models
export interface Author {
  handle: string;
  name: string;
  hue: number;
  bio: string;
  followers: number;
  following: number;
}
export interface Post {
  id: number;
  author: Author;
  text: string;
  likes: number;
  comments: number;
  minutesAgo: number;
  /** gradient hues used when the post carries an image */
  image: [number, number] | null;
}
export interface Comment {
  id: number;
  author: Author;
  text: string;
}
export interface Photo {
  id: number;
  title: string;
  hues: [number, number];
  angle: number;
  /** aspect ratio */
  ratio: number;
  place: string;
}
export interface Email {
  id: number;
  folder: 'inbox' | 'sent';
  from: Author;
  subject: string;
  preview: string;
  body: string[];
  minutesAgo: number;
  unread: boolean;
}
export interface Note {
  id: number;
  title: string;
  body: string[];
  minutesAgo: number;
  pinned: boolean;
}

// ---------------------------------------------------------------- data
/** Deterministic pseudo-random numbers, so every load produces the same data. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export const AUTHORS: Author[] = [
  {
    handle: 'ada',
    name: 'Ada Lindqvist',
    hue: 210,
    bio: 'Builds small things that move well.',
    followers: 12400,
    following: 310,
  },
  {
    handle: 'kofi',
    name: 'Kofi Mensah',
    hue: 28,
    bio: 'Photos, mostly of weather.',
    followers: 8210,
    following: 190,
  },
  {
    handle: 'mira',
    name: 'Mira Sato',
    hue: 330,
    bio: 'Design systems and long walks.',
    followers: 25100,
    following: 88,
  },
  {
    handle: 'tomas',
    name: 'Tomás Reyes',
    hue: 140,
    bio: 'Backend by day, synths by night.',
    followers: 3300,
    following: 540,
  },
  {
    handle: 'yuki',
    name: 'Yuki Hoshino',
    hue: 265,
    bio: 'Type nerd. Coffee first.',
    followers: 990,
    following: 120,
  },
  {
    handle: 'nadia',
    name: 'Nadia Farouk',
    hue: 5,
    bio: 'Product. Ask me about onboarding.',
    followers: 15800,
    following: 402,
  },
  {
    handle: 'elias',
    name: 'Elias Brandt',
    hue: 185,
    bio: 'Maps and the space between them.',
    followers: 6100,
    following: 233,
  },
  {
    handle: 'pri',
    name: 'Priya Natarajan',
    hue: 50,
    bio: 'Accessibility, always.',
    followers: 19300,
    following: 271,
  },
];
const SENTENCES = [
  'Shipped the thing. The transition finally feels like the finger is holding the page.',
  'Hot take: a good back gesture matters more than a good forward one.',
  'Trying a parallax of 0.3 today. 0.25 read as flat, 0.35 read as loose.',
  'Every scroll position survived the round trip. No restoration code. Feels like cheating.',
  'Long lists, short lists, sticky headers, a chat composer glued to the bottom: all pushed and popped.',
  'Reminder that visibility: hidden keeps layout and scroll offsets while display: none throws them away.',
  'A resolver that takes a second should not make the page appear a second late. It should make the tap wait.',
  'Two hundred rows, ten avatars, a shimmering skeleton, and the swipe stayed at sixty frames.',
  'Replacing the top page for a checkout success screen means back cannot land on a submitted form. Nice.',
  'Dark pages dim differently. The overlay should be barely there.',
  'Nested router outlets inside a kept page keep working. Tabs stay where you left them.',
  'Debounced search, cancelled in flight when you keep typing. The results list should never flicker.',
];
const COMMENTS = [
  'Agreed, this is the way.',
  'Can you share the easing curve?',
  'Tried this on an old phone, still smooth.',
  'The shadow on the leading edge sells it.',
  'Bookmarked.',
  'How does this behave with a guard that refuses?',
  'Same here. Ship it.',
];
const PLACES = [
  'Reykjavík',
  'Kyoto',
  'Valparaíso',
  'Tbilisi',
  'Porto',
  'Hanoi',
  'Cape Town',
  'Oaxaca',
  'Bergen',
  'Ljubljana',
];

function buildPosts(): Post[] {
  const r = rng(7);
  return Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    author: AUTHORS[i % AUTHORS.length],
    text: SENTENCES[i % SENTENCES.length],
    likes: Math.floor(r() * 900),
    comments: Math.floor(r() * 40),
    minutesAgo: 3 + i * 17,
    image: i % 3 === 0 ? [Math.floor(r() * 360), Math.floor(r() * 360)] : null,
  }));
}
function buildPhotos(): Photo[] {
  const r = rng(23);
  return Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    title: `${pick(r, ['Morning', 'Low tide', 'Fog', 'Last light', 'Blue hour', 'Rain'])} ${i + 1}`,
    hues: [Math.floor(r() * 360), Math.floor(r() * 360)],
    angle: Math.floor(r() * 360),
    ratio: pick(r, [1, 1, 0.8, 1.25, 0.66, 1.5]),
    place: pick(r, PLACES),
  }));
}

const POSTS = buildPosts();
const PHOTOS = buildPhotos();
const SUBJECTS = [
  'Easing curve for the pop',
  'Friday demo',
  'Parallax at 0.3?',
  'Re: swipe on the gallery',
  'Scroll restoration is gone',
  'Tab bar during a push',
  'Guard that refuses',
  'Dark viewer dim',
  'Notes from the review',
  'Wizard step order',
  'Lazy chunk timing',
  'The 600-row page',
];
function buildMail(): Email[] {
  const r = rng(53);
  return SUBJECTS.map((subject, i) => {
    const body = [pick(r, SENTENCES), pick(r, SENTENCES), pick(r, SENTENCES)];
    return {
      id: i + 1,
      folder: i % 3 === 2 ? 'sent' : 'inbox',
      from: AUTHORS[(i * 5) % AUTHORS.length],
      subject,
      preview: body[0],
      body,
      minutesAgo: 6 + i * 47,
      unread: i % 4 === 0,
    };
  });
}
const MAIL = buildMail();

/** Notes taken while building the transition. One title is deliberately long: the large title wraps, and the header it belongs to is taller than the others. */
const NOTE_TITLES = [
  'Curves worth keeping',
  'Everything the pop has to get right before it feels like the finger is still holding the page, in order',
  'Reading list',
  'What the large title does on scroll',
  'Phones to test on',
  'Questions for the review',
  'Words for the docs',
  'Gesture notes',
  'Things that felt wrong at 120 Hz',
  'Shipping checklist',
  'Ideas, unsorted',
  'Old measurements',
];
const NOTE_LINES = [...SENTENCES, ...COMMENTS];
function buildNotes(): Note[] {
  const r = rng(67);
  return NOTE_TITLES.map((title, i) => ({
    id: i + 1,
    title,
    // Walked in steps of three rather than picked, so a note reads as a list of different lines.
    body: Array.from(
      { length: 18 + Math.floor(r() * 8) },
      (_, k) => NOTE_LINES[(i * 5 + k * 3) % NOTE_LINES.length],
    ),
    minutesAgo: 7 + i * 917,
    pinned: i < 2,
  }));
}
const NOTES = buildNotes();

/**
 * A fake backend. Every call resolves after `latency()` milliseconds, and
 * rejects while `failing()` is on, so pages can be observed loading, failing
 * and retrying while the outlet animates around them.
 */
@Injectable({ providedIn: 'root' })
export class FakeApi {
  /** Base delay per request, in ms. The Lab page changes it. */
  readonly latency = signal(700);
  /** When true, every request rejects. */
  readonly failing = signal(false);
  /** Number of requests currently in flight. */
  readonly inflight = signal(0);
  private nextId = 1000;

  private request<T>(make: () => T, ms = this.latency(), fail = this.failing()): Promise<T> {
    this.inflight.update((n) => n + 1);
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        this.inflight.update((n) => n - 1);
        if (fail) return reject(new Error('The network is unreachable (simulated).'));
        // `make()` runs inside the timer, not the executor, so a throw here (an unknown id, for example) must reject rather than escape.
        try {
          resolve(make());
        } catch (e) {
          reject(e);
        }
      }, ms);
    });
  }

  // feed
  posts(page: number, size = 10): Promise<Post[]> {
    return this.request(() => POSTS.slice(page * size, page * size + size));
  }
  post(id: number): Promise<Post> {
    return this.request(() => {
      const p = POSTS.find((x) => x.id === id);
      if (!p) throw new Error(`No post ${id}`);
      return p;
    });
  }
  comments(postId: number): Promise<Comment[]> {
    const r = rng(postId);
    const n = 2 + Math.floor(r() * 5);
    return this.request(
      () =>
        Array.from({ length: n }, (_, i) => ({
          id: i + 1,
          author: pick(r, AUTHORS),
          text: pick(r, COMMENTS),
        })),
      this.latency() * 1.4,
    );
  }
  author(handle: string): Promise<Author> {
    return this.request(() => {
      const a = AUTHORS.find((x) => x.handle === handle);
      if (!a) throw new Error(`No user ${handle}`);
      return a;
    });
  }
  authorPosts(handle: string): Promise<Post[]> {
    return this.request(
      () => POSTS.filter((p) => p.author.handle === handle),
      this.latency() * 1.6,
    );
  }

  // mail
  /** Bumped whenever the mail data changes, so a kept folder page can reload. */
  readonly mailVersion = signal(0);
  mail(folder: Email['folder']): Promise<Email[]> {
    return this.request(() => MAIL.filter((m) => m.folder === folder));
  }
  email(id: number): Promise<Email> {
    return this.request(() => {
      const m = MAIL.find((x) => x.id === id);
      if (!m) throw new Error(`No message ${id}`);
      return m;
    });
  }
  /** Files the draft under Sent. */
  sendMail(draft: { to: string; subject: string; text: string }): Promise<void> {
    return this.request(() => {
      const handle = draft.to.split('@')[0];
      const from = AUTHORS.find((a) => a.handle === handle) ?? {
        handle,
        name: draft.to,
        hue: 200,
        bio: '',
        followers: 0,
        following: 0,
      };
      const body = draft.text.split(/\n+/).filter(Boolean);
      MAIL.unshift({
        id: this.nextId++,
        folder: 'sent',
        from,
        subject: draft.subject,
        preview: body[0] ?? '',
        body,
        minutesAgo: 0,
        unread: false,
      });
      this.mailVersion.update((v) => v + 1);
    });
  }
  // gallery
  photos(): Promise<Photo[]> {
    return this.request(() => PHOTOS);
  }
  photo(id: number): Promise<Photo> {
    return this.request(() => {
      const p = PHOTOS.find((x) => x.id === id);
      if (!p) throw new Error(`No photo ${id}`);
      return p;
    }, this.latency() * 0.5);
  }
  photoCount(): number {
    return PHOTOS.length;
  }

  // notes
  notes(): Promise<Note[]> {
    return this.request(() => NOTES);
  }
  note(id: number): Promise<Note> {
    return this.request(() => {
      const n = NOTES.find((x) => x.id === id);
      if (!n) throw new Error(`No note ${id}`);
      return n;
    }, this.latency() * 0.6);
  }
}

export const initials = (name: string): string =>
  name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2);
