import { Link, useNavigate } from 'react-router';
import { useBack } from '../back';

export function Settings() {
  const navigate = useNavigate();
  const back = useBack();
  return (
    <div className="page" data-page="settings">
      <header className="hdr">
        <button type="button" className="back" onClick={() => back('/')}>
          ‹ Back
        </button>
        <h1>Settings</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <p className="lede">
          This route carries <code>handle.stackLevel = 2</code>. Home is unnumbered and About is 3, so About pushes over this and Home is a pop.
        </p>
        <Link className="item" to="/about">
          <span>About</span>
          <small>stackLevel 3</small>
          <i>›</i>
        </Link>
        <Link className="item" to="/">
          <span>Home, via Link</span>
          <small>pops: it is kept beneath</small>
          <i>›</i>
        </Link>
        <button className="item" type="button" onClick={() => navigate('/about', { state: { stacknav: 'replace' } })}>
          <span>About, as a replace</span>
          <small>this page goes away</small>
          <i>›</i>
        </button>
      </div>
    </div>
  );
}
