import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../fake-api';
import { BackButton, PushLink, Skeleton, prefs, usePopTo, useResource } from '../shared';
import { useStore } from '../store';

/** Controls for the engine and the fake backend, plus pages that stress them. */
export function LabHome() {
  const p = useStore(prefs);
  const settings = useStore(api.settings);
  const inflight = useStore(api.inflight);
  return (
    <div className="page lab" data-page="lab">
      <header className="hdr">
        <BackButton to="/">‹ Demos</BackButton>
        <h1>Lab</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <h2>Transition</h2>
        <div className="frm-group">
          <label className="switch">
            <span>Slow motion (4×)</span>
            <input type="checkbox" checked={p.slow} onChange={(e) => prefs.set({ ...p, slow: e.target.checked })} />
            <i />
          </label>
          <label className="switch">
            <span>Swipe back from anywhere</span>
            <input type="checkbox" checked={p.anywhere} onChange={(e) => prefs.set({ ...p, anywhere: e.target.checked })} />
            <i />
          </label>
        </div>
        <h2>Fake backend</h2>
        <div className="frm-group">
          <label className="lab-range">
            <span>
              Latency <b>{settings.latency} ms</b>
            </span>
            <input type="range" min={0} max={3000} step={100} value={settings.latency} onChange={(e) => api.settings.set({ ...settings, latency: +e.target.value })} />
          </label>
          <label className="switch">
            <span>Every request fails</span>
            <input type="checkbox" checked={settings.failing} onChange={(e) => api.settings.set({ ...settings, failing: e.target.checked })} />
            <i />
          </label>
          <div className="lab-row">
            <span>In flight</span>
            <b>{inflight}</b>
          </div>
        </div>
        <h2>Stress</h2>
        <Link className="item" to="/lab/stress">
          <span>Heavy page</span>
          <small>600 rows, gradients, blur</small>
          <i>›</i>
        </Link>
        <Link className="item" to="/lab/deep/1">
          <span>Deep stack</span>
          <small>push without end, pop to root</small>
          <i>›</i>
        </Link>
        <Link className="item" to="/lab/slow">
          <span>Slow page</span>
          <small>content that takes 2 s</small>
          <i>›</i>
        </Link>
        <Link className="item" to="/lab/wide">
          <span>Wide content</span>
          <small>horizontal scrollers vs the edge swipe</small>
          <i>›</i>
        </Link>
      </div>
    </div>
  );
}

const ROWS = Array.from({ length: 600 }, (_, i) => i + 1);

export function LabStress() {
  return (
    <div className="page lab" data-page="lab-stress">
      <header className="hdr">
        <BackButton to="/lab">‹ Lab</BackButton>
        <h1>Heavy page</h1>
        <span className="spacer" />
      </header>
      <div className="lab-stress">
        {ROWS.map((r) => (
          <div key={r} className="lab-stress-row" style={{ '--h': (r * 13) % 360 } as CSSProperties}>
            <i />
            <span>
              <b>Row {r}</b>
              <small>
                {(r * 7919) % 1000} things · {(r * 31) % 60} min ago
              </small>
            </span>
            <em>{(r * 17) % 100}%</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/** `/lab/deep/1`, `/lab/deep/2`, …: siblings pushed by hint. A pop to a kept page unwinds them all. */
export function LabDeep() {
  const { n = '1' } = useParams();
  const depth = Math.max(1, Number(n) || 1);
  const popTo = usePopTo();
  return (
    <div className="page lab" data-page="lab-deep" style={{ background: `hsl(${(depth * 37) % 360} 40% 96%)` }}>
      <header className="hdr">
        <BackButton to={depth === 1 ? '/lab' : `/lab/deep/${depth - 1}`}>‹ Back</BackButton>
        <h1>Depth {depth}</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <div className="lab-depth">
          {Array.from({ length: depth }, (_, i) => i + 1).map((d) => (
            <i key={d} style={{ '--h': (d * 37) % 360 } as CSSProperties} className={d === depth ? 'top' : undefined} />
          ))}
        </div>
        <p className="lede">
          {depth} page{depth === 1 ? '' : 's'} kept in the stack, plus whatever came before.
        </p>
        <PushLink className="item" to={`/lab/deep/${depth + 1}`}>
          <span>Push depth {depth + 1}</span>
          <i>›</i>
        </PushLink>
        <button className="item" type="button" onClick={() => popTo('/lab')}>
          <span>Pop to the lab</span>
          <small>one animation, {depth} pages dropped</small>
          <i>›</i>
        </button>
        <button className="item" type="button" onClick={() => popTo('/')}>
          <span>Pop to the demos</span>
          <i>›</i>
        </button>
      </div>
    </div>
  );
}

/**
 * Declarative routing has no resolvers: the push starts at once and the
 * content lands when it lands, so a slow page is a page with a skeleton. If
 * the tap should wait for the data instead, that is the app's call: fetch
 * first, navigate when it resolves.
 */
export function LabSlow() {
  const slowly = useResource(() => api.slowly(2000), []);
  return (
    <div className="page lab" data-page="lab-slow">
      <header className="hdr">
        <BackButton to="/lab">‹ Lab</BackButton>
        <h1>Slow page</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        {slowly.value ? (
          <p className="lede">
            This content took {slowly.value.ms} ms to arrive. The push began at once, the skeleton held the page, and the data landed on a page that was already on screen: <b>{slowly.value.word}</b>.
          </p>
        ) : (
          <Skeleton lines={3} />
        )}
      </div>
    </div>
  );
}

const WIDE_ROWS = [1, 2, 3, 4, 5];
const CELLS = Array.from({ length: 12 }, (_, i) => i + 1);

export function LabWide() {
  return (
    <div className="page lab" data-page="lab-wide">
      <header className="hdr">
        <BackButton to="/lab">‹ Lab</BackButton>
        <h1>Wide content</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <p className="lede">Horizontal scrollers start at the page's left edge. The swipe wins inside the edge strip; the scroller wins everywhere else.</p>
        {WIDE_ROWS.map((row) => (
          <div key={row}>
            <h2>Row {row}</h2>
            <div className="lab-scroller">
              {CELLS.map((i) => (
                <div key={i} style={{ '--h': (row * 50 + i * 20) % 360 } as CSSProperties}>
                  {i}
                </div>
              ))}
            </div>
          </div>
        ))}
        <h2>A wide table</h2>
        <div className="dash-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                {CELLS.map((c) => (
                  <th key={c}>Col {c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WIDE_ROWS.map((r) => (
                <tr key={r}>
                  {CELLS.map((c) => (
                    <td key={c}>{r * c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
