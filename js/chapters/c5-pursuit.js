import { h, win, pick } from '../ui.js';
import { createCity } from '../engines/city.js';
import { save } from '../state.js';

// Each decision is solvable from the intel that scrolls through the sentinel log.
const DECISIONS = [
  {
    q: 'Sentinels converge on your block. Pick an exit.',
    a: { t: 'NORTH ROOFTOPS', s: 'fast, exposed' },
    b: { t: 'SUBWAY ACCESS', s: 'slow, underground' },
    right: 'b',
    intel: ['SWEEP PATTERN: SECTOR 4 // NORTH', 'AERIAL UNITS DEPLOYED: ROOFLINE'],
    why: { a: 'Aerial units were already sweeping the roofline.', b: 'Underground, the aerial sweep lost line of sight.' },
    move: [3, 3],
  },
  {
    q: 'A sentinel relay is in range. How do you pass it?',
    a: { t: 'SPOOF A SENTINEL ID', s: 'walk straight through' },
    b: { t: 'GO DARK FOR 30s', s: 'cut your own signal' },
    right: 'b',
    intel: ['HANDSHAKE PROTOCOL ROTATED 00:03:07', 'LEGACY IDS FLAGGED AS HOSTILE'],
    why: { a: 'The handshake had rotated. Your spoofed ID was stale.', b: 'With no signal there was nothing to triangulate.' },
    move: [-2, 5],
  },
  {
    q: 'You need cover to reach the old service grid.',
    a: { t: 'BLIND DISTRICT CAMERAS', s: 'reroute the power grid' },
    b: { t: 'HIDE IN THE STADIUM CROWD', s: 'blend into signal noise' },
    right: 'a',
    intel: ['STADIUM EVENT CANCELLED // CROWD DENSITY 0', 'DISTRICT GRID: MANUAL OVERRIDE AVAILABLE'],
    why: { a: 'Without cameras the sentinels lost their eyes.', b: 'The stadium was empty. You were the only signal in it.' },
    move: [-6, 2],
  },
];

