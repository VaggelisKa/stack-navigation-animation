import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { api, type Post } from '../fake-api';
import { Avatar, BackButton, ErrorBox, PushLink, Skeleton, formatNumber, useResource } from '../shared';

const ago = (m: number) => (m < 60 ? `${m}m` : m < 60 * 24 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`);

/** One post rendered as a card. Used by the list, the post page and the profile. Its like is component state, kept with the page. */
function FeedCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="feed-card">
      <PushLink className="feed-author" to={`/feed/user/${post.author.handle}`}>
        <Avatar name={post.author.name} hue={post.author.hue} size={36} />
        <span>
          <b>{post.author.name}</b>
          <small>
            @{post.author.handle} · {ago(post.minutesAgo)}
          </small>
        </span>
      </PushLink>
      <p>{post.text}</p>
      {post.image && <div className="feed-image" style={{ background: `linear-gradient(135deg, hsl(${post.image[0]} 70% 60%), hsl(${post.image[1]} 70% 40%))` }} />}
      <div className="feed-actions">
        <button type="button" className={liked ? 'on' : undefined} onClick={() => setLiked((v) => !v)}>
          {liked ? '♥' : '♡'} {post.likes + (liked ? 1 : 0)}
        </button>
        <PushLink to={`/feed/post/${post.id}`}>◌ {post.comments}</PushLink>
        <span>↗ share</span>
      </div>
    </div>
  );
}

/**
 * A social timeline: the first page loads behind a shimmering skeleton, more
 * pages append on demand, and every kept card remembers its likes.
 */
export function FeedHome() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  // Each load takes a ticket; a result whose ticket is stale (a refresh started, or the effect ran twice) is dropped.
  const ticket = useRef(0);

  const load = async (from: number) => {
    const mine = ++ticket.current;
    setLoading(true);
    setError(null);
    try {
      const batch = await api.posts(from);
      if (mine !== ticket.current) return;
      setPosts((p) => [...p, ...batch]);
      setPage(from + 1);
      if (batch.length < 10) setDone(true);
    } catch (e) {
      if (mine === ticket.current) setError(e);
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load(0);
    return () => {
      ticket.current++;
    };
  }, []);
  const more = () => {
    if (!loading) void load(page);
  };
  const refresh = () => {
    setPosts([]);
    setPage(0);
    setDone(false);
    void load(0);
  };

  return (
    <div className="page feed" data-page="feed">
      <header className="hdr feed-hdr">
        <BackButton to="/">‹ Demos</BackButton>
        <h1>Feed</h1>
        <button type="button" className="feed-refresh" onClick={refresh} disabled={loading} aria-label="Refresh">
          ↻
        </button>
      </header>
      {error != null && <ErrorBox error={error} onRetry={refresh} />}
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} />
      ))}
      {loading ? (
        <>
          <Skeleton lines={4} />
          <Skeleton lines={3} />
          <Skeleton lines={4} />
        </>
      ) : (
        error == null && (
          <div className="feed-more">
            {done ? (
              <span>You're all caught up.</span>
            ) : (
              <button type="button" onClick={more}>
                Load more
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

/** A post whose comments load shortly after the page, with a reply box at the bottom. */
export function FeedPost() {
  const { id = '' } = useParams();
  const n = Number(id);
  const post = useResource(() => api.post(n), [n]);
  const comments = useResource(() => api.comments(n), [n]);
  const [draft, setDraft] = useState('');
  const [mine, setMine] = useState<string[]>([]);

  const reply = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMine((m) => [...m, text]);
    setDraft('');
  };

  return (
    <div className="page feed" data-page="feed-post">
      <header className="hdr feed-hdr">
        <BackButton to="/feed">‹ Back</BackButton>
        <h1>Post</h1>
        <span className="spacer" />
      </header>
      {post.loading ? (
        <Skeleton lines={4} />
      ) : post.error != null ? (
        <ErrorBox error={post.error} onRetry={post.reload} />
      ) : (
        post.value && (
          <>
            <FeedCard post={post.value} />
            <h2 className="feed-h2">Comments</h2>
            {comments.loading ? (
              <>
                <Skeleton lines={2} />
                <Skeleton lines={2} />
              </>
            ) : comments.error != null ? (
              <ErrorBox error={comments.error} onRetry={comments.reload} />
            ) : (
              <>
                {comments.value?.map((c) => (
                  <div key={c.id} className="feed-comment">
                    <Avatar name={c.author.name} hue={c.author.hue} size={28} />
                    <div>
                      <b>{c.author.name}</b>
                      <p>{c.text}</p>
                    </div>
                  </div>
                ))}
                {mine.map((c, i) => (
                  <div key={i} className="feed-comment mine">
                    <Avatar name="You" hue={200} size={28} />
                    <div>
                      <b>You</b>
                      <p>{c}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
            <form className="feed-reply" onSubmit={reply}>
              <input name="reply" placeholder="Write a reply…" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" disabled={!draft.trim()}>
                Post
              </button>
            </form>
          </>
        )
      )}
    </div>
  );
}

const TABS = ['Posts', 'Media', 'Likes'] as const;

/** A profile with a cover, stats and tabs. Posts link back to post pages, always as a push. */
export function FeedProfile() {
  const { handle = '' } = useParams();
  const author = useResource(() => api.author(handle), [handle]);
  const posts = useResource(() => api.authorPosts(handle), [handle]);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Posts');
  const [following, setFollowing] = useState(false);
  const hue = author.value?.hue ?? 210;
  const all = posts.value ?? [];
  const shown = tab === 'Media' ? all.filter((p) => p.image) : tab === 'Likes' ? all.filter((p) => p.likes > 500) : all;

  return (
    <div className="page feed" data-page="feed-profile">
      <header className="hdr feed-hdr feed-hdr-over">
        <BackButton to="/feed">‹ Back</BackButton>
        <h1>{author.value?.name ?? 'Profile'}</h1>
        <span className="spacer" />
      </header>
      <div className="feed-cover" style={{ background: `linear-gradient(120deg, hsl(${hue} 60% 45%), hsl(${(hue + 60) % 360} 70% 60%))` }} />
      {author.loading ? (
        <Skeleton lines={3} />
      ) : author.error != null ? (
        <ErrorBox error={author.error} onRetry={author.reload} />
      ) : (
        author.value && (
          <>
            <div className="feed-profile">
              <Avatar name={author.value.name} hue={author.value.hue} size={72} />
              <button type="button" className={following ? 'feed-follow on' : 'feed-follow'} onClick={() => setFollowing((f) => !f)}>
                {following ? 'Following' : 'Follow'}
              </button>
              <h2>{author.value.name}</h2>
              <small>@{author.value.handle}</small>
              <p>{author.value.bio}</p>
              <div className="feed-stats">
                <span>
                  <b>{formatNumber(author.value.followers)}</b> followers
                </span>
                <span>
                  <b>{formatNumber(author.value.following)}</b> following
                </span>
              </div>
            </div>
            <div className="feed-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            {posts.loading ? (
              <>
                <Skeleton lines={3} />
                <Skeleton lines={3} />
              </>
            ) : shown.length ? (
              shown.map((post) => <FeedCard key={post.id} post={post} />)
            ) : (
              <p className="feed-empty">Nothing here yet.</p>
            )}
          </>
        )
      )}
    </div>
  );
}
