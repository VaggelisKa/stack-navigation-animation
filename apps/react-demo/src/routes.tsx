import { Navigate, Route } from 'react-router';
import { ChatInbox, ChatThread } from './demos/chat/chat';
import { FeedHome, FeedPost, FeedProfile } from './demos/feed/feed';
import { GalleryGrid, GalleryPhoto } from './demos/gallery/gallery';
import { LabDeep, LabHome, LabSlow, LabStress, LabWide } from './demos/lab/lab';
import { ShopCart, ShopCatalog, ShopCheckout, ShopOrder, ShopProduct } from './demos/shop/shop';
import { About } from './pages/about';
import { Home } from './pages/home';
import { Item } from './pages/item';
import { Reviews } from './pages/reviews';
import { Settings } from './pages/settings';

/**
 * Plain `<Route>` elements, as `<Routes>` would take them. The stack reads the
 * URL segments to decide push and pop, so the routes can stay flat; `handle`
 * carries the numbers for the screens the tree gets wrong.
 */
export const routes = (
  <>
    <Route path="/" element={<Home />} />
    {/* Feed: both pages are children of /feed, so the tree pushes them. Relative to each other they are siblings, so the cards push explicitly. */}
    <Route path="/feed" element={<FeedHome />} />
    <Route path="/feed/post/:id" element={<FeedPost />} />
    <Route path="/feed/user/:handle" element={<FeedProfile />} />
    {/* Shop: the order page is reached only by replacing the checkout (a 'replace' hint in the navigation state). */}
    <Route path="/shop" element={<ShopCatalog />} />
    <Route path="/shop/p/:id" element={<ShopProduct />} />
    <Route path="/shop/cart" element={<ShopCart />} />
    <Route path="/shop/cart/checkout" element={<ShopCheckout />} />
    <Route path="/shop/order/:id" element={<ShopOrder />} />
    <Route path="/messages" element={<ChatInbox />} />
    <Route path="/messages/:id" element={<ChatThread />} />
    <Route path="/gallery" element={<GalleryGrid />} />
    <Route path="/gallery/:id" element={<GalleryPhoto />} />
    <Route path="/lab" element={<LabHome />} />
    <Route path="/lab/stress" element={<LabStress />} />
    <Route path="/lab/deep/:n" element={<LabDeep />} />
    <Route path="/lab/slow" element={<LabSlow />} />
    <Route path="/lab/wide" element={<LabWide />} />
    {/* The route tree decides these: /items/:id is beneath / (push), and /items/:id/reviews beneath that. */}
    <Route path="/items/:id" element={<Item />} />
    <Route path="/items/:id/reviews" element={<Reviews />} />
    {/* Numbered screens: /settings and /about sit at the same tree depth as /, but their numbers place settings above home and about above settings. */}
    <Route path="/settings" element={<Settings />} handle={{ stackLevel: 2 }} />
    <Route path="/about" element={<About />} handle={{ stackLevel: 3 }} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </>
);