export default {
  id: 'pursuit', num: '05', title: 'PURSUIT',
  blurb: 'Sentinels are triangulating your position across the city. Every decision you make is visible to them.',
  lesson: 'Reading intel under pressure. The sentinel activity log leaks their own plans; the right call is always in there. Wrong decisions and hesitation both raise the threat level.',
  mount(root, api) {
    const cityHost = h('div', { style: { position: 'absolute', inset: 0 } });
    const pct = h('div', { class: 'big-pct' }, `${Math.round(api.state.threat)}%`);
    const log = h('div', { class: 'log', 'aria-live': 'off' });
    const bars = h('div', { class: 'bars' }, Array.from({ length: 9 }, () => h('i', { style: { height: '10%' } })));
    const qEl = h('h3', {});
    const opts = h('div', { class: 'options' });
    const timer = h('i');
    const decisionWin = h('div', { class: 'win', style: { marginTop: '14px' } });
    const res = h('p', { class: 'stat', style: { minHeight: '1.3em', margin: 0 } });

    root.append(
      h('div', { class: 'dash' },
        win('SENTINEL ACTIVITY', cityHost, { cls: 'city' }),
        h('div', { class: 'side' },
          win('SYSTEM ALERT STATUS', h('div', {}, pct, h('div', { style: { marginTop: '10px' } }, h('div', { class: 'kicker', style: { textAlign: 'center' } }, 'THREAT LEVEL'), bars))),
          win('SENTINEL ACTIVITY // LOG', log))),
      decisionWin,
    );
    decisionWin.append(
      h('div', { class: 'win-title' }, h('span', {}, 'DECISION'), h('span', { class: 'ctl' }, '_□×')),
      h('div', { class: 'win-body', style: { display: 'grid', gap: '10px' } },
        qEl, h('div', { class: 'row' }, h('span', { class: 'dim', style: { fontSize: '13px' } }, 'TIME'), h('div', { class: 'meter' }, timer)),
        opts, res));

    const city = createCity(cityHost, { signal: api.signal });
    city.heatNear(-4, -3, 3, 2); city.heatNear(5, 4, 2, 1);

    // log ticker
    let clock = 0, step = 0, wrong = 0, slow = 0, tLeft = 1, locked = false;
    const ambient = ['TRACE INITIATED', 'COORDINATES ACQUIRED', 'SWEEP: SECTOR 2', 'SWEEP: SECTOR 7', 'SIGNAL LOST', 'RELAY 12 ONLINE', 'COORDINATES ACQUIRED'];
    let intelQ = [];
    const ts = () => { const m = Math.floor(clock / 60), s = clock % 60; return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
    function logLine(txt, cls = '') {
      log.prepend(h('div', { class: cls }, `${ts()} - ${txt}`));
      while (log.children.length > 11) log.lastChild.remove();
    }
    const tick = setInterval(() => {
      clock += 3 + Math.floor(Math.random() * 14);
      if (intelQ.length && Math.random() < 0.6) logLine(`!! ${intelQ.shift()}`, 'amber');
      else logLine(pick(ambient));
      const t = api.state.threat;
      pct.textContent = `${Math.round(t)}%`;
      pct.classList.toggle('red', t >= 75);
      [...bars.children].forEach((b, i) => { b.style.height = `${Math.min(100, 12 + (i / 8) * (25 + t * 0.6) + Math.random() * 18)}%`; });
    }, 900);
    for (let i = 0; i < 6; i++) { clock += 5; logLine(pick(ambient)); }

    const loop = setInterval(() => {
      if (locked) return;
      tLeft -= 0.1 / 20;
      timer.style.width = `${Math.max(0, tLeft) * 100}%`;
      if (tLeft <= 0) { slow++; api.threat(6, 'hesitation: sentinels closing'); city.heatNear(0, 0, 4); tLeft = 1; }
    }, 100);

    function ask() {
      const d = DECISIONS[step];
      qEl.textContent = `${step + 1}/3 // ${d.q}`;
      intelQ = [...d.intel, ...d.intel];
      logLine(`!! ${d.intel[0]}`, 'amber');
      res.textContent = '';
      tLeft = 1; locked = false;
      opts.replaceChildren(...['a', 'b'].map((k) => h('button', { class: 'opt', onclick: () => choose(k) },
        `> OPTION ${k.toUpperCase()}:`, h('br'), d[k].t, h('small', {}, `(${d[k].s})`))));
    }

    function choose(k) {
      if (locked) return;
      locked = true;
      const d = DECISIONS[step];
      api.state.flags[`pursuit${step}`] = k; save();
      [...opts.children].forEach((b) => { b.disabled = true; });
      if (k === d.right) {
        api.sfx.ok(); api.threat(-3, 'sentinels lost contact');
        res.className = 'stat'; res.textContent = `✓ ${d.why[k]}`;
        logLine('SIGNAL LOST');
      } else {
        wrong++; api.threat(12, 'wrong call');
        res.className = 'stat red'; res.textContent = `✗ ${d.why[k]}`;
        logLine('COORDINATES ACQUIRED', 'red');
        city.heatNear(d.move[0], d.move[1], 2, 2);
      }
      city.moveMe(d.move[0], d.move[1]);
      step++;
      const nxt = h('button', { class: 'btn small', onclick: () => (step < DECISIONS.length ? ask() : finish()) }, step < DECISIONS.length ? '> NEXT' : '> REACH THE SERVICE GRID');
      res.append(' ', nxt); nxt.focus();
    }

    function finish() {
      const s = Math.max(20, 100 - wrong * 25 - slow * 8);
      api.state.flags.pursuitWrong = wrong; save();
      api.sfx.win();
      api.complete(s);
    }

    ask();
    return () => { clearInterval(tick); clearInterval(loop); };
  },
};
