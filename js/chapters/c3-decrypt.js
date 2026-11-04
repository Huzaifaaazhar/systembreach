import { h, win } from '../ui.js';

const GLYPHS = ['A', 'B', 'C', 'D', 'E', 'F'];
const LEN = 4, MAX = 8, FREE = 4;

function score(guess, code) {
  let hit = 0, near = 0;
  const gc = {}, cc = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === code[i]) hit++;
    else { gc[guess[i]] = (gc[guess[i]] || 0) + 1; cc[code[i]] = (cc[code[i]] || 0) + 1; }
  }
  for (const k in gc) near += Math.min(gc[k], cc[k] || 0);
  return { hit, near };
}

export default {
  id: 'decrypt', num: '03', title: 'DECRYPTION',
  blurb: 'A sentinel firewall guards the node. Its access code is four hex glyphs. Brute force is loud; deduction is quiet.',
  lesson: 'Reading system feedback. Each attempt returns solid pegs (right glyph, right slot) and hollow pegs (right glyph, wrong slot). The first four attempts are free; after that every attempt raises the threat.',
  mount(root, api) {
    const code = Array.from({ length: LEN }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]);
    let cur = [], tries = 0, hints = 0, over = false;
    const revealed = new Set();

    const curRow = h('div', { class: 'current' });
    const list = h('div', { class: 'attempts' });
    const msg = h('p', { class: 'dim' }, `Attempts: 0/${MAX}. Free attempts left: ${FREE}.`);
    const pad = h('div', { class: 'glyph-pad' }, GLYPHS.map((g) => h('button', { class: 'btn', onclick: () => press(g), 'aria-label': `Glyph ${g}` }, g)));
    const del = h('button', { class: 'btn ghost', onclick: back }, '⌫ DEL');
    const sub = h('button', { class: 'btn', onclick: submit, disabled: true }, '> SUBMIT');
    const hintBtn = h('button', { class: 'btn ghost', onclick: hint, title: 'Reveal one slot (+8% threat)' }, 'FORCE SLOT +8%');

    root.append(
      h('h2', {}, 'BREAK THE FIREWALL'),
      h('div', { class: 'dec-wrap' },
        win('FIREWALL // 0x7F3A', h('div', {}, msg, curRow, list)),
        win('INPUT', h('div', { style: { display: 'grid', gap: '12px' } }, pad, h('div', { class: 'row' }, del, sub), hintBtn,
          h('p', { class: 'dim', style: { fontSize: '14px', margin: 0 } }, 'Keyboard: A–F, Backspace, Enter.'),
          h('div', { style: { fontSize: '14px' } },
            h('div', {}, h('span', { class: 'peg hit', style: { display: 'inline-block', verticalAlign: 'middle' } }), ' right glyph, right slot'),
            h('div', {}, h('span', { class: 'peg near', style: { display: 'inline-block', verticalAlign: 'middle' } }), ' right glyph, wrong slot'))))),
    );

    function renderCur() {
      curRow.replaceChildren(...Array.from({ length: LEN }, (_, i) => h('div', { class: `slot ${cur[i] ? 'filled' : ''}` }, cur[i] || (revealed.has(i) ? code[i].toLowerCase() : '_'))));
      sub.disabled = cur.length !== LEN || over;
    }
    function press(g) { if (over || cur.length >= LEN) return; cur.push(g); api.sfx.key(); renderCur(); }
    function back() { cur.pop(); api.sfx.tick(); renderCur(); }
    function hint() {
      if (over) return;
      const left = [...Array(LEN).keys()].filter((i) => !revealed.has(i));
      if (left.length <= 1) return api.toast('Cannot force the final slot.');
      const i = left[(Math.random() * left.length) | 0];
      revealed.add(i); hints++;
      api.threat(8, `slot ${i + 1} forced: ${code[i]}`);
      renderCur();
    }
    function submit() {
      if (cur.length !== LEN || over) return;
      tries++;
      const { hit, near } = score(cur, code);
      const pegs = [...Array(hit).fill('hit'), ...Array(near).fill('near'), ...Array(LEN - hit - near).fill('')];
      list.prepend(h('div', { class: 'attempt fade-in' },
        h('span', { class: 'dim', style: { width: '2.2em' } }, String(tries).padStart(2, '0')),
        cur.map((g) => h('span', { class: 'g' }, g)),
        h('span', { class: 'pegs', 'aria-label': `${hit} exact, ${near} misplaced` }, pegs.map((p) => h('span', { class: `peg ${p}` })))));
      cur = [];
      if (hit === LEN) {
        over = true; api.sfx.win(); renderCur();
        const s = Math.max(30, 100 - Math.max(0, tries - 3) * 10 - hints * 15);
        msg.replaceChildren(h('span', { class: 'stat' }, `ACCESS CODE ${code.join('')} ACCEPTED. FIREWALL DOWN.`));
        const next = h('button', { class: 'btn', onclick: () => api.complete(s) }, '> CONTINUE');
        msg.append(h('div', { style: { marginTop: '10px' } }, next)); next.focus();
        return;
      }
      if (tries > FREE) api.threat(4, 'failed handshake logged'); else api.sfx.tick();
      if (tries >= MAX) {
        over = true;
        api.threat(15, 'lockout');
        msg.replaceChildren(h('span', { class: 'red' }, `LOCKOUT. The code was ${code.join('')}.`), ' ',
          h('button', { class: 'btn small', onclick: () => api.restart() }, 'RETRY'),
          ' ', h('button', { class: 'btn small ghost', onclick: () => api.complete(25) }, 'FORCE THROUGH'));
      } else {
        msg.textContent = `Attempts: ${tries}/${MAX}. ${tries < FREE ? `Free attempts left: ${FREE - tries}.` : 'Each further attempt: +4% threat.'}`;
      }
      renderCur();
    }

    const kd = (e) => {
      const k = e.key.toUpperCase();
      if (GLYPHS.includes(k)) press(k);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') submit();
    };
    window.addEventListener('keydown', kd);
    renderCur();
    return () => window.removeEventListener('keydown', kd);
  },
};
