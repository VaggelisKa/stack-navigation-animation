import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StackNavFillViewport } from '../lib/fill-viewport';

/**
 * jsdom has no layout, so every measurement the directive makes is stubbed:
 * these tests pin when it measures and what it writes, not what a real browser
 * would compute. The arithmetic against a real viewport belongs to the demo's
 * e2e run (`apps/angular-demo/e2e/fill-viewport.mjs`).
 */

@Component({
  selector: 'sn-fill-host',
  imports: [StackNavFillViewport],
  template: '<div stackNavFillViewport style="height: 123px; box-sizing: content-box"></div>',
})
class Host {}

/** The observers the directive creates, newest last, so a test can fire one. */
const observers: MockResizeObserver[] = [];

class MockResizeObserver {
  readonly targets: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: () => void) {
    observers.push(this);
  }
  observe(target: Element): void {
    this.targets.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  /** Stands in for the browser reporting a box change on an observed target. */
  fire(): void {
    if (!this.disconnected) this.callback();
  }
}

/** The element's distance from the top of the viewport; tests move it. */
let top = 100;
/** Layout reads made since the counter was last cleared. */
let reads = 0;
let fixture: ComponentFixture<Host>;
let el: HTMLElement;

function setup(): void {
  fixture = TestBed.createComponent(Host);
  el = fixture.nativeElement.querySelector('div');
  // Stub layout before the first render callback runs, so the directive's very
  // first measurement already sees the element as laid out.
  el.getClientRects = (() => {
    reads++;
    return { length: 1 } as unknown as DOMRectList;
  }) as HTMLElement['getClientRects'];
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  fixture.detectChanges();
}

/** Runs the frames a trigger's burst schedules. */
function frames(count = 20): void {
  vi.advanceTimersByTime(count * 16);
}

beforeEach(() => {
  vi.useFakeTimers();
  top = 100;
  reads = 0;
  observers.length = 0;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768, writable: true });
  // jsdom ships no ResizeObserver; the directive has to find one to observe.
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  TestBed.resetTestingModule();
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  vi.useRealTimers();
});

describe('StackNavFillViewport', () => {
  it('sizes the element to the viewport on the first render', () => {
    setup();
    expect(el.style.boxSizing).toBe('border-box');
    expect(el.style.height).toBe('668px');
  });

  it('observes both the element and the document element', () => {
    setup();
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([el, document.documentElement]);
  });

  it('follows a window resize that changes the viewport height', () => {
    setup();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    window.dispatchEvent(new Event('resize'));
    frames();
    expect(el.style.height).toBe('400px');
  });

  it('follows a box change the resize observer reports', () => {
    setup();
    top = 150;
    observers[0].fire();
    frames();
    expect(el.style.height).toBe('618px');
  });

  it('follows a move that fires no event, through the slow fallback sample', () => {
    setup();
    top = 200;
    // Nothing resized and nothing scrolled: only the backstop can catch this.
    frames();
    expect(el.style.height).toBe('668px');
    vi.advanceTimersByTime(500);
    expect(el.style.height).toBe('568px');
  });

  it('stops the fallback while the document is hidden', () => {
    setup();
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden' as DocumentVisibilityState);
    document.dispatchEvent(new Event('visibilitychange'));
    top = 300;
    vi.advanceTimersByTime(5000);
    expect(el.style.height).toBe('668px');

    visibility.mockReturnValue('visible' as DocumentVisibilityState);
    document.dispatchEvent(new Event('visibilitychange'));
    frames();
    expect(el.style.height).toBe('468px');
    visibility.mockRestore();
  });

  it('restores the inline styles it found on destroy', () => {
    setup();
    expect(el.style.height).toBe('668px');
    fixture.destroy();
    expect(el.style.height).toBe('123px');
    expect(el.style.boxSizing).toBe('content-box');
    expect(el.style.getPropertyPriority('height')).toBe('');
  });

  it('leaves no frame, timer or listener behind on destroy', () => {
    setup();
    fixture.destroy();
    expect(observers[0].disconnected).toBe(true);

    // Put the element back in the document: a surviving loop would otherwise
    // be hidden by the `isConnected` guard rather than proven gone.
    document.body.append(el);
    reads = 0;
    top = 400;
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('transitionend'));
    observers[0].fire();
    frames();
    vi.advanceTimersByTime(5000);
    expect(reads).toBe(0);
    expect(el.style.height).toBe('123px');
  });
});
