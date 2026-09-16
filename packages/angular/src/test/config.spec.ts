import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, RouteReuseStrategy, provideRouter } from '@angular/router';
import { always, createDirectionResolver, isTouchPrimary } from '@stacknav/core';
import { describe, expect, it } from 'vitest';
import { defaultKeyOf, defaultLevelOf, provideStackNav, resolveConfig, STACKNAV_CONFIG } from '../lib/config';
import { StackNavRouteReuseStrategy } from '../lib/route-reuse-strategy';

@Component({ template: '' })
class Blank {}

describe('resolveConfig', () => {
  it('fills in every default an app may leave out', () => {
    const c = resolveConfig({});
    // These four are the defaults the README documents; changing one is a
    // breaking change for every app that never mentions them.
    expect(c.infoKey).toBe('stacknav');
    expect(c.swipeBack).toBe('browser');
    expect(c.injectStyles).toBe(true);
    expect(c.manageFocus).toBe(false);
    expect(c.transition).toEqual({});
    expect(c.levelOf).toBe(defaultLevelOf);
    expect(c.keyOf).toBe(defaultKeyOf);
    expect(c.animated()).toBe(true);
    expect(typeof c.resolve).toBe('function');
  });

  it('keeps the options the app did give', () => {
    const keyOf = () => 'k';
    const resolveDirection = createDirectionResolver([always('pop')], 'pop');
    const c = resolveConfig({ infoKey: 'sn', swipeBack: 'disabled', injectStyles: false, manageFocus: true, keyOf, resolveDirection, transition: { duration: 10 } });
    expect(c.infoKey).toBe('sn');
    expect(c.swipeBack).toBe('disabled');
    expect(c.injectStyles).toBe(false);
    expect(c.manageFocus).toBe(true);
    expect(c.keyOf).toBe(keyOf);
    expect(c.transition).toEqual({ duration: 10 });
    // `resolveDirection` replaces the mechanism outright, strategies and all.
    expect(c.resolve).toBe(resolveDirection);
  });

  it('refuses the old `direction` spellings rather than silently demoting them', () => {
    // `direction` used to take the whole resolver. Accepting a list here would
    // now mean asking it fourth, which changes an app's behaviour in silence.
    expect(() => resolveConfig({ direction: [] as never })).toThrow(TypeError);
    expect(() => resolveConfig({ direction: { strategies: [] } as never })).toThrow(/resolveDirection/);
    // One rule of your own is still exactly what `direction` takes.
    expect(() => resolveConfig({ direction: () => 'push' })).not.toThrow();
  });

  it('wires `animated: "touch"` to the core\'s own pointer test, and a function straight through', () => {
    expect(resolveConfig({ animated: 'touch' }).animated).toBe(isTouchPrimary);
    let on = false;
    const animated = resolveConfig({ animated: () => on }).animated;
    // Asked again before every navigation, so the app can change its mind.
    expect(animated()).toBe(false);
    on = true;
    expect(animated()).toBe(true);
    expect(resolveConfig({ animated: false }).animated()).toBe(false);
  });

  it('reads the route number only when it is a number', () => {
    expect(defaultLevelOf({ data: { stackLevel: 2 } } as never)).toBe(2);
    expect(defaultLevelOf({ data: { stackLevel: '2' } } as never)).toBeUndefined();
    expect(defaultLevelOf({ data: {} } as never)).toBeUndefined();
  });
});

describe('defaultKeyOf', () => {
  it('is the path from the root down to the route, matrix params included', async () => {
    // Matrix params are part of what identifies a page: `/items/42;view=full`
    // and `/items/42;view=map` are two pages, not one.
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'items/:id', component: Blank }]), provideLocationMocks()],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/items/42;view=full');
    const snapshot = router.routerState.snapshot.root.firstChild!;
    expect(defaultKeyOf(snapshot)).toBe('items/42;view=full');
  });
});

describe('provideStackNav', () => {
  it('installs the resolved config and the route reuse strategy', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks(), provideStackNav({ infoKey: 'sn' })] });
    expect(TestBed.inject(STACKNAV_CONFIG).infoKey).toBe('sn');
    // Without the strategy the router destroys every page it leaves, so
    // nothing could animate out: installing it is not optional by accident.
    expect(TestBed.inject(RouteReuseStrategy)).toBeInstanceOf(StackNavRouteReuseStrategy);
  });

  it('leaves the router\'s own strategy alone when asked to', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks(), provideStackNav({ routeReuse: false })] });
    expect(TestBed.inject(RouteReuseStrategy)).not.toBeInstanceOf(StackNavRouteReuseStrategy);
  });

  it('is what STACKNAV_CONFIG falls back to when an app never calls it', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideLocationMocks()] });
    expect(TestBed.inject(STACKNAV_CONFIG).infoKey).toBe('stacknav');
  });
});
