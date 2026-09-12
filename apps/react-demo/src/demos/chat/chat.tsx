import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AUTHORS, api, type Message } from '../fake-api';
import { Avatar, BackButton, ErrorBox, Skeleton, Spinner, useResource } from '../shared';

/** An inbox: rows with unread badges, loaded once and kept. Refresh re-queries the backend. */
export function ChatInbox() {
  const conversations = useResource(() => api.conversations(), []);
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const all = conversations.value ?? [];
  const shown = q ? all.filter((c) => c.with.name.toLowerCase().includes(q)) : all;

  return (
    <div className="page chat" data-page="chat">
      <header className="hdr chat-hdr">
        <BackButton to="/">‹ Demos</BackButton>
        <h1>Messages</h1>
        <button type="button" className="chat-refresh" onClick={conversations.reload} disabled={conversations.loading} aria-label="Refresh">
          ↻
        </button>
      </header>
      <div className="chat-search">
        <input placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {conversations.error != null ? (
        <ErrorBox error={conversations.error} onRetry={conversations.reload} />
      ) : conversations.loading && !conversations.value ? (
        [1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="chat-row">
            <div className="avatar skel-circle" />
            <Skeleton lines={2} />
          </div>
        ))
      ) : shown.length ? (
        shown.map((c) => (
          <Link key={c.id} className={c.unread > 0 ? 'chat-row unread' : 'chat-row'} to={`/messages/${c.id}`}>
            <Avatar name={c.with.name} hue={c.with.hue} size={48} />
            <div className="chat-row-body">
              <div>
                <b>{c.with.name}</b>
                <time>{c.minutesAgo < 60 ? `${c.minutesAgo}m` : `${Math.round(c.minutesAgo / 60)}h`}</time>
              </div>
              <p>{c.last}</p>
            </div>
            {c.unread > 0 && <span className="chat-badge">{c.unread}</span>}
          </Link>
        ))
      ) : (
        <p className="chat-empty">No conversations match.</p>
      )}
    </div>
  );
}

/**
 * A thread: message bubbles, a composer pinned to the bottom of the scroll
 * container, and replies that keep arriving after you pop back to the inbox.
 */
export function ChatThread() {
  const { id = '' } = useParams();
  const n = Number(id);
  /** Null for an id that matches no conversation (`/messages/0`, `/messages/foo`). The thread resource reports the error. */
  const peer = Number.isInteger(n) && n >= 1 && n <= AUTHORS.length ? AUTHORS[n - 1] : null;
  const thread = useResource(() => api.thread(n), [n]);
  const [sent, setSent] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  /** The backend's messages plus any added since. A reload of the thread includes the latter, so they are deduplicated. */
  const base = thread.value ?? [];
  const seen = new Set(base.map((m) => m.id));
  const messages = [...base, ...sent.filter((m) => !seen.has(m.id))];

  // Keep the newest bubble in view whenever the log grows. The stack's page element is the scroll container.
  useEffect(() => {
    const scroller = root.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages.length, typing]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const { sent: mine, reply } = api.send(n, text);
    setSent((s) => [...s, mine]);
    setTyping(true);
    try {
      const r = await reply;
      setSent((s) => [...s, r]);
    } catch {
      setSent((s) => [...s, { id: Date.now(), mine: false, text: '⚠︎ Not delivered', at: 'now' }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="page chat chat-thread" data-page="chat-thread" ref={root}>
      <header className="hdr chat-hdr">
        <BackButton to="/messages">‹ Messages</BackButton>
        <div className="chat-peer">
          {peer ? (
            <>
              <Avatar name={peer.name} hue={peer.hue} size={30} />
              <h1>{peer.name}</h1>
            </>
          ) : (
            <h1>Conversation</h1>
          )}
        </div>
        <span className="spacer" />
      </header>
      <div className="chat-log">
        {thread.loading ? (
          <Spinner />
        ) : thread.error != null ? (
          <ErrorBox error={thread.error} onRetry={thread.reload} />
        ) : (
          <>
            {messages.map((m) => (
              <div key={m.id} className={m.mine ? 'chat-bubble mine' : 'chat-bubble'}>
                {m.text}
                <time>{m.at}</time>
              </div>
            ))}
            {typing && (
              <div className="chat-bubble chat-typing">
                <i />
                <i />
                <i />
              </div>
            )}
          </>
        )}
      </div>
      <form className="chat-composer" onSubmit={send}>
        <input name="text" placeholder="Message" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim()} aria-label="Send">
          ↑
        </button>
      </form>
    </div>
  );
}
