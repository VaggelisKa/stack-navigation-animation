import { StackRoutes } from '@stacknav/react';
import { useMemo } from 'react';
import { api } from './demos/fake-api';
import { prefs } from './demos/shared';
import { useStore } from './demos/store';
import { routes } from './routes';

export function App() {
  const { slow, anywhere } = useStore(prefs);
  const busy = useStore(api.inflight) > 0;
  // The Lab's settings, applied to the engine through the outlet's props. Both
  // are plain JS options; `--sn-time-scale` on the container would do the same
  // for the first one from CSS.
  const transition = useMemo(() => ({ timeScale: slow ? 4 : 1 }), [slow]);
  const gesture = useMemo(() => ({ anywhere }), [anywhere]);

  return (
    <div className="phone">
      {/* A thin bar over the outlet: chrome that lives outside the stack and animates independently. */}
      <div className={busy ? 'progress on' : 'progress'} aria-hidden={!busy} />
      <StackRoutes className="outlet" transition={transition} gesture={gesture}>
        {routes}
      </StackRoutes>
    </div>
  );
}
