import type { Routes } from '@angular/router';
import { ShopCart, ShopCatalog, ShopCheckout, ShopOrder, ShopProduct, resolveProduct } from './shop';

export const SHOP_ROUTES: Routes = [
  { path: '', component: ShopCatalog },
  // The product is resolved before activation: the push starts when the data is there.
  { path: 'p/:id', component: ShopProduct, resolve: { product: resolveProduct } },
  { path: 'cart', component: ShopCart },
  { path: 'cart/checkout', component: ShopCheckout },
  // Reached only through StackNav.replace() from the checkout.
  { path: 'order/:id', component: ShopOrder },
];
