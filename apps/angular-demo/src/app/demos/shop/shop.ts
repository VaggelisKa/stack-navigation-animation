import { Component, Injectable, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink, type ResolveFn } from '@angular/router';
import { StackNav, StackNavBack } from '@stacknav/angular';
import { FakeApi, type Product } from '../fake-api';
import { DEMO_UI, DemoNav } from '../shared';

@Injectable({ providedIn: 'root' })
export class Cart {
  readonly lines = signal<{ product: Product; qty: number }[]>([]);
  readonly count = computed(() => this.lines().reduce((n, l) => n + l.qty, 0));
  readonly total = computed(() => this.lines().reduce((n, l) => n + l.qty * l.product.price, 0));

  add(product: Product): void {
    this.lines.update((ls) => (ls.some((l) => l.product.id === product.id) ? ls.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { product, qty: 1 }]));
  }
  change(product: Product, by: number): void {
    this.lines.update((ls) => ls.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + by } : l)).filter((l) => l.qty > 0));
  }
  clear(): void {
    this.lines.set([]);
  }
}

/** The product page's data is resolved before the route activates: the tap waits, the page never shows empty. */
export const resolveProduct: ResolveFn<Product> = (route) => inject(FakeApi).product(Number(route.paramMap.get('id')));

const swatch = (p: Product, dir = 160) => `linear-gradient(${dir}deg, hsl(${p.hue} 65% 62%), hsl(${(p.hue + 40) % 360} 60% 38%))`;

