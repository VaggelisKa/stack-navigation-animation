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
  /** gradient hues when the post carries an image */
  image: [number, number] | null;
}
export interface Comment {
  id: number;
  author: Author;
  text: string;
}
export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  hue: number;
  rating: number;
  blurb: string;
  details: string[];
}
export interface Conversation {
  id: number;
  with: Author;
  last: string;
  unread: number;
  minutesAgo: number;
}
export interface Message {
  id: number;
  mine: boolean;
  text: string;
  at: string;
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
export interface SearchResult {
  id: number;
  kind: 'post' | 'product' | 'person' | 'photo';
  title: string;
  subtitle: string;
  link: unknown[];
}
export interface Stats {
  tiles: { label: string; value: string; delta: number }[];
  bars: { label: string; value: number }[];
}
export interface Activity {
  id: number;
  when: string;
  who: string;
  what: string;
  where: string;
  status: 'ok' | 'warn' | 'fail';
  duration: string;
}
export interface TeamMember {
  id: number;
  name: string;
  handle: string;
  role: string;
  hue: number;
  commits: number;
  timezone: string;
  focus: string[];
}

// ---------------------------------------------------------------- data
/** Deterministic pseudo-random numbers, so every load looks the same. */
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
  { handle: 'ada', name: 'Ada Lindqvist', hue: 210, bio: 'Builds small things that move well.', followers: 12400, following: 310 },
  { handle: 'kofi', name: 'Kofi Mensah', hue: 28, bio: 'Photos, mostly of weather.', followers: 8210, following: 190 },
  { handle: 'mira', name: 'Mira Sato', hue: 330, bio: 'Design systems and long walks.', followers: 25100, following: 88 },
  { handle: 'tomas', name: 'Tomás Reyes', hue: 140, bio: 'Backend by day, synths by night.', followers: 3300, following: 540 },
  { handle: 'yuki', name: 'Yuki Hoshino', hue: 265, bio: 'Type nerd. Coffee first.', followers: 990, following: 120 },
  { handle: 'nadia', name: 'Nadia Farouk', hue: 5, bio: 'Product. Ask me about onboarding.', followers: 15800, following: 402 },
  { handle: 'elias', name: 'Elias Brandt', hue: 185, bio: 'Maps and the space between them.', followers: 6100, following: 233 },
  { handle: 'pri', name: 'Priya Natarajan', hue: 50, bio: 'Accessibility, always.', followers: 19300, following: 271 },
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
const COMMENTS = ['Agreed, this is the way.', 'Can you share the easing curve?', 'Tried this on an old phone, still smooth.', 'The shadow on the leading edge sells it.', 'Bookmarked.', 'How does this behave with a guard that refuses?', 'Same here. Ship it.'];
const CATEGORIES = ['Audio', 'Home', 'Outdoors', 'Desk'];
const PRODUCT_NAMES: Record<string, string[]> = {
  Audio: ['Loop Earbuds', 'Slab Speaker', 'Vellum Headphones', 'Pocket Amp', 'Ribbon Mic', 'Tape Deck Mini'],
  Home: ['Ember Lamp', 'Cirrus Diffuser', 'Ledge Shelf', 'Fold Chair', 'Quiet Kettle', 'Terra Planter'],
  Outdoors: ['Ridge Jacket', 'Trail Bottle', 'Camp Stool', 'Ember Stove', 'Cloud Hammock', 'Summit Pack'],
  Desk: ['Grid Notebook', 'Brass Pen', 'Felt Mat', 'Cable Loop', 'Stand Up', 'Clip Light'],
};
const PLACES = ['Reykjavík', 'Kyoto', 'Valparaíso', 'Tbilisi', 'Porto', 'Hanoi', 'Cape Town', 'Oaxaca', 'Bergen', 'Ljubljana'];
const ROLES = ['Engineer', 'Designer', 'Product', 'Research', 'Support', 'Ops'];
const ACTIONS = ['deployed', 'rolled back', 'merged', 'opened', 'reviewed', 'restarted', 'scaled', 'migrated'];
const TARGETS = ['api-gateway', 'checkout', 'search-index', 'mail-worker', 'web-frontend', 'billing', 'feed-ranker', 'image-cdn'];

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
function buildProducts(): Product[] {
  const r = rng(11);
  const out: Product[] = [];
  for (const category of CATEGORIES) {
    for (const name of PRODUCT_NAMES[category]) {
      out.push({
        id: out.length + 1,
        name,
        price: 12 + Math.floor(r() * 280),
        category,
        hue: Math.floor(r() * 360),
        rating: 3 + Math.round(r() * 20) / 10,
        blurb: pick(r, ['Made to be carried everywhere.', 'Quietly well made.', 'One material, no seams.', 'Better on the third week than the first.']),
        details: [pick(r, ['Recycled aluminium', 'Solid oak', 'Ripstop nylon', 'Stoneware']), pick(r, ['Two-year warranty', 'Lifetime repairs', 'Thirty-day returns']), pick(r, ['Ships in 2 days', 'Ships next week'])],
      });
    }
  }
  return out;
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
function buildTeam(): TeamMember[] {
  const r = rng(31);
  return AUTHORS.map((a, i) => ({
    id: i + 1,
    name: a.name,
    handle: a.handle,
    role: ROLES[i % ROLES.length],
    hue: a.hue,
    commits: Math.floor(r() * 400),
    timezone: pick(r, ['UTC−8', 'UTC−5', 'UTC', 'UTC+1', 'UTC+2', 'UTC+9']),
    focus: [pick(r, TARGETS), pick(r, TARGETS)],
  }));
}
function buildActivity(): Activity[] {
  const r = rng(41);
  return Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    when: `${String(9 + Math.floor(i / 5)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}`,
    who: pick(r, AUTHORS).name,
    what: pick(r, ACTIONS),
    where: pick(r, TARGETS),
    status: r() < 0.08 ? 'fail' : r() < 0.2 ? 'warn' : 'ok',
    duration: `${(r() * 40).toFixed(1)}s`,
  }));
}

