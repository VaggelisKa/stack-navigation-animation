import type { ActivatedRoute, ActivatedRouteSnapshot, Data, ParamMap, Params, Route, UrlSegment } from '@angular/router';
import { BehaviorSubject, type Observable, switchMap } from 'rxjs';

/**
 * The `ActivatedRoute` a page component injects. A page that is kept alive
 * beneath the stack and later reached again is handed a *new* route object by
 * the router; this proxy keeps the component's subscriptions valid by
 * switching them to whatever route is current.
 */
export class StackNavActivatedRoute {
  private readonly current$: BehaviorSubject<ActivatedRoute>;

  readonly url: Observable<UrlSegment[]>;
  readonly params: Observable<Params>;
  readonly queryParams: Observable<Params>;
  readonly fragment: Observable<string | null>;
  readonly data: Observable<Data>;
  readonly title: Observable<string | undefined>;
  readonly paramMap: Observable<ParamMap>;
  readonly queryParamMap: Observable<ParamMap>;

  constructor(route: ActivatedRoute) {
    this.current$ = new BehaviorSubject(route);
    const of = <T>(pick: (r: ActivatedRoute) => Observable<T>) => this.current$.pipe(switchMap(pick));
    this.url = of((r) => r.url);
    this.params = of((r) => r.params);
    this.queryParams = of((r) => r.queryParams);
    this.fragment = of((r) => r.fragment);
    this.data = of((r) => r.data);
    this.title = of((r) => r.title);
    this.paramMap = of((r) => r.paramMap);
    this.queryParamMap = of((r) => r.queryParamMap);
  }

  /** The router's route object behind the proxy right now. */
  get actual(): ActivatedRoute {
    return this.current$.value;
  }
  /** @internal */
  swap(route: ActivatedRoute): void {
    if (route !== this.current$.value) this.current$.next(route);
  }

  get snapshot(): ActivatedRouteSnapshot {
    return this.actual.snapshot;
  }
  get outlet(): string {
    return this.actual.outlet;
  }
  get component(): ActivatedRoute['component'] {
    return this.actual.component;
  }
  get routeConfig(): Route | null {
    return this.actual.routeConfig;
  }
  get root(): ActivatedRoute {
    return this.actual.root;
  }
  get parent(): ActivatedRoute | null {
    return this.actual.parent;
  }
  get firstChild(): ActivatedRoute | null {
    return this.actual.firstChild;
  }
  get children(): ActivatedRoute[] {
    return this.actual.children;
  }
  get pathFromRoot(): ActivatedRoute[] {
    return this.actual.pathFromRoot;
  }
  toString(): string {
    return this.actual.toString();
  }
}
