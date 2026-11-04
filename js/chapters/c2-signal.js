import { h, pick } from '../ui.js';
import { createRainHunt } from '../engines/rainhunt.js';
import { save } from '../state.js';

const KEYS = ['ORIGIN', 'KERNEL', 'SOURCE', 'VECTOR', 'CIPHER'];

export default {
  id: 'signal', num: '02', title: 'THE SIGNAL',
  blurb: 'The rain is not decoration. It is the system\'s raw data stream, and someone has hidden a key inside it.',
  lesson: 'Perception. Real anomalies glow steady white inside brackets; corrupted ones flicker red. Pull the key letter by letter and memorise it: you will need it to get out.',
  mount(root, api) {
    const word = pick(KEYS);
    api.state.flags.key = word; save();
    api.rain.setDensity(0.4);
    let decoys = 0, misses = 0;
    const status = h('span', { class: 'dim' }, 'Click the steady white glyphs. Avoid the flickering red ones.');
    root.append(
      h('div', { class: 'row', style: { marginBottom: '6px' } }, h('h2', { style: { margin: 0 } }, 'EXTRACT THE KEY'), h('span', { class: 'spacer' }), status),
    );
    const host = h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } });
    root.append(host);
    createRainHunt(host, {
      word, sfx: api.sfx, signal: api.signal,
      onLetter: (n) => { status.textContent = `${n}/${word.length} recovered`; },
      onDecoy: () => { decoys++; api.threat(5, 'corrupted packet touched'); },
      onMissClick: () => { misses++; if (misses % 6 === 0) api.threat(2, 'erratic probing'); },
      onDone: () => {
        api.sfx.win();
        const score = Math.max(30, 100 - decoys * 15 - Math.floor(misses / 3) * 5);
        host.replaceChildren(h('div', { class: 'win fade-in', style: { padding: '28px', textAlign: 'center', alignItems: 'center' } },
          h('div', { class: 'kicker' }, 'KEY RECOVERED'),
          h('div', { style: { fontFamily: 'var(--font-display)', fontSize: 'clamp(56px,10vw,110px)', letterSpacing: '.25em' } }, word),
          h('p', {}, 'Remember this word. The exit will ask for it, and it will not show you again.'),
          h('button', { class: 'btn', onclick: () => api.complete(score) }, '> PROCEED')));
        host.querySelector('button').focus();
      },
    });
  },
};
