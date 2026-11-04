import { createTerminal } from '../terminal.js';
import { h, sleep } from '../ui.js';
import { save } from '../state.js';

export default {
  id: 'boot', num: '01', title: 'BOOT SEQUENCE', intro: false,
  blurb: 'An unauthorized terminal wakes up in the dark.',
  lesson: 'The terminal is your interface to the system. Commands matter, and noise gets noticed.',
  mount(root, api) {
    const t = createTerminal({ signal: api.signal });
    root.classList.add('center');
    root.append(h('div', { style: { maxWidth: '980px', width: '100%' } }, t.el));
    let mode = 'cmd';
    let errors = 0;

    const CMDS = {
      HELP: () => {
        t.print('AVAILABLE COMMANDS:');
        t.print('  LOGIN    open a session on this node');
        t.print('  SCAN     sweep the local network');
        t.print('  WHOAMI   identify current user');
        t.print('  STATUS   system status');
        t.print('  CLEAR    clear the screen');
      },
      WHOAMI: () => t.print(api.state.handle === 'OPERATIVE' ? 'UNKNOWN // NO SESSION' : api.state.handle),
      STATUS: () => t.print(`NODE 0x7F3A // THREAT ${Math.round(api.state.threat)}% // INTRUSION LOGGED`),
      SCAN: async () => {
        t.lock();
        for (const l of ['SWEEPING 10.0.0.0/8 ...', '  3 SENTINEL NODES ONLINE', '  1 UNREGISTERED SIGNAL // SOURCE UNKNOWN', 'RECOMMENDATION: LOGIN']) {
          await sleep(260); t.print(l);
        }
        t.ready('>');
      },
      CLEAR: () => t.clear(),
      LOGIN: () => { mode = 'handle'; t.print('ENTER HANDLE:'); t.setChips(['GHOST', 'ZERO', 'DRIFT']); t.ready('HANDLE>'); },
    };

    t.onCommand(async (v) => {
      if (mode === 'handle') {
        const handle = v.replace(/[^A-Z0-9_-]/g, '').slice(0, 16) || 'GHOST';
        api.state.handle = handle; save();
        mode = 'wait'; t.lock(); t.setChips([]);
        await t.type(`AUTHENTICATING ${handle} ...`, 'out', 18);
        await sleep(400);
        await t.type('ACCESS GRANTED.', 'sys');
        await sleep(300);
        await t.type(`WAKE UP, ${handle}. THE WORLD YOU SEE IS RENDERED.`, 'sys', 34);
        await t.type('SOMETHING IS HIDDEN IN THE RAIN. FOLLOW THE SIGNAL.', 'sys', 34);
        mode = 'follow';
        t.setChips(['FOLLOW']);
        t.ready('>');
        return;
      }
      if (mode === 'follow') {
        if (v === 'FOLLOW' || v === 'FOLLOW THE SIGNAL' || v === 'Y' || v === 'YES') {
          t.lock(); api.sfx.ok();
          api.complete(Math.max(40, 100 - errors * 12));
        } else { t.print('THE SIGNAL IS FADING. TYPE FOLLOW.', 'err'); }
        return;
      }
      const fn = CMDS[v];
      if (fn) return fn();
      errors++;
      t.print(`'${v}' NOT RECOGNIZED. TYPE HELP.`, 'err');
      if (errors >= 3) api.threat(3, 'noisy input detected');
    });

    (async () => {
      await sleep(500);
      await t.type('SYSTEM STATUS: UNAUTHORIZED ACCESS DETECTED.', 'sys', 32);
      await t.type('INITIATING NEURAL INTERFACE...', 'sys', 40);
      t.print('');
      t.setChips(['LOGIN', 'HELP', 'SCAN', 'WHOAMI']);
      t.ready('>');
    })();
  },
};
