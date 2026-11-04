import { h, win, sleep } from '../ui.js';
import { createTerminal } from '../terminal.js';
import { createRainHunt } from '../engines/rainhunt.js';
import { createDodge } from '../engines/dodge.js';
import { createReality } from '../engines/reality.js';
import { createTunnel } from '../engines/tunnel.js';
import { avgScore, save } from '../state.js';

const ENDINGS = {
  recaptured: {
    stamp: 'TRACE COMPLETE', cls: 'red', title: 'RECAPTURED',
    text: 'The sentinels close the loop. Your memory is wiped and the boot sequence starts again, exactly as before. Somewhere in the rain, a key is already waiting for you.',
  },
  ghost: {
    stamp: 'PARTIAL EXIT', cls: 'amber', title: 'GHOST SIGNAL',
    text: 'You made it through, but not cleanly. Part of your signal is still inside, echoing through relays. The system cannot catch it, and you cannot fully leave.',
  },
  liberated: {
    stamp: 'DISCONNECTED', cls: '', title: 'LIBERATED',
    text: 'The exit gate closes behind you. For the first time the world outside does not flicker. You are out, and the sentinels never saw which way you went.',
  },
  root: {
    stamp: 'ROOT ACCESS', cls: '', title: 'THE RULES ARE YOURS',
    text: 'You leave so quietly that the system never registers the breach. From the outside you can see its source and every rule it runs on. You could leave it like this, or you could rewrite it.',
  },
};

