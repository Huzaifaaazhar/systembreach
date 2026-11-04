import { h, win } from '../ui.js';
import { createReality } from '../engines/reality.js';

export default {
  id: 'reality', num: '06', title: 'REALITY MANIPULATION',
  blurb: 'Inside the service grid you find a sandbox where the simulation\'s physics are exposed as editable variables.',
  lesson: 'The simulation has rules, and rules can be broken. Rewrite gravity, dilate time, freeze matter and push it around. You will need every one of these at the exit.',
  mount(root, api) {
    const view = h('div', { style: { position: 'absolute', inset: 0 } });
    const logEl = h('div', { class: 'term-log' });
    const objs = [
      ['grav', 'Invert gravity'],
      ['time', 'Dilate time below 0.25×'],
      ['freeze', 'Freeze an object in mid-air (click it)'],
      ['impulse', 'Fire an impulse in zero gravity'],
    ];
    const done = new Set();
    const objList = h('ul', { class: 'objectives' }, objs.map(([k, t]) => h('li', { 'data-k': k }, t)));
    const cont = h('button', { class: 'btn', disabled: true, onclick: () => api.complete(100) }, '> CONTINUE');

    const tsVal = h('span', {}, '1.00×');
    const gVal = h('span', {}, '9.8');
    const ts = h('input', { type: 'range', min: 0.05, max: 2, step: 0.05, value: 1, 'aria-label': 'Time dilation' });
    const gs = h('input', { type: 'range', min: 0, max: 20, step: 0.5, value: 9.8, 'aria-label': 'Gravity strength' });
    let dir = [0, -1, 0];
    const dirs = [['↑ UP', [0, 1, 0]], ['∅ ZERO', [0, 0, 0]], ['↓ DOWN', [0, -1, 0]], ['← LEFT', [-1, 0, 0]], ['→ RIGHT', [1, 0, 0]], ['⇥ DEEP', [0, 0, -1]]];
    const gBtns = dirs.map(([l, v]) => h('button', { class: `btn ${l.includes('DOWN') ? 'on' : ''}`, onclick: (e) => setDir(v, e.currentTarget, l) }, l));
    const freezeBtn = h('button', { class: 'btn small', onclick: toggleFreeze }, '❄ FREEZE ALL');

    root.append(
      h('div', { class: 'reality' },
        h('div', { style: { display: 'grid', gap: '12px', alignContent: 'start' } },
          win('SYS_LOG', logEl),
          win('RULES', h('div', { class: 'ctrl' },
            h('div', {}, h('label', {}, 'GRAVITY_VECTOR', h('span', {})), h('div', { class: 'gv' }, gBtns)),
            h('div', {}, h('label', {}, 'GRAVITY_STRENGTH', gVal), gs),
            h('div', {}, h('label', {}, 'TIME_DILATION', tsVal), ts),
            h('div', { class: 'row' }, freezeBtn,
              h('button', { class: 'btn small', onclick: impulse }, '✸ IMPULSE'),
              h('button', { class: 'btn small ghost', onclick: spawn }, '+ OBJECT'))))),
        h('div', { style: { display: 'grid', gap: '12px', gridTemplateRows: 'minmax(360px,1fr) auto' } },
          win('SANDBOX // DRAG TO LOOK · CLICK AN OBJECT TO FREEZE IT', view, { cls: 'play-win' }),
          h('div', { class: 'win' }, h('div', { class: 'win-body row' }, h('div', {}, h('div', { class: 'kicker' }, 'OBJECTIVES'), objList), h('span', { class: 'spacer' }), cont)))),
    );
    view.parentElement.style.position = 'relative';
    view.parentElement.style.minHeight = '360px';

    const log = (t) => {
      logEl.prepend(h('div', {}, `> ${t}`));
      while (logEl.children.length > 14) logEl.lastChild.remove();
    };
    ['SANDBOX MOUNTED', 'PHYSICS: EXPOSED', 'GRAVITY_VECTOR: NOMINAL', 'TIME_DILATION: 1.00'].forEach(log);

    const R = createReality(view, {
      signal: api.signal,
      onFreezeToggle: (b) => {
        log(b.frozen ? 'OBJECT_STATE: FROZEN' : 'OBJECT_STATE: RELEASED');
        api.sfx.tick();
        if (b.frozen && b.mesh.position.y > -R.HALF + b.r + 0.8) mark('freeze');
      },
    });
    ['box', 'ico', 'oct', 'dodeca', 'tetra', 'box'].forEach((t) => R.addBody(t));

    function mark(k) {
      if (done.has(k)) return;
      done.add(k);
      objList.querySelector(`[data-k=${k}]`).classList.add('done');
      api.sfx.ok();
      api.toast(`RULE BROKEN: ${objs.find((o) => o[0] === k)[1].toUpperCase()}`);
      if (done.size === objs.length) { cont.disabled = false; log('SYSTEM_OVERRIDE: COMPLETE'); api.sfx.win(); }
    }
    function applyG() {
      const s = Number(gs.value);
      R.setGravity(dir[0] * s, dir[1] * s, dir[2] * s);
      gVal.textContent = s.toFixed(1);
      if (dir[1] > 0 && s > 0) mark('grav');
    }
    function setDir(v, btn, label) {
      dir = v; gBtns.forEach((b) => b.classList.toggle('on', b === btn));
      applyG(); api.sfx.tick();
      log(`GRAVITY_VECTOR: ${label.split(' ')[1] === 'DOWN' ? 'NOMINAL' : 'ALTERED'} [${v.join(',')}]`);
    }
    gs.addEventListener('input', () => { applyG(); });
    gs.addEventListener('change', () => log(`GRAVITY_STRENGTH: ${Number(gs.value).toFixed(1)}`));
    ts.addEventListener('input', () => {
      const v = Number(ts.value);
      R.setTimeScale(v); api.rain.setSpeed(v);
      tsVal.textContent = `${v.toFixed(2)}×`;
      if (v < 0.25) mark('time');
    });
    ts.addEventListener('change', () => { const v = Number(ts.value); log(v === 1 ? 'TIME_DILATION: NOMINAL' : `TIME_DILATION: ACTIVE ${v.toFixed(2)}×`); if (v < 0.5) api.sfx.slow(); });
    let frozenAll = false;
    function toggleFreeze() {
      frozenAll = !frozenAll; R.setFreeze(frozenAll);
      freezeBtn.classList.toggle('on', frozenAll);
      api.rain.setSpeed(frozenAll ? 0.02 : Number(ts.value));
      log(frozenAll ? 'TIME: HALTED' : 'TIME: RESUMED');
      frozenAll ? api.sfx.slow() : api.sfx.fast();
    }
    function impulse() {
      R.impulse(9); log('MOTION_VECTOR: OVERRIDDEN'); api.sfx.glitch();
      if (R.S.g.lengthSq() === 0 || Number(gs.value) === 0) mark('impulse');
    }
    function spawn() {
      if (R.bodies.length >= 12) return api.toast('OBJECT LIMIT REACHED');
      R.addBody(['box', 'ico', 'oct', 'dodeca', 'tetra'][(Math.random() * 5) | 0], { pos: new R.THREE.Vector3(0, 3, 0) });
      log('OBJECT: INSTANTIATED'); api.sfx.tick();
    }
  },
};
