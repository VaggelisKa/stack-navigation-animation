import { createIOSStack, attachBrowserHistory } from '@stacknav/core';

const container = document.getElementById('app');
const nav = createIOSStack({ container });

// Let pages clean up (timers, subscriptions) when they leave the stack.
nav.on('pop', ({ removed }) => removed.forEach((e) => e.el.dispatchEvent(new Event('sn:destroyed'))));

const prefs = { anywhere: false, slow: false };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('stacknav-demo') || '{}'));
} catch (e) {
  /* storage may be unavailable */
}
function applyPrefs() {
  nav.gesture.options.anywhere = prefs.anywhere;
  nav.gesture.refresh();
  nav.transition.options.timeScale = prefs.slow ? 4 : 1;
  try {
    localStorage.setItem('stacknav-demo', JSON.stringify(prefs));
  } catch (e) {
    /* ignore */
  }
}

const TOPICS = [
  ['Push', 'The incoming page slides in from the trailing edge over 500 ms on cubic-bezier(0.32, 0.72, 0, 1). The page beneath slides 30 % of the width toward the leading edge and dims to 10 % black. A soft shadow rides the incoming page\'s leading edge so the two read as stacked.'],
  ['Who animates', 'Not this script. The engine writes where each page should end up and puts the duration and the curve in --sn-t and --sn-e on the container; the frames in between belong to CSS, and to the compositor. A whole 500 ms push costs about a dozen style writes, so a busy main thread cannot stutter it. The travel is a percentage of the page, so nothing measures layout and a mid-transition resize stays honest.'],
  ['The look is a stylesheet', 'How far the lower page travels (--sn-parallax), how dark it goes (--sn-dim, --sn-dim-color), the shadow (--sn-shadow), the edge strip (--sn-edge-width) and which way forward is (--sn-dir, flipped under :dir(rtl)) are all custom properties. Retheme the transition in a stylesheet without touching a line of JavaScript, and prefers-reduced-motion overrules the engine from the same place.'],
  ['Pop', 'The exact reverse. Because both movements are expressed as one number, p, how much of the upper page is showing, pop is push run backwards and nothing is duplicated.'],
  ['Interactive pop', 'A drag from the leading edge sets p directly from the finger: p = 1 − dx / width. While the finger is down --sn-t is 0s, so nothing is animated; the page is simply where the finger says it is.'],
  ['Release', 'Past half the width, or a flick faster than 500 px/s toward the trailing edge, completes. A flick back faster than 500 px/s cancels. Otherwise it snaps back. The remaining distance runs an ease-out whose duration comes from distance ÷ velocity, clamped to 120–400 ms, so a fast flick finishes fast and a slow release finishes slow. That number is handed to CSS and the browser runs it out.'],
  ['Scroll', 'Pages beneath the top stay in the DOM, hidden. The transition writes only transform, so a page\'s scroll offset, form state and focus are untouched when you come back to it. No restoration logic exists because none is needed.'],
  ['Your chrome', 'A fixed header or a tab bar can read --sn-t and --sn-e and the sn-page-upper / sn-page-lower classes and move in lockstep with the pages, on the compositor, from CSS alone. For chrome that needs the number, the stack still emits progress events with (lower, upper, p) and only runs a frame loop while something is listening.'],
  ['History', 'An optional adapter mirrors depth into history.state, so the browser or hardware back button pops with the same animation. On iOS browsers the pop is instant, because Safari already animated its own snapshot.'],
];
const FILLER = Array.from({ length: 40 }, (_, i) => `Row ${i + 1}`);

function page({ title, back = null, body }) {
  const el = document.createElement('section');
  el.className = 'page';
  el.innerHTML = `
    <header class="hdr">
      ${back ? '<button type="button" class="back" aria-label="Back">←</button>' : '<span class="back-space"></span>'}
      <h1>${title}</h1>
    </header>
    <div class="body"></div>`;
  el.querySelector('.back')?.addEventListener('click', () => nav.pop());
  body(el.querySelector('.body'));
  return el;
}

const link = (label, onClick, note = '') => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'item';
  b.innerHTML = `<span>${label}</span>${note ? `<small>${note}</small>` : ''}<i>›</i>`;
  b.addEventListener('click', onClick);
  return b;
};

const toggle = (label, on, onChange) => {
  const l = document.createElement('label');
  l.className = 'item';
  l.innerHTML = `<span>${label}</span><input type="checkbox" ${on ? 'checked' : ''}>`;
  l.querySelector('input').addEventListener('change', (e) => onChange(e.target.checked));
  return l;
};

const homePage = () =>
  page({
    title: 'stacknav',
    body: (b) => {
      b.append(h('p', 'lede', 'A drop-in iOS push/pop transition for any web app. Pages, headers and styling are the app\'s own; the engine only moves them.'));
      b.append(h('h2', null, 'How it works'));
      TOPICS.forEach(([t], i) => b.append(link(t, () => nav.push(topicPage(i)))));
      b.append(h('h2', null, 'Try'));
      b.append(link('Options', () => nav.push(optionsPage()), 'gesture zone, slow motion'));
      b.append(link('Deep stack', () => nav.push(depthPage(2)), 'push, push, push, then swipe back'));
      b.append(h('h2', null, 'Scroll down, go in, come back'));
      FILLER.forEach((r, i) => b.append(link(r, () => nav.push(topicPage(i % TOPICS.length)))));
    },
  });

const topicPage = (i) =>
  page({
    title: TOPICS[i][0],
    back: true,
    body: (b) => {
      b.append(h('p', 'lede', TOPICS[i][1]));
      TOPICS.forEach(([t, text], j) => {
        if (j !== i) {
          b.append(h('h2', null, t));
          b.append(h('p', null, text));
        }
      });
      b.append(link('Next topic', () => nav.push(topicPage((i + 1) % TOPICS.length))));
    },
  });

const depthPage = (n) =>
  page({
    title: `Level ${n}`,
    back: true,
    body: (b) => {
      b.append(h('p', 'lede', `This is level ${n} of the stack. Each level keeps its own scroll offset while it sits underneath.`));
      b.append(link(`Push level ${n + 1}`, () => nav.push(depthPage(n + 1))));
      b.append(link('Pop to home', () => nav.popTo(1)));
      FILLER.slice(0, 30).forEach((r) => b.append(h('p', 'row', r)));
    },
  });

const optionsPage = () =>
  page({
    title: 'Options',
    back: true,
    body: (b) => {
      b.append(
        toggle('Swipe back from anywhere', prefs.anywhere, (v) => {
          prefs.anywhere = v;
          applyPrefs();
        }),
      );
      b.append(h('p', 'note', 'The engine recognizes the gesture from a 28 px leading-edge strip, as iOS does. Mobile browsers often claim that edge for their own back gesture; turn this on to test the interactive pop from anywhere on the page.'));
      b.append(
        toggle('Slow motion (×4)', prefs.slow, (v) => {
          prefs.slow = v;
          applyPrefs();
        }),
      );
      b.append(h('p', 'note', 'Multiplies every duration the engine hands to CSS, so the parallax, dim and settle curve are easy to watch.'));
    },
  });

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.textContent = text;
  return n;
}

applyPrefs();
nav.push(homePage(), { animated: false }).then(() => attachBrowserHistory(nav));
window.nav = nav;
