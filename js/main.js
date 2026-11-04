import { state, save, wipe } from './state.js';
import { sfx, setMuted } from './audio.js';
import { createRain } from './rain.js';
import { h, sleep } from './ui.js';

import boot from './chapters/c1-boot.js';
import signal from './chapters/c2-signal.js';
import decrypt from './chapters/c3-decrypt.js';
import bullet from './chapters/c4-bullettime.js';
import pursuit from './chapters/c5-pursuit.js';
import reality from './chapters/c6-reality.js';
import escape from './chapters/c7-escape.js';

const CHAPTERS = [boot, signal, decrypt, bullet, pursuit, reality, escape];

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const hud = $('#hud');
const threatEl = $('#threat');
const toastEl = $('#toast');
const rain = createRain($('#rain'));

if (new URLSearchParams(location.search).has('dev')) state.unlocked = CHAPTERS.length - 1;

let current = -1;
let cleanup = null;
let abort = null;
let threatAtEntry = 0;
let onMaxThreat = null;
let maxed = false;

/* ───────── threat ───────── */
function renderThreat() {
  const t = Math.round(state.threat);
  threatEl.querySelector('.fill').style.width = `${t}%`;
  threatEl.querySelector('.val').textContent = `${t}%`;
  threatEl.classList.toggle('warn', t >= 45 && t < 75);
  threatEl.classList.toggle('crit', t >= 75);
  document.documentElement.style.setProperty('--threat', t / 100);
  rain.setAlert(Math.max(0, (t - 40) / 60));
}

function addThreat(n, reason) {
  if (maxed) return;
  state.threat = Math.max(0, Math.min(100, state.threat + n));
  save(); renderThreat();
  if (n > 0) {
    threatEl.classList.remove('bump'); void threatEl.offsetWidth; threatEl.classList.add('bump');
    sfx.err();
    if (reason) toast(`THREAT +${n}% // ${reason}`, true);
  } else if (n < 0 && reason) toast(`THREAT ${n}% // ${reason}`);
  if (state.threat >= 100) {
    maxed = true;
    if (onMaxThreat) onMaxThreat(); else traceComplete();
  }
}

