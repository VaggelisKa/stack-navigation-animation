import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, type Product } from '../fake-api';
import { BackButton, ErrorBox, PushLink, Spinner, usePopTo, useResource } from '../shared';
import { createStore, useStore } from '../store';

interface Line {
  product: Product;
  qty: number;
}

/** The cart lives outside any page, so it survives every push and pop. */
const cart = createStore<Line[]>([]);
const cartCount = (lines: Line[]) => lines.reduce((n, l) => n + l.qty, 0);
const cartTotal = (lines: Line[]) => lines.reduce((n, l) => n + l.qty * l.product.price, 0);
const addToCart = (product: Product) =>
  cart.set((ls) => (ls.some((l) => l.product.id === product.id) ? ls.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { product, qty: 1 }]));
const changeQty = (product: Product, by: number) => cart.set((ls) => ls.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + by } : l)).filter((l) => l.qty > 0));

const swatch = (p: Product, dir = 160) => `linear-gradient(${dir}deg, hsl(${p.hue} 65% 62%), hsl(${(p.hue + 40) % 360} 60% 38%))`;

function CartButton() {
  const count = cartCount(useStore(cart));
  // The cart is a sibling of a product in the route tree, so its button pushes explicitly.
  return (
    <PushLink className="shop-cart-btn" to="/shop/cart" aria-label="Cart">
      ◱{count > 0 && <b>{count}</b>}
    </PushLink>
  );
}

