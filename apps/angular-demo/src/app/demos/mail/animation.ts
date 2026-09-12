import type { Direction, DirectionStrategy } from '@stacknav/core';

/**
 * A direction strategy for teams that already name their routes the way
 * Angular's route-transition recipe does:
 *
 *   { path: 'thread/:id', component: Thread, data: { animation: 'Thread' } }
 *
 * With `@angular/animations`, those names feed a `trigger('routeAnimations')`
 * whose `transition('Inbox => Thread', …)` entries say what each pair does.
 * This strategy takes the same table, reduced to push / pop / replace, and the
 * routes keep their `animation` data untouched. Keys use the same syntax:
 * `A => B`, `* => B`, `A => *`, and `A <=> B` for both ways, where the way back
 * gets the opposite direction (the reverse of a push is a pop; a replace stays
 * a replace). The first matching rule wins, so specific rules go first.
 *
 * It has no answer when either page lacks a name or no rule matches, so the
 * strategies after it (numbering, the route tree) still decide for those.
 */
export type AnimationTransitions = Readonly<Record<string, Direction>>;

interface Rule {
  from: string;
  to: string;
  direction: Direction;
}

const reverse = (d: Direction): Direction => (d === 'push' ? 'pop' : d === 'pop' ? 'push' : 'replace');

export function fromAnimationData(transitions: AnimationTransitions, { key = 'animation' } = {}): DirectionStrategy {
  const rules: Rule[] = [];
  for (const [pair, direction] of Object.entries(transitions)) {
    const both = pair.includes('<=>');
    const [from = '*', to = '*'] = pair.split(both ? '<=>' : '=>').map((s) => s.trim());
    rules.push({ from, to, direction });
    if (both) rules.push({ from: to, to: from, direction: reverse(direction) });
  }
  return ({ from, to }) => {
    const a = from?.data?.[key];
    const b = to.data?.[key];
    if (typeof a !== 'string' || typeof b !== 'string') return undefined;
    return rules.find((r) => (r.from === '*' || r.from === a) && (r.to === '*' || r.to === b))?.direction;
  };
}

/** The Mail demo's table. Order matters: `Compose` and `Thread` outrank the folder rule. */
export const MAIL_TRANSITIONS: AnimationTransitions = {
  '* <=> Compose': 'push', // the composer opens over any page and pops back to it
  '* <=> Thread': 'push', // a thread opens over the folder and pops back to it
  'Inbox <=> Sent': 'replace', // switching folders swaps the page in place
};