/** A two-column product grid with category chips; the chosen chip survives a round trip. */
@Component({
  selector: 'shop-catalog',
  // The cart is a sibling of a product in the route tree, so its button pushes explicitly.
  imports: [RouterLink, StackNavBack, ...DEMO_UI],
  template: `
    <div class="page shop">
      <header class="hdr shop-hdr">
        <button type="button" class="back" snBack="/">‹ Demos</button>
        <h1>Shop</h1>
        <a class="shop-cart-btn" [pushTo]="['/shop/cart']" aria-label="Cart">
          ◱
          @if (cart.count()) {
            <b>{{ cart.count() }}</b>
          }
        </a>
      </header>
      <div class="shop-chips">
        <button type="button" [class.on]="category() === null" (click)="category.set(null)">All</button>
        @for (c of categories; track c) {
          <button type="button" [class.on]="category() === c" (click)="category.set(c)">{{ c }}</button>
        }
      </div>
      @if (products.error(); as e) {
        <demo-error [error]="e" (retry)="products.reload()" />
      } @else if (products.isLoading()) {
        <div class="shop-grid">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="shop-tile skel-tile"></div>
          }
        </div>
      } @else if (products.hasValue()) {
        <div class="shop-grid">
          @for (p of products.value(); track p.id) {
            <a class="shop-tile" [routerLink]="['/shop/p', p.id]">
              <div class="shop-swatch" [style.background]="swatch(p)"></div>
              <b>{{ p.name }}</b>
              <span>{{ p.category }} · ★ {{ p.rating }}</span>
              <em>\${{ p.price }}</em>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class ShopCatalog {
  private readonly api = inject(FakeApi);
  readonly cart = inject(Cart);
  readonly categories = this.api.categories();
  readonly category = signal<string | null>(null);
  readonly products = resource({ params: () => this.category(), loader: ({ params }) => this.api.products(params) });
  readonly swatch = swatch;
}

/** A full-bleed hero under a transparent header, a sticky buy bar, and related items arriving late. */
@Component({
  selector: 'shop-product',
  imports: [StackNavBack, ...DEMO_UI],
  template: `
    <div class="page shop shop-detail">
      <header class="hdr shop-hdr-float">
        <button type="button" class="back" snBack="/shop">‹</button>
        <h1 class="sr-only">{{ product().name }}</h1>
        <a class="shop-cart-btn" [pushTo]="['/shop/cart']" aria-label="Cart">
          ◱
          @if (cart.count()) {
            <b>{{ cart.count() }}</b>
          }
        </a>
      </header>
      <div class="shop-hero" [style.background]="swatch(product(), 200)"></div>
      <div class="shop-body">
        <small>{{ product().category }}</small>
        <h2>{{ product().name }}</h2>
        <p class="shop-price">\${{ product().price }} <span>★ {{ product().rating }}</span></p>
        <p>{{ product().blurb }}</p>
        <ul class="shop-details">
          @for (d of product().details; track d) {
            <li>{{ d }}</li>
          }
        </ul>
        <h3>You might also like</h3>
        @if (related.isLoading()) {
          <div class="shop-strip">
            @for (i of [1, 2, 3]; track i) {
              <div class="shop-mini skel-tile"></div>
            }
          </div>
        } @else if (related.hasValue()) {
          <div class="shop-strip">
            @for (p of related.value(); track p.id) {
              <a class="shop-mini" [pushTo]="['/shop/p', p.id]">
                <div [style.background]="swatch(p, 120)"></div>
                <b>{{ p.name }}</b><span>\${{ p.price }}</span>
              </a>
            }
          </div>
        }
      </div>
      <div class="shop-buybar">
        <button type="button" (click)="add()" [class.added]="added()">{{ added() ? 'Added ✓' : 'Add to cart · $' + product().price }}</button>
      </div>
    </div>
  `,
})
export class ShopProduct {
  /** Bound from the resolver's result through component input binding. */
  readonly product = input.required<Product>();
  private readonly api = inject(FakeApi);
  readonly cart = inject(Cart);
  readonly related = resource({ params: () => this.product().id, loader: ({ params }) => this.api.related(params) });
  readonly added = signal(false);
  readonly swatch = swatch;

  add(): void {
    this.cart.add(this.product());
    this.added.set(true);
    setTimeout(() => this.added.set(false), 1200);
  }
}

@Component({
  selector: 'shop-cart',
  imports: [RouterLink, StackNavBack],
  template: `
    <div class="page shop">
      <header class="hdr shop-hdr">
        <button type="button" class="back" snBack="/shop">‹ Back</button>
        <h1>Cart</h1>
        <span class="spacer"></span>
      </header>
      @if (cart.lines().length === 0) {
        <div class="shop-empty">
          <span>◱</span>
          <p>Your cart is empty.</p>
          <a routerLink="/shop">Browse the shop</a>
        </div>
      } @else {
        @for (l of cart.lines(); track l.product.id) {
          <div class="shop-line">
            <div class="shop-thumb" [style.background]="swatch(l.product)"></div>
            <div class="shop-line-body">
              <b>{{ l.product.name }}</b>
              <span>\${{ l.product.price }} each</span>
            </div>
            <div class="shop-qty">
              <button type="button" (click)="cart.change(l.product, -1)" aria-label="Fewer">−</button>
              <span>{{ l.qty }}</span>
              <button type="button" (click)="cart.change(l.product, 1)" aria-label="More">＋</button>
            </div>
          </div>
        }
        <div class="shop-summary">
          <div><span>Subtotal</span><b>\${{ cart.total() }}</b></div>
          <div><span>Shipping</span><b>Free</b></div>
          <div class="total"><span>Total</span><b>\${{ cart.total() }}</b></div>
        </div>
        <div class="shop-buybar">
          <a routerLink="/shop/cart/checkout">Check out</a>
        </div>
      }
    </div>
  `,
})
export class ShopCart {
  readonly cart = inject(Cart);
  readonly swatch = swatch;
}

/** A form that submits to the fake backend; success replaces this page so Back can't return to a paid form. */
@Component({
  selector: 'shop-checkout',
  imports: [StackNavBack, ...DEMO_UI],
  template: `
    <div class="page shop">
      <header class="hdr shop-hdr">
        <button type="button" class="back" snBack="/shop/cart">‹ Cart</button>
        <h1>Checkout</h1>
        <span class="spacer"></span>
      </header>
      <form class="shop-form" (submit)="submit($event)">
        <label>Name<input name="name" required autocomplete="name" [disabled]="busy()" /></label>
        <label>Email<input name="email" type="email" required autocomplete="email" [disabled]="busy()" /></label>
        <label>Address<input name="address" required autocomplete="street-address" [disabled]="busy()" /></label>
        <div class="row">
          <label>City<input name="city" required [disabled]="busy()" /></label>
          <label>Postcode<input name="zip" required inputmode="numeric" [disabled]="busy()" /></label>
        </div>
        <label>Card<input name="card" required inputmode="numeric" placeholder="4242 4242 4242 4242" [disabled]="busy()" /></label>
        <label class="switch"><span>Simulate a declined card</span><input type="checkbox" name="decline" [checked]="decline()" (change)="decline.set($any($event.target).checked)" [disabled]="busy()" /><i></i></label>
        @if (error(); as e) {
          <demo-error [error]="e" (retry)="error.set(null)" />
        }
        <div class="shop-buybar static">
          <button type="submit" [disabled]="busy() || cart.lines().length === 0">
            @if (busy()) {
              <demo-spinner /> Placing order…
            } @else {
              Pay \${{ cart.total() }}
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ShopCheckout {
  readonly cart = inject(Cart);
  private readonly api = inject(FakeApi);
  private readonly nav = inject(StackNav);
  readonly busy = signal(false);
  readonly error = signal<unknown>(null);
  readonly decline = signal(false);

  async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const order = await this.api.placeOrder(this.cart.lines(), { fail: this.decline() });
      this.cart.clear();
      // replaceUrl too, so the browser's history entry for the form is gone as well as its page
      await this.nav.replace(['/shop/order', order.id], { replaceUrl: true });
    } catch (err) {
      this.error.set(err instanceof Error ? new Error(this.decline() ? 'Your card was declined (simulated).' : err.message) : err);
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'shop-order',
  template: `
    <div class="page shop shop-done">
      <header class="hdr shop-hdr"><span class="spacer"></span><h1>Order placed</h1><span class="spacer"></span></header>
      <div class="shop-done-body">
        <div class="shop-check">✓</div>
        <h2>Thanks!</h2>
        <p>Order <b>{{ id() }}</b> is on its way.</p>
        <p class="muted">This page replaced the checkout, so a swipe or Back goes to the cart, not to a form that was already paid.</p>
        <button type="button" (click)="done()">Continue shopping</button>
      </div>
    </div>
  `,
})
export class ShopOrder {
  readonly id = input.required<string>();
  private readonly nav = inject(DemoNav);
  /** The catalog is still kept beneath: one pop, straight through the cart and the product. */
  done(): void {
    this.nav.popTo('/shop');
  }
}
