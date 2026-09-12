import { useStackNav } from '@stacknav/react/react-router';
import type { StackRoutesRouteRef } from '@stacknav/react/react-router';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router';
import { useBack } from '../back';
import { initials } from './fake-api';
import { createStore } from './store';

/** Settings the Lab page changes. The App applies them to the outlet. */
export const prefs = createStore({
  /** 4x slower transitions, for inspecting a transition mid-flight. */
  slow: false,
  /** Start the back gesture from anywhere on the page, not only the leading edge. */
  anywhere: false,
});

/**
 * "Pop to root": goes back to a page still kept beneath, unwinding history by
 * as many entries as there are pages above it. The demos push one history entry
 * per page, and replaced pages use `replace`, so the counts match and a browser
 * back afterwards lands on the expected page.
 */
export function usePopTo(): (path: string) => void {
  const { pages } = useStackNav<StackRoutesRouteRef>();
  const navigate = useNavigate();
  return useCallback(
    (path: string) => {
      const i = pages.findIndex((p) => p.route.location.pathname === path);
      if (i >= 0 && i < pages.length - 1) void navigate(i - (pages.length - 1));
      else void navigate(path, { replace: true, state: { stacknav: 'pop' } });
    },
    [pages, navigate],
  );
}

/**
 * `<BackButton to="/shop">`: goes back through history, falling back to that
 * route as a pop after a deep link. The library has no back API of its own;
 * this is the app's `useBack()` in a button, so the demo headers stay short.
 */
export function BackButton({ to, children, className = 'back' }: { to: string; children: ReactNode; className?: string }) {
  const back = useBack();
  return (
    <button type="button" className={className} onClick={() => back(to)}>
      {children}
    </button>
  );
}

/**
 * A link that always pushes, regardless of what the route tree says: the
 * router's own `<Link>` with a hint in its `state`. Useful for flows that can
 * grow without bound (post → author → post → author …), where the tree would
 * treat the cross-links as siblings.
 */
export function PushLink(props: LinkProps) {
  return <Link {...props} state={{ stacknav: 'push', ...(props.state as object | undefined) }} />;
}

export function Avatar({ name, hue, size = 40, style }: { name: string; hue: number; size?: number; style?: CSSProperties }) {
  return (
    <span className="avatar" style={{ background: `hsl(${hue} 55% 52%)`, width: size, height: size, fontSize: size * 0.38, ...style }}>
      {initials(name)}
    </span>
  );
}

/** A loading placeholder: `lines` shimmering grey bars. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skel" aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel-line" style={{ width: `${[92, 70, 84, 55, 78][i % 5]}%` }} />
      ))}
    </div>
  );
}

/** An error message with a retry button. */
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="err" role="alert">
      <strong>Couldn't load.</strong>
      <span>{error instanceof Error ? error.message : String(error)}</span>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" role="progressbar" aria-label="Loading" />;
}

export interface Resource<T> {
  value: T | undefined;
  error: unknown;
  loading: boolean;
  reload(): void;
}

/**
 * Loads `load()` whenever `deps` change, ignoring results that arrive after a
 * newer request started. The loaded value is component state, so it lives
 * exactly as long as the page: kept while the page is beneath the top, gone
 * when the page is.
 */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[]): Resource<T> {
  const [state, setState] = useState<{ value: T | undefined; error: unknown; loading: boolean }>({ value: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, error: null, loading: true }));
    loadRef.current().then(
      (value) => live && setState({ value, error: null, loading: false }),
      (error: unknown) => live && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => {
      live = false;
    };
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** Renders `children` only after `ms` milliseconds, like a deferred block. */
export function Deferred({ ms, placeholder, children }: { ms: number; placeholder: ReactNode; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return <>{ready ? children : placeholder}</>;
}

export const formatNumber = (n: number): string => n.toLocaleString('en-US');
