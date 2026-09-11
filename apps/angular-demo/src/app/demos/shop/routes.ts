import type { Routes } from '@angular/router';
import { ShopCart, ShopCatalog, ShopCheckout, ShopOrder, ShopProduct, resolveProduct } from './shop';

export const SHOP_ROUTES: Routes = [
  { path: '', component: ShopCatalog },
  // The product is resolved before activation, so the push starts once the data is available.
  { path: 'p/:id', component: ShopProduct, resolve: { product: resolveProduct } },
  { path: 'cart', component: ShopCart },
  { path: 'cart/checkout', component: ShopCheckout },
  // Reached only by replacing the checkout page (router.navigate with a 'replace' hint).
  { path: 'order/:id', component: ShopOrder },
];
