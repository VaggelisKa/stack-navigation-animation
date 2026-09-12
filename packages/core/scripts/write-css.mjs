// Emits dist/stacknav.css from the CSS string in src/styles.ts (the single source of truth),
// for apps that prefer a stylesheet over runtime injection. The string is minified so it
// costs consumers' JS bundles as little as possible; here it is expanded to be readable,
// with the tuning variables documented on top.
import { mkdir, writeFile } from 'node:fs/promises';
const { STACKNAV_CSS } = await import('../dist/styles.js');
const { IOS_TRANSITION_CSS_VARS } = await import('../dist/ios-transition.js');

const DOCS = {
  duration: ['500ms', 'push/pop length'],
  ease: ['cubic-bezier(0.32, 0.72, 0, 1)', 'its curve: a cubic-bezier, a keyword, or ios'],
  parallax: ['30%', 'how far the page beneath travels'],
  dimColor: ['#000', 'overlay on the page beneath'],
  dimMax: ['10%', 'its opacity at full open'],
  shadow: ['-3px 0 14px rgba(0,0,0,0.16)', 'on the incoming page; none to remove it'],
  settleMin: ['120ms', 'bounds for finishing a swipe'],
  settleMax: ['400ms', ''],
  settleEase: ['ios-settle', 'the curve a released swipe finishes on'],
  settleVelocityFloor: ['900', 'px/s assumed when the pointer was slower'],
  timeScale: ['1', 'multiplies every duration'],
};
const vars = Object.entries(IOS_TRANSITION_CSS_VARS).map(([option, name]) => {
  const [value, note] = DOCS[option];
  return `     ${`${name}: ${value};`.padEnd(45)}${note}`.trimEnd();
});
const header = ['/* Tune the iOS transition by setting these on .sn-container or any ancestor:', ...vars.slice(0, -1), vars.at(-1) + ' */'].join('\n');

/** Expands the minified source, including nested at-rules such as media queries. */
const formatCSS = (css) => {
  let depth = 0;
  let token = '';
  let out = '';
  const line = (value) => (out += `${'  '.repeat(depth)}${value}\n`);
  const declaration = (value) => {
    const i = value.indexOf(':');
    return i < 0 ? value : `${value.slice(0, i)}: ${value.slice(i + 1)}`;
  };
  for (const char of css) {
    if (char === '{') {
      line(`${token.trim()} {`);
      token = '';
      depth++;
    } else if (char === ';') {
      line(`${declaration(token.trim())};`);
      token = '';
    } else if (char === '}') {
      if (token.trim()) line(`${declaration(token.trim())};`);
      token = '';
      depth--;
      line('}');
    } else token += char;
  }
  return out.trimEnd();
};

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/stacknav.css', import.meta.url), `${header}\n${formatCSS(STACKNAV_CSS)}\n`);
console.log('wrote dist/stacknav.css');
