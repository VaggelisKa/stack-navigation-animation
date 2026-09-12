import { Link } from 'react-router';
import { useBack } from '../back';

export function About() {
  const back = useBack();
  return (
    <div className="page" data-page="about">
      <header className="hdr">
        <button type="button" className="back" onClick={() => back('/settings')}>
          ‹ Back
        </button>
        <h1>About</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <p className="lede">
          <code>stackLevel = 3</code>. Nothing here is prescribed by the engine: the numbers live on your routes.
        </p>
        <Link className="item" to="/settings">
          <span>Settings</span>
          <small>pop: 3 → 2</small>
          <i>›</i>
        </Link>
      </div>
    </div>
  );
}
