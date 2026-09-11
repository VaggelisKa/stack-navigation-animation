import { Injectable, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, ROUTER_CONFIGURATION, Router } from '@angular/router';
import type { Direction, DirectionOpinion, NavigationTrigger } from '@stacknav/core';
import { STACKNAV_CONFIG } from './config';

/** What a navigation can carry in `history.state[stateKey]`. */
export interface StackNavStateHint {
  direction?: DirectionOpinion;
  animated?: boolean;
}

export interface NavigationInfo {
  id: number;
  trigger: NavigationTrigger;
  /** negative = back, positive = forward, undefined when unknown */
  historyDelta: number | undefined;
  hint: DirectionOpinion;
  animated: boolean | undefined;
  replaceUrl: boolean;
  skipLocationChange: boolean;
  restoredId: number | null;
}

interface Entry {
  id: number;
  url: string;
}

/**
 * A model of the browser's history as the router walks it: which entry is
 * current, and which came before. It answers two questions for the outlet: is
 * this navigation going back or forward, and is the previous history entry the
 * page beneath the top? Everything comes from public router events, so it needs
 * no router configuration.
 */
@Injectable({ providedIn: 'root' })
export class StackNavHistory {
  private readonly router = inject(Router);
  private readonly config = inject(STACKNAV_CONFIG);
  private readonly cancelResolution = inject(ROUTER_CONFIGURATION, { optional: true })?.canceledNavigationResolution ?? 'replace';
  private entries: Entry[] = [];
  private cursor = -1;
  private pending: NavigationInfo | null = null;

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.onStart(e);
      else if (e instanceof NavigationEnd) this.onEnd(e);
      else if (e instanceof NavigationCancel || e instanceof NavigationError) this.onAbort();
      else if (e instanceof NavigationSkipped) this.pending = null;
    });
  }

  /** The navigation in flight, if any. Valid while the router activates routes. */
  get current(): NavigationInfo | null {
    return this.pending;
  }

  /** URL of the history entry before the current one, or null. */
  get previousUrl(): string | null {
    return this.cursor > 0 ? this.entries[this.cursor - 1].url : null;
  }

  get currentUrl(): string | null {
    return this.cursor >= 0 ? this.entries[this.cursor].url : null;
  }

  get canGoBack(): boolean {
    return this.cursor > 0;
  }

  private onStart(e: NavigationStart): void {
    const nav = this.router.getCurrentNavigation();
    const isHistory = e.navigationTrigger === 'popstate' || e.navigationTrigger === 'hashchange';
    const restoredId = e.restoredState?.navigationId ?? null;
    let historyDelta: number | undefined;
    if (isHistory) {
      const idx = this.indexOf(restoredId);
      if (idx >= 0 && this.cursor >= 0) historyDelta = idx - this.cursor;
      else if (restoredId != null && this.cursor >= 0) historyDelta = restoredId < this.entries[this.cursor].id ? -1 : 1;
    }
    const hint = isHistory ? undefined : readHint(nav?.extras.state, this.config.stateKey);
    this.pending = {
      id: e.id,
      trigger: isHistory ? 'history' : 'imperative',
      historyDelta,
      hint: hint?.direction,
      animated: hint?.animated,
      replaceUrl: !!nav?.extras.replaceUrl,
      skipLocationChange: !!nav?.extras.skipLocationChange,
      restoredId,
    };
  }

  private onEnd(e: NavigationEnd): void {
    const p = this.pending;
    this.pending = null;
    const entry: Entry = { id: e.id, url: e.urlAfterRedirects };
    if (!p || this.cursor < 0) {
      this.entries = [entry];
      this.cursor = 0;
      return;
    }
    if (p.trigger === 'history') {
      const idx = this.indexOf(p.restoredId);
      if (idx >= 0) {
        this.cursor = idx;
        this.entries[idx] = entry; // the router rewrites the entry's navigationId on popstate
      } else {
        this.entries = [entry];
        this.cursor = 0;
      }
      return;
    }
    if (p.skipLocationChange) return;
    if (p.replaceUrl) {
      this.entries[this.cursor] = entry;
      return;
    }
    this.entries.splice(this.cursor + 1);
    this.entries.push(entry);
    this.cursor++;
  }

  /**
   * Handles a history navigation the router refused. With
   * `canceledNavigationResolution: 'computed'` the router walks the browser back
   * to where it was, so nothing changes here. With the default `'replace'` it
   * overwrites the entry the browser landed on with the current URL and the last
   * successful id.
   */
  private onAbort(): void {
    const p = this.pending;
    this.pending = null;
    if (!p || p.trigger !== 'history' || this.cursor < 0 || this.cancelResolution === 'computed') return;
    const idx = this.indexOf(p.restoredId);
    if (idx < 0) return;
    this.entries[idx] = { ...this.entries[this.cursor] };
    this.cursor = idx;
  }

  /** The entry carrying `id`, preferring the nearest one that is not the current entry. */
  private indexOf(id: number | null): number {
    if (id == null) return -1;
    let best = -1;
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].id !== id) continue;
      if (best < 0 || best === this.cursor || (i !== this.cursor && Math.abs(i - this.cursor) < Math.abs(best - this.cursor))) best = i;
    }
    return best;
  }
}

function readHint(state: Record<string, unknown> | undefined, key: string): StackNavStateHint | undefined {
  const v = state?.[key];
  if (v == null) return undefined;
  if (typeof v === 'string') return { direction: v as Direction };
  if (typeof v === 'object') return v as StackNavStateHint;
  return undefined;
}
