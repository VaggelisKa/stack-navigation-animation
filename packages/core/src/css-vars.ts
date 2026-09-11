// Reading the engine's knobs from CSS custom properties, so the look can be
// tuned from a stylesheet — in a media query, under a theme class, per
// container — instead of only from JS. Values are parsed the way CSS would
// read them (`300ms`, `0.4s`, `30%`, `cubic-bezier(...)`).
//
// Every parser returns undefined for anything it does not understand, never
// NaN: a value the engine cannot read has to fall through to its JS option,
// not poison a transform.

import { cubicBezier, easings, type Easing } from './animate.ts';

/** Looks a custom property up on an element; `undefined` when it is not set. */
export type CSSVarReader = (name: string) => string | undefined;

/**
 * A reader over `el`'s computed custom properties. Custom properties inherit,
 * so a variable set on `:root` (or any ancestor) is visible here. Returns a
 * reader that finds nothing when there is no element or no `getComputedStyle`
 * (SSR, tests), which makes every caller fall back to its JS option.
 */
export function cssVars(el: Element | null | undefined): CSSVarReader {
  const style = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  if (!style) return () => undefined;
  return (name) => {
    const v = style.getPropertyValue(name)?.trim();
    return v ? v : undefined;
  };
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;

/** `500ms`, `0.4s`, or a bare number of milliseconds. */
export function parseTime(v: string | undefined): number | undefined {
  const m = v === undefined ? null : /^([-+]?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i.exec(v.trim());
  if (!m) return undefined;
  return m[2]?.toLowerCase() === 's' ? Number(m[1]) * 1000 : Number(m[1]);
}

export function parseNumber(v: string | undefined): number | undefined {
  const s = v?.trim();
  return s !== undefined && NUMBER.test(s) ? Number(s) : undefined;
}

/** A fraction, written either way: `0.3` and `30%` are the same. */
export function parseRatio(v: string | undefined): number | undefined {
  const s = v?.trim();
  if (s === undefined) return undefined;
  if (!s.endsWith('%')) return parseNumber(s);
  const n = parseNumber(s.slice(0, -1));
  return n === undefined ? undefined : n / 100;
}

/**
 * The CSS timing keywords that are cubic curves, plus the two this engine
 * ships. Null-prototype, so `__proto__` and `constructor` are misses like any
 * other unknown word rather than truthy junk that is not an easing function.
 *
 * Built on first use rather than at module load: solving four curves here
 * would be work a bundler cannot prove pointless, which would keep this
 * module (and `easings`) in bundles that never parse a CSS variable.
 */
let easingKeywords: Record<string, Easing> | undefined;
const easingKeywordsOf = (): Record<string, Easing> =>
  (easingKeywords ??= Object.assign(Object.create(null), {
    linear: easings.linear,
    ease: cubicBezier(0.25, 0.1, 0.25, 1),
    'ease-in': cubicBezier(0.42, 0, 1, 1),
    'ease-out': cubicBezier(0, 0, 0.58, 1),
    'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
    ios: easings.ios,
    'ios-settle': easings.easeOut,
  }));

/**
 * A timing keyword or `cubic-bezier(x1, y1, x2, y2)`. The x coordinates must
 * be within [0, 1], as CSS requires: outside it the curve is not a function of
 * time and the solver would not converge.
 */
export function parseEasing(v: string | undefined): Easing | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  const keyword = easingKeywordsOf()[s];
  if (keyword) return keyword;
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(s);
  if (!m) return undefined;
  const n = m[1].split(',').map((part) => parseNumber(part));
  if (n.length !== 4 || n.some((x) => x === undefined)) return undefined;
  const [x1, y1, x2, y2] = n as number[];
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return undefined;
  return cubicBezier(x1, y1, x2, y2);
}
