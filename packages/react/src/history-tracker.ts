import type { NavigationTrigger } from '@stacknav/core';

/** The three things a history-based router does to the session history. */
export type HistoryAction = 'PUSH' | 'REPLACE' | 'POP';

export interface HistoryRecord {
  trigger: NavigationTrigger;
  /** for history triggers, when known: negative = back, positive = forward */
  historyDelta: number | undefined;
}

/**
 * A model of the browser's session history as a router walks it, built from
 * what routers make public: a key per entry and the action that got there.
 * It answers two questions for the stack: is this navigation going back or
 * forward, and is the entry before the current one the page beneath the top?
 */
export interface HistoryTracker {
  /**
   * Records that the router is now at `key` after `action`. Idempotent for
   * the key already current, so it can run during render.
   */
  record(key: string, action: HistoryAction): HistoryRecord;
  /** key of the entry before the current one, or null */
  readonly previousKey: string | null;
  readonly currentKey: string | null;
  readonly canGoBack: boolean;
}

export function createHistoryTracker(): HistoryTracker {
  let entries: string[] = [];
  let cursor = -1;
  let last: HistoryRecord = { trigger: 'imperative', historyDelta: undefined };

  return {
    record(key, action) {
      if (cursor >= 0 && entries[cursor] === key) return last;
      if (cursor < 0) {
        // the first entry seen; whatever action the router reports, there is nothing to go back to yet
        entries = [key];
        cursor = 0;
        last = { trigger: 'imperative', historyDelta: undefined };
        return last;
      }
      if (action === 'POP') {
        const idx = entries.indexOf(key);
        if (idx >= 0) {
          last = { trigger: 'history', historyDelta: idx - cursor };
          cursor = idx;
        } else {
          // an entry from before the app mounted, or one the router did not tell us about
          entries = [key];
          cursor = 0;
          last = { trigger: 'history', historyDelta: undefined };
        }
        return last;
      }
      if (action === 'REPLACE') entries[cursor] = key;
      else {
        entries.splice(cursor + 1);
        entries.push(key);
        cursor++;
      }
      last = { trigger: 'imperative', historyDelta: undefined };
      return last;
    },
    get previousKey() {
      return cursor > 0 ? entries[cursor - 1] : null;
    },
    get currentKey() {
      return cursor >= 0 ? entries[cursor] : null;
    },
    get canGoBack() {
      return cursor > 0;
    },
  };
}
