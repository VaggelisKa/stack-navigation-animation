import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

export const ITEMS = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

const DEMOS = [
  { path: '/feed', name: 'Feed', note: 'skeletons, load more, profiles' },
  { path: '/shop', name: 'Shop', note: 'grid, cart, checkout' },
  { path: '/messages', name: 'Messages', note: 'sticky composer, late replies' },
  { path: '/gallery', name: 'Gallery', note: 'dark viewer, filmstrip' },
  { path: '/lab', name: 'Lab', note: 'slow motion, latency, stress' },
];

export function Home() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  return (
    <div className="page" data-page="home">
      <header className="hdr">
        <span className="spacer" />
        <h1>stacknav</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <p className="lede">A React Router outlet with the iOS push/pop transition. Pages stay alive beneath the top: scroll down, open something, swipe back.</p>
        <h2>Demo apps</h2>
        {DEMOS.map((d) => (
          <Link key={d.path} className="item" to={d.path}>
            <span>{d.name}</span>
            <small>{d.note}</small>
            <i>›</i>
          </Link>
        ))}
        <h2>State survives</h2>
        <div className="counter item">
          <span>Counter (kept while you are away)</span>
          <button type="button" onClick={() => setCount((c) => c - 1)}>
            −
          </button>
          <b>{count}</b>
          <button type="button" onClick={() => setCount((c) => c + 1)}>
            +
          </button>
        </div>
        <h2>Numbered screens</h2>
        <Link className="item" to="/settings">
          <span>Settings</span>
          <small>stackLevel 2</small>
          <i>›</i>
        </Link>
        <Link className="item" to="/about">
          <span>About</span>
          <small>stackLevel 3</small>
          <i>›</i>
        </Link>
        <h2>
          Explicit direction, through the navigation <code>state</code>
        </h2>
        <button className="item" type="button" onClick={() => navigate('/settings', { state: { stacknav: 'replace' } })}>
          <span>Settings, as a replace</span>
          <i>›</i>
        </button>
        <button className="item" type="button" onClick={() => navigate('/items/7', { state: { stacknav: { direction: 'push', animated: false } } })}>
          <span>Item 7, no animation</span>
          <i>›</i>
        </button>
        <h2>From the route tree</h2>
        {ITEMS.map((item) => (
          <Link key={item.id} className="item" to={`/items/${item.id}`}>
            <span>{item.name}</span>
            <i>›</i>
          </Link>
        ))}
      </div>
    </div>
  );
}