const POSTS = buildPosts();
const PRODUCTS = buildProducts();
const PHOTOS = buildPhotos();
const TEAM = buildTeam();
const ACTIVITY = buildActivity();

/**
 * A pretend backend. Every call resolves after `latency()` milliseconds and
 * rejects while `failing()` is on, so pages can be watched loading, failing
 * and retrying while the outlet animates around them.
 */
@Injectable({ providedIn: 'root' })
export class FakeApi {
  /** Base delay per request, ms. The Lab page changes it. */
  readonly latency = signal(700);
  /** Reject every request. */
  readonly failing = signal(false);
  /** Requests in flight right now. */
  readonly inflight = signal(0);
  private readonly messages = new Map<number, Message[]>();
  private nextId = 1000;

  private request<T>(make: () => T, ms = this.latency(), fail = this.failing()): Promise<T> {
    this.inflight.update((n) => n + 1);
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        this.inflight.update((n) => n - 1);
        if (fail) reject(new Error('The network is unreachable (simulated).'));
        else resolve(make());
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
    return this.request(() => Array.from({ length: n }, (_, i) => ({ id: i + 1, author: pick(r, AUTHORS), text: pick(r, COMMENTS) })), this.latency() * 1.4);
  }
  author(handle: string): Promise<Author> {
    return this.request(() => {
      const a = AUTHORS.find((x) => x.handle === handle);
      if (!a) throw new Error(`No user ${handle}`);
      return a;
    });
  }
  authorPosts(handle: string): Promise<Post[]> {
    return this.request(() => POSTS.filter((p) => p.author.handle === handle), this.latency() * 1.6);
  }

  // shop
  categories(): string[] {
    return CATEGORIES;
  }
  products(category: string | null): Promise<Product[]> {
    return this.request(() => (category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS));
  }
  product(id: number): Promise<Product> {
    return this.request(() => {
      const p = PRODUCTS.find((x) => x.id === id);
      if (!p) throw new Error(`No product ${id}`);
      return p;
    });
  }
  related(id: number): Promise<Product[]> {
    return this.request(() => {
      const p = PRODUCTS.find((x) => x.id === id);
      return PRODUCTS.filter((x) => x.category === p?.category && x.id !== id).slice(0, 4);
    }, this.latency() * 1.5);
  }
  placeOrder(lines: { product: Product; qty: number }[], opts: { fail?: boolean } = {}): Promise<{ id: string; total: number }> {
    const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
    return this.request(() => ({ id: `SN-${String(2400 + (total % 500)).padStart(4, '0')}`, total }), this.latency() * 2, opts.fail || this.failing());
  }

