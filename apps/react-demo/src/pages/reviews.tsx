import { useLocation, useParams } from 'react-router';
import { useBack } from '../back';

const REVIEWS = ['Five stars, would push again.', 'Popped right back where I was.', 'The parallax is subtle. I like it.'];

export function Reviews() {
  const { id = '' } = useParams();
  const location = useLocation();
  const back = useBack();
  return (
    <div className="page" data-page="reviews">
      <header className="hdr">
        <button type="button" className="back" onClick={() => back(`/items/${id}`)}>
          ‹ Item {id}
        </button>
        <h1>Reviews</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <p className="lede">Three levels deep. Swipe from the left edge, press the browser back button, or tap Back: all three pop.</p>
        {REVIEWS.map((r) => (
          <div key={r} className="item">
            <span>{r}</span>
          </div>
        ))}
        <h2>Frozen location</h2>
        <p className="lede">
          <code>useLocation()</code> says <code>{location.pathname}</code>. While this page is kept beneath another, it keeps saying so: pages beneath the top are rendered at the location they were reached at.
        </p>
      </div>
    </div>
  );
}
