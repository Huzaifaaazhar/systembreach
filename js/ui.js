// Small DOM helpers shared by chapters.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

export function win(title, body, { cls = '', controls = true } = {}) {
  return h('section', { class: `win ${cls}` },
    h('div', { class: 'win-title' }, h('span', {}, title), controls ? h('span', { class: 'ctl', 'aria-hidden': 'true' }, '_□×') : null),
    h('div', { class: 'win-body' }, body));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Type text into an element character by character. Resolves early if aborted.
export async function typeInto(el, text, { speed = 22, signal, onChar } = {}) {
  for (let i = 0; i < text.length; i++) {
    if (signal?.aborted) { el.textContent += text.slice(i); return; }
    el.textContent += text[i];
    if (onChar && text[i] !== ' ') onChar();
    await sleep(text[i] === '.' ? speed * 3 : speed);
  }
}

// Fit a canvas to its CSS box at device pixel ratio; returns {w,h,dpr}.
export function fitCanvas(cv, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth, hh = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
  }
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h: hh, dpr };
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