  // messages
  conversations(): Promise<Conversation[]> {
    const r = rng(3);
    return this.request(() =>
      AUTHORS.map((a, i) => ({
        id: i + 1,
        with: a,
        last: this.messages.get(i + 1)?.at(-1)?.text ?? pick(r, SENTENCES),
        unread: i % 3 === 0 ? 1 + Math.floor(r() * 4) : 0,
        minutesAgo: 2 + i * 41,
      })),
    );
  }
  thread(id: number): Promise<Message[]> {
    return this.request(() => {
      let m = this.messages.get(id);
      if (!m) {
        const r = rng(100 + id);
        m = Array.from({ length: 8 + Math.floor(r() * 10) }, (_, i) => ({ id: i + 1, mine: r() > 0.5, text: pick(r, [...SENTENCES, ...COMMENTS]), at: `${9 + Math.floor(i / 2)}:${String((i * 7) % 60).padStart(2, '0')}` }));
        this.messages.set(id, m);
      }
      return [...m];
    });
  }
  /** Records `text` at once; the reply arrives a while later. */
  send(id: number, text: string): { sent: Message; reply: Promise<Message> } {
    const m = this.messages.get(id) ?? [];
    const sent: Message = { id: ++this.nextId, mine: true, text, at: now() };
    m.push(sent);
    this.messages.set(id, m);
    const reply = this.request(() => {
      const r: Message = { id: ++this.nextId, mine: false, text: pick(rng(this.nextId), COMMENTS), at: now() };
      m.push(r);
      return r;
    }, this.latency() * 2.5);
    return { sent, reply };
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

  // search
  search(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const needle = q.trim().toLowerCase();
    return new Promise<SearchResult[]>((resolve, reject) => {
      const t = setTimeout(() => {
        this.inflight.update((n) => n - 1);
        if (this.failing()) return reject(new Error('The network is unreachable (simulated).'));
        const hit = (s: string) => s.toLowerCase().includes(needle);
        const out: SearchResult[] = [];
        for (const a of AUTHORS) if (hit(a.name) || hit(a.handle)) out.push({ id: out.length, kind: 'person', title: a.name, subtitle: `@${a.handle}`, link: ['/feed/user', a.handle] });
        for (const p of PRODUCTS) if (hit(p.name) || hit(p.category)) out.push({ id: out.length, kind: 'product', title: p.name, subtitle: `${p.category} · $${p.price}`, link: ['/shop/p', p.id] });
        for (const p of POSTS) if (hit(p.text)) out.push({ id: out.length, kind: 'post', title: p.text, subtitle: `@${p.author.handle}`, link: ['/feed/post', p.id] });
        for (const p of PHOTOS) if (hit(p.title) || hit(p.place)) out.push({ id: out.length, kind: 'photo', title: p.title, subtitle: p.place, link: ['/gallery', p.id] });
        resolve(out.slice(0, 30));
      }, this.latency());
      this.inflight.update((n) => n + 1);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        this.inflight.update((n) => n - 1);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }

  // dashboard
  stats(range: 'day' | 'week' | 'month'): Promise<Stats> {
    const r = rng(range.length * 97);
    const n = range === 'day' ? 24 : range === 'week' ? 7 : 30;
    return this.request(() => ({
      tiles: [
        { label: 'Requests', value: `${(120 + r() * 900).toFixed(1)}k`, delta: Math.round((r() - 0.4) * 30) },
        { label: 'p95 latency', value: `${Math.floor(90 + r() * 200)} ms`, delta: Math.round((r() - 0.6) * 30) },
        { label: 'Errors', value: `${(r() * 2).toFixed(2)}%`, delta: Math.round((r() - 0.5) * 10) },
        { label: 'Signups', value: `${Math.floor(r() * 400)}`, delta: Math.round((r() - 0.3) * 40) },
      ],
      bars: Array.from({ length: n }, (_, i) => ({ label: range === 'day' ? `${i}h` : range === 'week' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] : `${i + 1}`, value: 0.2 + r() * 0.8 })),
    }));
  }
  activity(): Promise<Activity[]> {
    return this.request(() => ACTIVITY);
  }
  team(): Promise<TeamMember[]> {
    return this.request(() => TEAM);
  }
  member(id: number): Promise<TeamMember> {
    return this.request(() => {
      const m = TEAM.find((x) => x.id === id);
      if (!m) throw new Error(`No member ${id}`);
      return m;
    });
  }
}

function now(): string {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const initials = (name: string): string =>
  name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2);
