import { h } from '../ui.js';
import { createDodge } from '../engines/dodge.js';

export default {
  id: 'bullet', num: '04', title: 'BULLET TIME',
  blurb: 'The firewall fell, and the sentinels noticed. Trace packets are inbound, and they are faster than you.',
  lesson: 'Time is just another variable. Hold bullet time to slow the simulation while you keep moving at full speed. Focus is limited, so spend it on the volleys.',
  mount(root, api) {
    const host = h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } });
    root.append(host);
    createDodge(host, {
      duration: 22, difficulty: 1, tutorial: true, rain: api.rain, sfx: api.sfx, signal: api.signal,
      onHit: () => api.threat(6, 'trace packet impact'),
      onDone: ({ hits }) => {
        api.sfx.win();
        const s = Math.max(20, 100 - hits * 14);
        const next = h('button', { class: 'btn', onclick: () => api.complete(s) }, '> CONTINUE');
        host.replaceChildren(h('div', { class: 'chapter center fade-in' }, h('div', { class: 'ending' },
          h('div', { class: 'stamp' }, 'TRACE EVADED'),
          h('h2', {}, hits === 0 ? 'UNTOUCHED.' : `${hits} IMPACT${hits > 1 ? 'S' : ''} ABSORBED.`),
          h('p', {}, 'You bent time and the system bent with it. Sentinels are now hunting by triangulation.'),
          h('div', { class: 'row', style: { justifyContent: 'center' } }, next,
            h('button', { class: 'btn ghost', onclick: () => api.restart() }, 'RETRY')))));
        next.focus();
      },
    });
  },
};