export default {
  id: 'escape', num: '07', title: 'FINAL ESCAPE',
  blurb: 'One exit node. Four locks. Everything you have learned, under full sentinel pressure.',
  lesson: 'Combining it all: recall the key from the rain, read the intel and pick a route, survive in bullet time, then rewrite physics to carry the key through the gate. Your threat level and performance decide the ending.',
  mount(root, api) {
    const phaseEl = h('div', { class: 'kicker' });
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } });
    root.append(phaseEl, body);
    const perf = { keyTries: 0, rescan: false, hits: 0, gateTime: 0, route: null };
    let ended = false;

    api.onMaxThreat = () => end('recaptured');

    // each phase gets its own abort signal so engines from a previous phase stop cleanly
    let pa = null;
    api.signal.addEventListener('abort', () => pa?.abort());
    let sig = null;
    const phase = (n, name) => {
      pa?.abort(); pa = new AbortController(); sig = pa.signal;
      phaseEl.textContent = `PHASE ${n}/4 // ${name}`; body.replaceChildren(); api.glitch();
    };

    /* ── 1. KEY ── */
    function phaseKey() {
      phase(1, 'AUTHENTICATE');
      const t = createTerminal({ signal: sig });
      body.append(win('EXIT_NODE // 0x0000', t.el));
      const key = api.state.flags.key || 'ORIGIN';
      t.onCommand(async (v) => {
        if (v === 'RESCAN') {
          perf.rescan = true; t.lock();
          api.threat(6, 'rescan is loud');
          const host = h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: '360px', marginTop: '12px' } });
          body.append(host);
          createRainHunt(host, {
            word: key, sfx: api.sfx, signal: sig,
            onDecoy: () => api.threat(5, 'corrupted packet'),
            onDone: () => { host.remove(); t.print('KEY RE-EXTRACTED. ENTER IT.'); t.ready('KEY>'); },
          });
          return;
        }
        perf.keyTries++;
        if (v === key) {
          t.lock(); api.sfx.win();
          if (perf.keyTries === 1 && !perf.rescan) api.threat(-5, 'clean authentication');
          await t.type('KEY ACCEPTED. LOCK 1/4 OPEN.', 'sys');
          await sleep(700);
          phaseRoute();
        } else {
          api.threat(6, 'invalid key');
          t.print(`KEY REJECTED (${perf.keyTries})`, 'err');
          t.setChips(['RESCAN']);
          t.print('TYPE RESCAN TO PULL IT FROM THE RAIN AGAIN (+6% threat).', 'out');
        }
      });
      (async () => {
        await t.type('EXIT NODE LOCATED.', 'sys');
        await t.type('ENTER THE KEY YOU PULLED FROM THE RAIN.', 'sys');
        t.ready('KEY>');
      })();
    }

    /* ── 2. ROUTE ── */
    function phaseRoute() {
      phase(2, 'CHOOSE A ROUTE');
      const cv = h('canvas', { class: 'bg' });
      const scene = h('div', { class: 'choice-scene', style: { flex: 1 } }, cv);
      createTunnel(cv, { signal: sig });
      const pick = (r) => {
        perf.route = r; api.state.flags.route = r; save();
        if (r === 'A') api.threat(10, 'downtown sentinel density');
        else api.sfx.ok();
        phaseDodge();
      };
      scene.append(
        h('div', { class: 'options' },
          h('button', { class: 'opt', onclick: () => pick('A') }, '> OPTION A:', h('br'), 'THE DOWNTOWN LOOP', h('small', {}, '(Extract Alpha · fast, heavy contact)')),
          h('button', { class: 'opt', onclick: () => pick('B') }, '> OPTION B:', h('br'), 'SERVICE TUNNEL 7', h('small', {}, '(Stealth Exit · longer, quiet)'))),
        h('div', { style: { textAlign: 'center' } },
          h('div', { class: 'stat' }, 'SYSTEM ALERT: SENTINEL PROXIMITY CRITICAL'),
          h('div', { class: 'dim' }, `Current threat ${Math.round(api.state.threat)}%. The loop is short but exposed (+10%). The tunnel is quiet but the run lasts longer.`)));
      body.append(scene);
      scene.querySelector('.opt').focus();
    }

    /* ── 3. DODGE ── */
    function phaseDodge() {
      phase(3, perf.route === 'A' ? 'THE DOWNTOWN LOOP' : 'SERVICE TUNNEL 7');
      createDodge(body, {
        duration: perf.route === 'A' ? 14 : 20,
        difficulty: perf.route === 'A' ? 1.6 : 1.15,
        tutorial: false, theme: perf.route === 'A' ? 'grid' : 'tunnel',
        title: perf.route === 'A' ? 'RUN THE LOOP' : 'CLEAR THE TUNNEL',
        rain: api.rain, sfx: api.sfx, signal: sig,
        onHit: (n) => { perf.hits = n; api.threat(5, 'impact'); },
        onDone: ({ hits }) => { perf.hits = hits; if (!ended) phaseGate(); },
      });
    }

    /* ── 4. GATE ── */
    function phaseGate() {
      phase(4, 'THE EXIT GATE');
      const view = h('div', { style: { position: 'absolute', inset: 0 } });
      const status = h('p', { class: 'stat', style: { margin: 0 } }, 'The key must reach the gate in the ceiling. A sentinel guards it.');
      const timeEl = h('span', { class: 'stat' }, '30.0s');
      let dir = -1; let ts = 1;
      const gb = (label, d) => h('button', { class: `btn small ${d === -1 ? 'on' : ''}`, 'data-d': d, onclick: (e) => {
        dir = d; R.setGravity(0, d * 9.8, 0); api.sfx.tick();
        e.currentTarget.parentElement.querySelectorAll('button[data-d]').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
      } }, label);
      const tsIn = h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: 1, 'aria-label': 'Time dilation', style: { maxWidth: '180px' } });
      const tsLbl = h('span', { class: 'dim' }, 'TIME 1.00×');
      tsIn.addEventListener('input', () => { ts = Number(tsIn.value); R.setTimeScale(ts); api.rain.setSpeed(ts); tsLbl.textContent = `TIME ${ts.toFixed(2)}×`; });
      const panel = h('div', { class: 'win', style: { flex: 1, minHeight: '380px' } },
        h('div', { class: 'win-title' }, h('span', {}, 'EXIT GATE // CLICK THE SENTINEL TO FREEZE IT'), timeEl),
        h('div', { class: 'win-body', style: { position: 'relative', minHeight: '340px' } }, view));
      body.append(
        h('div', { class: 'row', style: { marginBottom: '10px' } },
          h('span', { class: 'dim', style: { fontSize: '13px' } }, 'GRAVITY'), gb('↓ DOWN', -1), gb('∅ ZERO', 0), gb('↑ UP', 1),
          h('span', { style: { width: '12px' } }), tsLbl, tsIn),
        panel, h('div', { style: { marginTop: '8px' } }, status));

      let left = 30, penalT = 0, won = false, deflectCd = 0;
      const R = createReality(view, {
        signal: sig,
        onFreezeToggle: (b) => {
          if (b.name === 'sentinel') { status.textContent = b.frozen ? 'SENTINEL FROZEN. Now rewrite gravity.' : 'Sentinel released!'; api.sfx.ok(); }
        },
        onStep: (dt, rdt) => {
          if (won || ended) return;
          left -= rdt; perf.gateTime += rdt;
          timeEl.textContent = left > 0 ? `${left.toFixed(1)}s` : 'OVERTIME';
          if (left < 0) { penalT += rdt; if (penalT > 2) { penalT = 0; api.threat(3, 'gate overtime'); } }
          // sentinel orbits the gate
          if (!sent.frozen) {
            ang += dt * 2.6;
            sent.mesh.position.set(Math.cos(ang) * 0.8, R.HALF - 1.7 + Math.sin(ang * 2) * 0.35, Math.sin(ang) * 0.8);
            sent.mesh.rotation.y += dt * 4;
          }
          const kp = keyB.mesh.position;
          deflectCd = Math.max(0, deflectCd - rdt);
          if (!sent.frozen && deflectCd === 0 && kp.distanceTo(sent.mesh.position) < 1.5) {
            deflectCd = 1.2;
            keyB.vel.set(0, -14, 0); kp.y -= 0.8;
            api.threat(8, 'sentinel deflected the key');
            status.textContent = 'Deflected! Freeze the sentinel first (click it). Slowing time helps.';
          }
          if (kp.y > R.HALF - keyB.r - 0.35 && Math.hypot(kp.x, kp.z) < 1.4) {
            won = true; api.sfx.win(); status.textContent = 'KEY IN THE GATE. EXITING...';
            setTimeout(decide, 1200);
          }
        },
      });
      R.setGravity(0, -9.8, 0);
      const ring = new R.THREE.Mesh(new R.THREE.TorusGeometry(1.4, 0.07, 8, 40), new R.THREE.MeshBasicMaterial({ color: 0xffffff }));
      ring.rotation.x = Math.PI / 2; ring.position.y = R.HALF - 0.05; R.scene.add(ring);
      const keyB = R.addBody('box', { pos: new R.THREE.Vector3(0, -R.HALF + 1, 0), color: 0xc8ffd5, r: 0.75, name: 'key' });
      keyB.vel.set(0, 0, 0); keyB.ang.set(0.3, 0.6, 0);
      const sent = R.addBody('oct', { pos: new R.THREE.Vector3(0.8, R.HALF - 1.7, 0), color: 0xff4545, r: 0.9, static: true, name: 'sentinel' });
      sent.clickable = true;
      let ang = 0;
      ['tetra', 'ico'].forEach((t, i) => R.addBody(t, { pos: new R.THREE.Vector3(i ? 3 : -3, -3, -2), color: 0x4fdc72 }));
    }

    /* ── endings ── */
    function decide() {
      const t = api.state.threat;
      const s = Math.max(10, 100 - perf.hits * 10 - (perf.keyTries - 1) * 10 - (perf.rescan ? 15 : 0) - Math.max(0, perf.gateTime - 30) * 2);
      api.state.scores.escape = Math.round(s); save();
      const avg = avgScore();
      if (t <= 25 && avg >= 80) end('root');
      else if (t < 60) end('liberated');
      else end('ghost');
    }

    function end(kind) {
      if (ended) return; ended = true;
      pa?.abort();
      const E = ENDINGS[kind];
      if (!api.state.endings.includes(kind)) api.state.endings.push(kind);
      save();
      api.rain.setSpeed(kind === 'root' ? 0.25 : 1);
      api.rain.setAlert(kind === 'recaptured' ? 1 : 0);
      kind === 'recaptured' ? api.sfx.alert() : api.sfx.win();
      phaseEl.textContent = 'END OF LINE';
      const routeLine = perf.route === 'A' ? 'You took the Downtown Loop: fast, loud, and seen.' : perf.route === 'B' ? 'You took Service Tunnel 7: slow, dark, and unseen.' : 'You never reached the route junction.';
      const again = h('button', { class: 'btn', onclick: () => api.restart() }, '> REPLAY FINAL MISSION');
      body.replaceChildren(h('div', { class: 'ending fade-in' },
        h('div', { class: `stamp ${E.cls}` }, E.stamp),
        h('h1', { class: E.cls }, E.title),
        h('p', {}, E.text),
        h('p', { class: 'dim' }, routeLine),
        h('div', { class: 'scores' },
          ...[['FINAL THREAT', `${Math.round(api.state.threat)}%`], ['PERFORMANCE', `${avgScore()}%`], ['IMPACTS', String(perf.hits)], ['ENDINGS FOUND', `${api.state.endings.length}/4`]]
            .map(([k, v]) => h('div', { class: 'win' }, h('div', { class: 'win-body' }, h('div', { class: 'kicker' }, k), h('b', {}, v))))),
        h('p', { class: 'dim', style: { fontSize: '14px' } }, 'Four endings exist. Lower threat and higher performance open the deeper exits.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } }, again,
          h('button', { class: 'btn ghost', onclick: () => { api.newRun(); } }, 'NEW RUN'))));
      again.focus();
    }

    phaseKey();
  },
};