/* ───────── toast ───────── */
let toastT;
function toast(msg, bad = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('bad', bad);
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/* ───────── transitions ───────── */
async function glitch() {
  sfx.glitch();
  const g = $('#fx-glitch');
  g.classList.remove('on'); void g.offsetWidth; g.classList.add('on');
  document.body.classList.add('glitching');
  await sleep(320);
  setTimeout(() => document.body.classList.remove('glitching'), 300);
}

function unmount() {
  abort?.abort(); abort = null;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null; onMaxThreat = null;
  rain.setSpeed(1); rain.setDensity(1);
  stage.replaceChildren();
}

/* ───────── routing ───────── */
async function enter(i, { skipIntro = false } = {}) {
  await glitch();
  unmount();
  current = i;
  maxed = false;
  const ch = CHAPTERS[i];
  hud.hidden = i === 0;
  $('#hud-chapter').textContent = `${ch.num} // ${ch.title}`;
  stage.scrollTop = 0;
  if (ch.intro !== false && !skipIntro) return showIntro(i);
  start(i);
}

function showIntro(i) {
  const ch = CHAPTERS[i];
  const begin = h('button', { class: 'btn', onclick: () => { sfx.ok(); start(i); } }, '> BEGIN');
  stage.append(h('div', { class: 'chapter center fade-in' },
    h('div', { class: 'intro' },
      h('div', { class: 'num', 'aria-hidden': 'true' }, ch.num),
      h('div', { class: 'kicker' }, `CHAPTER ${ch.num} / 07`),
      h('h1', {}, ch.title),
      h('p', {}, ch.blurb),
      h('div', { class: 'intro lesson' },
        h('div', { class: 'kicker' }, 'THIS MODULE TEACHES'),
        h('p', { style: { margin: 0 } }, ch.lesson)),
      h('div', { class: 'row' }, begin, h('span', { class: 'dim' }, `threat carried in: ${Math.round(state.threat)}%`)))));
  begin.focus();
}

function start(i) {
  unmount();
  const ch = CHAPTERS[i];
  threatAtEntry = state.threat;
  abort = new AbortController();
  const root = h('div', { class: 'chapter fade-in' });
  stage.append(root);
  const api = {
    state, sfx, rain, toast, glitch,
    signal: abort.signal,
    threat: addThreat,
    set onMaxThreat(fn) { onMaxThreat = fn; },
    complete: (score) => complete(i, score),
    restart: () => { state.threat = threatAtEntry; save(); renderThreat(); start(i); },
    goto: (n) => enter(n),
    newRun: () => { wipe(); renderThreat(); enter(0); },
  };
  cleanup = ch.mount(root, api) || null;
}

async function complete(i, score) {
  state.scores[CHAPTERS[i].id] = Math.round(score);
  state.unlocked = Math.max(state.unlocked, Math.min(i + 1, CHAPTERS.length - 1));
  save();
  if (i + 1 < CHAPTERS.length) enter(i + 1);
}

function traceComplete() {
  unmount();
  sfx.alert();
  rain.setAlert(1);
  const retry = h('button', { class: 'btn', onclick: () => {
    state.threat = threatAtEntry; save(); renderThreat(); maxed = false; start(current);
  } }, '> RECONNECT');
  stage.append(h('div', { class: 'chapter center fade-in' },
    h('div', { class: 'ending' },
      h('div', { class: 'stamp red' }, 'TRACE COMPLETE'),
      h('h1', { class: 'red' }, 'CONNECTION SEVERED'),
      h('p', {}, 'The sentinels locked onto your signal. Your session was forcibly terminated.'),
      h('p', { class: 'dim' }, `Reconnecting restores the threat level you entered this module with (${Math.round(threatAtEntry)}%).`),
      h('div', { class: 'row', style: { justifyContent: 'center' } }, retry,
        h('button', { class: 'btn ghost', onclick: openMap }, 'CHAPTER MAP')))));
  retry.focus();
}

/* ───────── map ───────── */
function openMap() {
  const list = $('#map-list');
  list.replaceChildren(...CHAPTERS.map((ch, i) => h('li', {},
    h('button', {
      class: i === current ? 'cur' : '',
      disabled: i > state.unlocked,
      onclick: () => { closeMap(); enter(i); },
    }, h('span', { class: 'dim' }, ch.num), ch.title,
      h('span', { class: 'spacer' }),
      state.scores[ch.id] != null ? h('span', { class: 'dim' }, `${state.scores[ch.id]}%`) : (i > state.unlocked ? h('span', { class: 'dim' }, 'LOCKED') : null)))));
  $('#map').hidden = false;
  sfx.tick();
  list.querySelector('button:not([disabled])')?.focus();
}
function closeMap() { $('#map').hidden = true; }

$('#menu-btn').addEventListener('click', openMap);
$('#map-close').addEventListener('click', closeMap);
$('#map').addEventListener('click', (e) => { if (e.target.id === 'map') closeMap(); });
$('#reset-btn').addEventListener('click', () => {
  if (!confirm('Wipe all progress and threat history?')) return;
  wipe(); renderThreat(); closeMap(); enter(0);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#map').hidden) closeMap(); });

const muteBtn = $('#mute-btn');
const renderMute = () => { muteBtn.textContent = state.muted ? 'SND:OFF' : 'SND:ON'; };
muteBtn.addEventListener('click', () => { setMuted(!state.muted); renderMute(); sfx.tick(); });
renderMute();

document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
document.addEventListener('keydown', () => sfx.unlock(), { once: true });

// expose for automated checks
window.__sb = { state, enter, start: (i) => { current = i; hud.hidden = i === 0; $('#hud-chapter').textContent = `${CHAPTERS[i].num} // ${CHAPTERS[i].title}`; start(i); }, addThreat, CHAPTERS };

renderThreat();
const startAt = Number(new URLSearchParams(location.search).get('ch'));
enter(Number.isInteger(startAt) && startAt >= 1 && startAt <= 7 && startAt - 1 <= state.unlocked ? startAt - 1 : 0);