/** A two-column product grid with category chips. The selected chip survives a round trip. */
export function ShopCatalog() {
  const [category, setCategory] = useState<string | null>(null);
  const products = useResource(() => api.products(category), [category]);
  return (
    <div className="page shop" data-page="shop">
      <header className="hdr shop-hdr">
        <BackButton to="/">‹ Demos</BackButton>
        <h1>Shop</h1>
        <CartButton />
      </header>
      <div className="shop-chips">
        <button type="button" className={category === null ? 'on' : undefined} onClick={() => setCategory(null)}>
          All
        </button>
        {api.categories().map((c) => (
          <button key={c} type="button" className={category === c ? 'on' : undefined} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      {products.error != null ? (
        <ErrorBox error={products.error} onRetry={products.reload} />
      ) : products.loading ? (
        <div className="shop-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="shop-tile skel-tile" />
          ))}
        </div>
      ) : (
        <div className="shop-grid">
          {products.value?.map((p) => (
            <Link key={p.id} className="shop-tile" to={`/shop/p/${p.id}`}>
              <div className="shop-swatch" style={{ background: swatch(p) }} />
              <b>{p.name}</b>
              <span>
                {p.category} · ★ {p.rating}
              </span>
              <em>${p.price}</em>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A full-bleed hero under a transparent header, a sticky buy bar, and related
 * items that load late. Declarative routing has no resolvers, so the product
 * itself also loads after the push starts: the page arrives with a skeleton
 * hero and fills in, which is the point of the demo.
 */
export function ShopProduct() {
  const { id = '' } = useParams();
  const n = Number(id);
  const product = useResource(() => api.product(n), [n]);
  const related = useResource(() => api.related(n), [n]);
  const [added, setAdded] = useState(false);
  const p = product.value;

  const add = () => {
    if (!p) return;
    addToCart(p);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="page shop shop-detail" data-page="shop-product">
      <header className="hdr shop-hdr-float">
        <BackButton to="/shop">‹</BackButton>
        <h1 className="sr-only">{p?.name ?? 'Product'}</h1>
        <CartButton />
      </header>
      {product.error != null ? (
        <ErrorBox error={product.error} onRetry={product.reload} />
      ) : (
        <>
          <div className={p ? 'shop-hero' : 'shop-hero skel-tile'} style={p ? { background: swatch(p, 200) } : undefined} />
          <div className="shop-body">
            {p ? (
              <>
                <small>{p.category}</small>
                <h2>{p.name}</h2>
                <p className="shop-price">
                  ${p.price} <span>★ {p.rating}</span>
                </p>
                <p>{p.blurb}</p>
                <ul className="shop-details">
                  {p.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="skel">
                <div className="skel-line" style={{ width: '40%' }} />
                <div className="skel-line" style={{ width: '70%' }} />
                <div className="skel-line" style={{ width: '90%' }} />
              </div>
            )}
            <h3>You might also like</h3>
            <div className="shop-strip">
              {related.loading || !related.value
                ? [1, 2, 3].map((i) => <div key={i} className="shop-mini skel-tile" />)
                : related.value.map((r) => (
                    <PushLink key={r.id} className="shop-mini" to={`/shop/p/${r.id}`}>
                      <div style={{ background: swatch(r, 120) }} />
                      <b>{r.name}</b>
                      <span>${r.price}</span>
                    </PushLink>
                  ))}
            </div>
          </div>
          <div className="shop-buybar">
            <button type="button" onClick={add} className={added ? 'added' : undefined} disabled={!p}>
              {added ? 'Added ✓' : p ? `Add to cart · $${p.price}` : 'Loading…'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ShopCart() {
  const lines = useStore(cart);
  const total = cartTotal(lines);
  return (
    <div className="page shop" data-page="shop-cart">
      <header className="hdr shop-hdr">
        <BackButton to="/shop">‹ Back</BackButton>
        <h1>Cart</h1>
        <span className="spacer" />
      </header>
      {lines.length === 0 ? (
        <div className="shop-empty">
          <span>◱</span>
          <p>Your cart is empty.</p>
          <Link to="/shop">Browse the shop</Link>
        </div>
      ) : (
        <>
          {lines.map((l) => (
            <div key={l.product.id} className="shop-line">
              <div className="shop-thumb" style={{ background: swatch(l.product) }} />
              <div className="shop-line-body">
                <b>{l.product.name}</b>
                <span>${l.product.price} each</span>
              </div>
              <div className="shop-qty">
                <button type="button" onClick={() => changeQty(l.product, -1)} aria-label="Fewer">
                  −
                </button>
                <span>{l.qty}</span>
                <button type="button" onClick={() => changeQty(l.product, 1)} aria-label="More">
                  ＋
                </button>
              </div>
            </div>
          ))}
          <div className="shop-summary">
            <div>
              <span>Subtotal</span>
              <b>${total}</b>
            </div>
            <div>
              <span>Shipping</span>
              <b>Free</b>
            </div>
            <div className="total">
              <span>Total</span>
              <b>${total}</b>
            </div>
          </div>
          <div className="shop-buybar">
            <Link to="/shop/cart/checkout">Check out</Link>
          </div>
        </>
      )}
    </div>
  );
}

/** A form that submits to the fake backend. Success replaces this page, so Back cannot return to a submitted form. */
export function ShopCheckout() {
  const lines = useStore(cart);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [decline, setDecline] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const order = await api.placeOrder(lines, { fail: decline });
      cart.set([]);
      // `replace` as well, so the browser's history entry for the form is removed along with its page
      void navigate(`/shop/order/${order.id}`, { replace: true, state: { stacknav: 'replace' } });
    } catch (err) {
      setError(err instanceof Error ? new Error(decline ? 'Your card was declined (simulated).' : err.message) : err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page shop" data-page="shop-checkout">
      <header className="hdr shop-hdr">
        <BackButton to="/shop/cart">‹ Cart</BackButton>
        <h1>Checkout</h1>
        <span className="spacer" />
      </header>
      <form className="shop-form" onSubmit={submit}>
        <label>
          Name
          <input name="name" required autoComplete="name" disabled={busy} />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" disabled={busy} />
        </label>
        <label>
          Address
          <input name="address" required autoComplete="street-address" disabled={busy} />
        </label>
        <div className="row">
          <label>
            City
            <input name="city" required disabled={busy} />
          </label>
          <label>
            Postcode
            <input name="zip" required inputMode="numeric" disabled={busy} />
          </label>
        </div>
        <label>
          Card
          <input name="card" required inputMode="numeric" placeholder="4242 4242 4242 4242" disabled={busy} />
        </label>
        <label className="switch">
          <span>Simulate a declined card</span>
          <input type="checkbox" name="decline" checked={decline} onChange={(e) => setDecline(e.target.checked)} disabled={busy} />
          <i />
        </label>
        {error != null && <ErrorBox error={error} onRetry={() => setError(null)} />}
        <div className="shop-buybar static">
          <button type="submit" disabled={busy || lines.length === 0}>
            {busy ? (
              <>
                <Spinner /> Placing order…
              </>
            ) : (
              `Pay $${cartTotal(lines)}`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ShopOrder() {
  const { id = '' } = useParams();
  const popTo = usePopTo();
  return (
    <div className="page shop shop-done" data-page="shop-order">
      <header className="hdr shop-hdr">
        <span className="spacer" />
        <h1>Order placed</h1>
        <span className="spacer" />
      </header>
      <div className="shop-done-body">
        <div className="shop-check">✓</div>
        <h2>Thanks!</h2>
        <p>
          Order <b>{id}</b> is on its way.
        </p>
        <p className="muted">This page replaced the checkout, so a swipe or Back goes to the cart, not to a form that was already paid.</p>
        {/* The catalog is still kept beneath, so this is one pop straight past the cart and the product. */}
        <button type="button" onClick={() => popTo('/shop')}>
          Continue shopping
        </button>
      </div>
    </div>
  );
}
