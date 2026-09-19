import { test } from 'node:test';
import type { NavigationStack, StackEntry } from '../src/navigation-stack.ts';

/**
 * The type-level half of the read-only state tests. This is the one test file
 * `tsconfig.json` includes, so `pnpm typecheck` reads every
 * `@ts-expect-error` below and fails if the error it expects has gone --
 * which is what makes `entries` and `busy` being read-only from the outside a
 * checked promise rather than a convention. The runtime behaviour lives in
 * `navigation-stack.test.ts`.
 *
 * Nothing here runs: `stack` is only declared, and the writes sit in a
 * function that is never called, because assigning to a getter-only property
 * in a module would throw.
 */
declare const stack: NavigationStack;

function rejectedWrites(): void {
  // @ts-expect-error entries is read-only: the stack owns its array.
  stack.entries = [];
  // @ts-expect-error the array itself is read-only, not just the property.
  stack.entries.push({} as StackEntry);
  // @ts-expect-error the array itself is read-only, not just the property.
  stack.entries[0] = {} as StackEntry;
  // @ts-expect-error busy is a getter: only the stack moves it.
  stack.busy = true;
}

function acceptedReads(): void {
  const entries: readonly StackEntry[] = stack.entries;
  const snapshot: StackEntry[] = stack.entries.slice();
  const busy: boolean = stack.busy;
  void entries.length;
  void snapshot;
  void busy;
}

test('entries and busy are read-only from the outside (enforced by tsc)', () => {
  void rejectedWrites;
  void acceptedReads;
});
