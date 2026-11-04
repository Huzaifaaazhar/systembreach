// Reusable phosphor terminal with a block cursor, command history and clickable hint chips.
import { h, typeInto, sleep } from './ui.js';
import { sfx } from './audio.js';

export function createTerminal({ signal } = {}) {
  const out = h('div', { class: 'term-out' });
  const typed = h('span', {});
  const promptLbl = h('span', {}, '>');
  const input = h('input', {
    type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    'aria-label': 'Terminal command',
    style: { position: 'absolute', opacity: 0, left: 0, top: 0, width: '1px', height: '1px', pointerEvents: 'none' },
  });
  const line = h('div', { class: 'prompt-line line' }, promptLbl, h('span', {}, typed, h('span', { class: 'cursor' })), input);
  const chips = h('div', { class: 'chips' });
  const el = h('div', { class: 'term', onclick: () => input.focus() }, out, line, chips);
  line.hidden = true;

  let handler = null;
  const history = []; let hi = 0;

  input.addEventListener('input', () => { typed.textContent = input.value.toUpperCase(); sfx.key(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = input.value.trim().toUpperCase();
      input.value = ''; typed.textContent = '';
      if (!v) return;
      history.push(v); hi = history.length;
      submit(v);
    } else if (e.key === 'ArrowUp' && history.length) {
      hi = Math.max(0, hi - 1); input.value = history[hi]; typed.textContent = input.value; e.preventDefault();
    } else if (e.key === 'ArrowDown' && history.length) {
      hi = Math.min(history.length, hi + 1); input.value = history[hi] || ''; typed.textContent = input.value; e.preventDefault();
    }
  });

  function submit(v) {
    print(`${promptLbl.textContent} ${v}`, 'sys');
    handler?.(v);
  }

  // keep the newest line in view inside whichever container scrolls
  function follow() {
    const sc = el.closest('#stage');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function print(text, cls = 'out') {
    const d = h('div', { class: `line ${cls}` }, text);
    out.append(d);
    follow();
    return d;
  }

  async function type(text, cls = 'sys', speed = 26) {
    line.hidden = true;
    const d = h('div', { class: `line ${cls}` });
    out.append(d);
    follow();
    await typeInto(d, text, { speed, signal, onChar: () => { sfx.key(); follow(); } });
    return d;
  }

  return {
    el, print, type,
    async ready(prompt = '>') {
      promptLbl.textContent = prompt;
      line.hidden = false;
      follow();
      await sleep(10);
      input.focus({ preventScroll: true });
    },
    lock() { line.hidden = true; },
    onCommand(fn) { handler = fn; },
    run: submit,
    clear() { out.replaceChildren(); },
    setChips(list) {
      chips.replaceChildren(...list.map((c) => h('button', {
        class: 'chip', onclick: (e) => { e.stopPropagation(); sfx.tick(); if (!line.hidden) submit(c); },
      }, c)));
    },
    focus() { input.focus({ preventScroll: true }); },
  };
}
