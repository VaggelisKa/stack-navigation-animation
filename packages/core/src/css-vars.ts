// Reading the engine's knobs from CSS custom properties, so the look can be
// tuned from a stylesheet — in a media query, under a theme class, per
// container — instead of only from JS. Values are parsed the way CSS would
// read them (`300ms`, `0.4s`, `30%`, `cubic-bezier(...)`).

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
  if (v === undefined) return undefined;
  const m = /^([-+]?(?:\d+\.?\d*|\.\d+))(ms|s)?$/i.exec(v);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2]?.toLowerCase() === 's' ? n * 1000 : n;
}

export function parseNumber(v: string | undefined): number | undefined {
  if (v === undefined || !NUMBER.test(v)) return undefined;
  return Number(v);
}

/** A fraction, written either way: `0.3` and `30%` are the same. */
export function parseRatio(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (v.endsWith('%')) {
    const n = v.slice(0, -1).trim();
    return NUMBER.test(n) ? Number(n) / 100 : undefined;
  }
  return parseNumber(v);
}

/** The CSS timing keywords, plus the two curves this engine ships. */
const EASING_KEYWORDS: Record<string, Easing> = {
  linear: easings.linear,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  'ease-in': cubicBezier(0.42, 0, 1, 1),
  'ease-out': cubicBezier(0, 0, 0.58, 1),
  'ease-in-out': cubicBezier(0.42, 0, 0.58, 1),
  ios: easings.ios,
  'ios-settle': easings.easeOut,
};

/** A timing keyword or `cubic-bezier(x1, y1, x2, y2)`. */
export function parseEasing(v: string | undefined): Easing | undefined {
  if (v === undefined) return undefined;
  const s = v.toLowerCase();
  const keyword = EASING_KEYWORDS[s];
  if (keyword) return keyword;
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(s);
  if (!m) return undefined;
  const n = m[1].split(',').map((part) => part.trim());
  if (n.length !== 4 || !n.every((part) => NUMBER.test(part))) return undefined;
  const [x1, y1, x2, y2] = n.map(Number);
  return cubicBezier(x1, y1, x2, y2);
}

/** Colors, shadows and the like: whatever was written, as written. */
export function parseString(v: string | undefined): string | undefined {
  return v;
}
