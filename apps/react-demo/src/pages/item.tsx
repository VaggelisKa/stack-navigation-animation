import { Link, useNavigate, useParams } from 'react-router';
import { useBack } from '../back';

export function Item() {
  const { id = '' } = useParams();
  const next = Number(id) + 1;
  const navigate = useNavigate();
  const back = useBack();
  return (
    <div className="page" data-page="item">
      <header className="hdr">
        <button type="button" className="back" onClick={() => back('/')}>
          ‹ Back
        </button>
        <h1>Item {id}</h1>
        <span className="spacer" />
      </header>
      <div className="body">
        <p className="lede">
          Route <code>/items/{id}</code>. The id comes from <code>useParams()</code>, and keeps answering for this page while it is kept beneath another.
        </p>
        <h2>Deeper in the tree</h2>
        <Link className="item" to="reviews" relative="path">
          <span>Reviews</span>
          <i>›</i>
        </Link>
        <h2>Siblings</h2>
        <Link className="item" to={`/items/${next}`}>
          <span>Item {next}, via Link</span>
          <small>tree says replace</small>
          <i>›</i>
        </Link>
        <button className="item" type="button" onClick={() => navigate(`/items/${next}`, { state: { stacknav: 'push' } })}>
          <span>Item {next}, via a state hint</span>
          <small>hinted push</small>
          <i>›</i>
        </button>
        <h2>Back</h2>
        <button className="item" type="button" onClick={() => back('/')}>
          <span>Back</span>
          <small>history back, or / after a deep link</small>
          <i>›</i>
        </button>
      </div>
    </div>
  );
}
