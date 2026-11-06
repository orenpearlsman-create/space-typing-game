// Shared engine for the floating-letters games (Enav's and Nevo's apps).
// Targets (a letter, a word, an exercise) fly in from deep space, stop when their
// glyphs reach a quarter of the screen height, and are cleared by typing their keys.
// Keys are matched by physical position (event.code), so the active keyboard
// language does not matter: א and T are the same key.
(function () {
'use strict';

// ---- Physical keys: code -> label on an English / Hebrew keyboard ----
const KEYS = [
  ['KeyQ','Q',null], ['KeyW','W',null], ['KeyE','E','ק'], ['KeyR','R','ר'], ['KeyT','T','א'],
  ['KeyY','Y','ט'], ['KeyU','U','ו'], ['KeyI','I','ן'], ['KeyO','O','ם'], ['KeyP','P','פ'],
  ['KeyA','A','ש'], ['KeyS','S','ד'], ['KeyD','D','ג'], ['KeyF','F','כ'], ['KeyG','G','ע'],
  ['KeyH','H','י'], ['KeyJ','J','ח'], ['KeyK','K','ל'], ['KeyL','L','ך'], ['Semicolon',null,'ף'],
  ['KeyZ','Z','ז'], ['KeyX','X','ס'], ['KeyC','C','ב'], ['KeyV','V','ה'], ['KeyB','B','נ'],
  ['KeyN','N','מ'], ['KeyM','M','צ'], ['Comma',null,'ת'], ['Period',null,'ץ'],
];
const HE_TO_CODE = {}, EN_TO_CODE = {};
for (const [code, en, he] of KEYS) {
  if (he) HE_TO_CODE[he] = code;
  if (en) EN_TO_CODE[en] = code;
}
// Touch screens (phone, tablet) have no physical keys, so the on-screen keyboard is tappable there.
const TOUCH = window.matchMedia ? matchMedia('(pointer: coarse)').matches : false;
const HEBREW = KEYS.filter(k => k[2]).map(k => k[2]);
const ENGLISH = KEYS.filter(k => k[1]).map(k => k[1]);
const DIGITS = '0123456789'.split('');

function codeForChar(ch) {
  if (/^[0-9]$/.test(ch)) return 'Digit' + ch;
  return HE_TO_CODE[ch] || EN_TO_CODE[ch.toUpperCase()] || null;
}
function codeFromEvent(e) {
  if (/^Numpad\d$/.test(e.code)) return 'Digit' + e.code.slice(6);
  return e.code;
}

// ---- Audio ----
let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, type, delay, dur, vol) {
  const a = audio(), s = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, s);
  g.gain.exponentialRampToValueAtTime(vol, s + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, s + dur);
  o.connect(g); g.connect(a.destination); o.start(s); o.stop(s + dur + 0.01);
}
const sound = {
  buzz() { tone(92, 'sawtooth', 0, 0.28, 0.3); tone(131, 'sawtooth', 0, 0.28, 0.3); },
  step() { tone(660, 'triangle', 0, 0.15, 0.2); },
  ding() { tone(880, 'triangle', 0, 0.25, 0.25); tone(1320, 'triangle', 0.07, 0.25, 0.25); },
  late() { tone(520, 'triangle', 0, 0.25, 0.22); },
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 'square', i * 0.08, 0.15, 0.08)); },
  win() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 'triangle', i * 0.09, 0.3, 0.2)); },
};

let speechOn = true;
function say(text, lang) {
  if (!speechOn || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = lang.startsWith('he') ? 0.8 : 0.85;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* speech is optional */ }
}

// ---- Shared styles ----
const css = `
  [hidden] { display: none !important; }
  .ft-field { position: fixed; inset: 0; overflow: hidden; }
  .ft-stars { position: fixed; inset: 0; }
  .ft-target {
    position: absolute; left: 0; top: 0; width: max-content;
    font-weight: 900; line-height: 1; white-space: nowrap;
    will-change: transform; transform-origin: center center;
    text-shadow: 0 0 0.08em rgba(0,0,0,.6), 0 0 0.25em currentColor;
    display: flex; flex-direction: column; align-items: center;
  }
  .ft-target .pic { font-size: .5em; line-height: 1.15; text-shadow: none; }
  .ft-target .row { display: flex; justify-content: center; gap: .04em; }
  .ft-target .row span.done { opacity: .25; }
  .ft-target .row span.next { text-decoration: underline; text-decoration-thickness: .06em; text-underline-offset: .14em; }
  .ft-target .row span.slot { color: #fff; opacity: .55; }
  .ft-target .row span.slot.filled { opacity: 1; color: inherit; }
  .ft-target.waiting { animation: ft-pulse 0.8s ease-in-out infinite; }
  @keyframes ft-pulse { 50% { filter: brightness(1.6); } }
  .ft-spark { position: absolute; width: 12px; height: 12px; border-radius: 50%; pointer-events: none; }
  .ft-flash { position: fixed; inset: 0; background: #ff2020; opacity: 0; pointer-events: none; z-index: 4; transition: opacity .25s; }
  .ft-flash.on { opacity: .28; transition: none; }
  .ft-shake { animation: ft-shake .25s; }
  @keyframes ft-shake {
    20% { transform: translateX(-12px); } 40% { transform: translateX(10px); }
    60% { transform: translateX(-8px); } 80% { transform: translateX(6px); }
  }
  .ft-kbd {
    --kw: min(56px, calc((100vw - 16px - 36px) / 10));
    position: fixed; bottom: calc(8px + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%);
    direction: ltr; z-index: 5; opacity: .92;
  }
  .ft-kbd .row { display: flex; justify-content: center; gap: 4px; margin-top: 4px; }
  .ft-kbd .key {
    width: var(--kw); height: max(34px, min(var(--kw), 8.5vh)); border-radius: 8px; background: rgba(255,255,255,.12);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-size: calc(var(--kw) * .27); color: rgba(255,255,255,.6); line-height: 1.1;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .ft-kbd .key .main { font-size: calc(var(--kw) * .44); color: #fff; }
  .ft-kbd.tap .key { cursor: pointer; background: rgba(255,255,255,.18); }
  .ft-kbd.tap .key.blank { visibility: hidden; }
  .ft-kbd .key.press { background: rgba(255,255,255,.45); transform: scale(.94); }
  .ft-kbd .key.hint { background: #ffd23f; box-shadow: 0 0 18px #ffd23f; color: #222; }
  .ft-kbd .key.hint .main { color: #000; }
  @media (prefers-reduced-motion: reduce) { .ft-target.waiting { animation: none; } .ft-shake { animation: none; } }
`;
const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ---- Background stars (always running) ----
const starCanvas = document.createElement('canvas');
starCanvas.className = 'ft-stars';
const sctx = starCanvas.getContext('2d');
let stars = [], starSpeed = 0.6;
function resizeStars() {
  starCanvas.width = innerWidth; starCanvas.height = innerHeight;
  stars = Array.from({ length: 160 }, () => ({ x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: Math.random() }));
}
function drawStars(dt) {
  const w = starCanvas.width, h = starCanvas.height;
  sctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    s.z -= dt * 0.08 * starSpeed;
    if (s.z <= 0.02) { s.z = 1; s.x = (Math.random() - .5) * 2; s.y = (Math.random() - .5) * 2; }
    const px = w / 2 + (s.x / s.z) * w * 0.25, py = h / 2 + (s.y / s.z) * h * 0.25;
    if (px < 0 || px > w || py < 0 || py > h) continue;
    sctx.fillStyle = `rgba(255,255,255,${1 - s.z})`;
    sctx.beginPath(); sctx.arc(px, py, Math.max(0.5, (1 - s.z) * 2.5), 0, Math.PI * 2); sctx.fill();
  }
}

// ---- On-screen keyboard used for hints ----
const KBD_ROWS = [
  ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0'],
  ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP'],
  ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon'],
  ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period'],
];
function buildKeyboard(showEnglish) {
  const info = Object.fromEntries(KEYS.map(([c, en, he]) => [c, { en, he }]));
  const root = document.createElement('div');
  root.className = TOUCH ? 'ft-kbd tap' : 'ft-kbd'; root.hidden = true;
  const els = {};
  for (const row of KBD_ROWS) {
    const r = document.createElement('div'); r.className = 'row';
    for (const code of row) {
      const k = document.createElement('div'); k.className = 'key'; k.dataset.code = code;
      if (code.startsWith('Digit')) k.innerHTML = `<span class="main">${code.slice(5)}</span>`;
      else {
        const { en, he } = info[code];
        k.innerHTML = `<span class="main">${he || ''}</span><span>${showEnglish && en ? en : ''}</span>`;
        if (!he && !(showEnglish && en)) k.classList.add('blank');
      }
      k.addEventListener('pointerdown', (e) => {
        if (!TOUCH || k.classList.contains('blank')) return;
        e.preventDefault();
        k.classList.add('press'); setTimeout(() => k.classList.remove('press'), 120);
        pressCode(code);
      });
      els[code] = k; r.appendChild(k);
    }
    root.appendChild(r);
  }
  return {
    root,
    highlight(codes) { for (const [c, el] of Object.entries(els)) el.classList.toggle('hint', codes.has(c)); },
  };
}

// ---- Item builders ----
// An item is what the game spawns: the keys to type (seq) and how it looks.
function letterItem(ch) {
  return { kind: 'letter', seq: [{ ch, code: codeForChar(ch) }], row: [ch], dir: 'ltr' };
}
function wordItem(word, pic, lang) {
  const chars = [...word];
  return {
    kind: 'word', pic, dir: lang === 'he' ? 'rtl' : 'ltr',
    seq: chars.map(ch => ({ ch, code: codeForChar(ch) })), row: chars,
    say: { text: word, lang: lang === 'he' ? 'he-IL' : 'en-US' },
  };
}
// expr: e.g. "7 + 5 =", answer typed digit by digit into blank slots.
function mathItem(expr, answer, pic, sayText) {
  const digits = String(answer).split('');
  return {
    kind: 'math', pic, dir: 'ltr', prefix: expr + ' ',
    seq: digits.map(ch => ({ ch, code: codeForChar(ch), reveal: true })), row: digits.map(() => '_'),
    say: sayText ? { text: sayText, lang: 'he-IL' } : null,
  };
}

// ---- Game engine ----
const SPEEDUP_EVERY = 4;
const SPEEDUP_SECONDS = 0.11;
const MIN_APPROACH = 0.8;
const Z_FAR = 12;
const COLORS = ['#ff5d8f', '#4fd1ff', '#ffd23f', '#7cff6b', '#c792ff', '#ff9f40', '#5dffd6'];

let field, flash, kbd, game = null;
function mount(opts) {
  field = document.createElement('div'); field.className = 'ft-field';
  flash = document.createElement('div'); flash.className = 'ft-flash';
  kbd = buildKeyboard(opts.keyboardEnglish !== false);
  document.body.prepend(starCanvas, field, flash);
  document.body.appendChild(kbd.root);
  resizeStars();
  addEventListener('resize', resizeStars);
}

// opts: { startApproach, maxOnScreen, hint, nextItem(state), onHud(state), onExit(state), freeTop }
function start(opts) {
  audio();
  field.innerHTML = '';
  game = {
    opts,
    approach: opts.startApproach,
    targets: [], score: 0, inTime: 0, sinceSpeedup: 0, misses: 0, done: 0,
    spawnTimer: 0.3,
  };
  kbd.root.hidden = !(opts.hint || TOUCH);
  hud();
  return game;
}
function stop() {
  const g = game;
  game = null;
  if (field) field.innerHTML = '';
  if (kbd) { kbd.highlight(new Set()); kbd.root.hidden = true; }
  return g;
}
function hud() { if (game && game.opts.onHud) game.opts.onHud(game); }

function freeArea() {
  const top = game.opts.freeTop || 50;
  const bottom = kbd.root.hidden ? innerHeight : innerHeight - kbd.root.offsetHeight - 16;
  return { top, bottom };
}

function spawn() {
  const g = game;
  const item = g.opts.nextItem(g);
  const el = document.createElement('div');
  el.className = 'ft-target';
  el.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  if (item.pic) {
    const pic = document.createElement('div'); pic.className = 'pic'; pic.dir = item.dir; pic.textContent = item.pic;
    el.appendChild(pic);
  }
  const row = document.createElement('div'); row.className = 'row'; row.dir = item.dir;
  if (item.prefix) { const p = document.createElement('span'); p.textContent = item.prefix; row.appendChild(p); }
  const spans = item.row.map(ch => {
    const sp = document.createElement('span'); sp.textContent = ch;
    if (item.kind === 'math') sp.classList.add('slot');
    row.appendChild(sp); return sp;
  });
  if (item.seq.length > 1) spans[0].classList.add('next');
  el.appendChild(row);
  field.appendChild(el);

  // Glyphs reach a quarter of the screen height, unless that would not fit the free area.
  const { top, bottom } = freeArea();
  const base = (innerHeight * 0.25) / 0.72;
  el.style.fontSize = base + 'px';
  const k = Math.min(1, (innerWidth * 0.9) / el.offsetWidth, (bottom - top) / el.offsetHeight);
  if (k < 1) el.style.fontSize = base * k + 'px';
  const w = el.offsetWidth, h = el.offsetHeight;

  const maxX = Math.max(0, innerWidth / 2 - w * 0.6);
  const maxY = Math.max(0, (bottom - top) / 2 - h / 2);
  let fx, fy;
  if (g.opts.maxOnScreen > 1) {
    let best = [0, 0], bestD = -1;
    for (let i = 0; i < 25; i++) {
      const x = (Math.random() * 2 - 1) * maxX, y = (Math.random() * 2 - 1) * maxY;
      const d = Math.min(Infinity, ...g.targets.map(t => Math.hypot(t.fx - x, t.fy - y)));
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
    [fx, fy] = best;
  } else {
    fx = (Math.random() * 2 - 1) * maxX * 0.6;
    fy = (Math.random() * 2 - 1) * maxY * 0.6;
  }
  fy += (top + bottom) / 2 - innerHeight / 2;

  const t = {
    item, el, spans, idx: 0, w, h, fx, fy, t: 0, waitT: 0, waiting: false,
    duration: g.approach * (item.slow || 1),
  };
  g.targets.push(t);
  place(t);
}

function place(t) {
  const p = Math.min(1, t.t / t.duration);
  const s = 1 / (Z_FAR - (Z_FAR - 1) * p);   // perspective: distance shrinks linearly in time
  const x = innerWidth / 2 + t.fx * s - t.w / 2;
  const y = innerHeight / 2 + t.fy * s - t.h / 2;
  t.el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  t.el.style.opacity = Math.min(1, p * 4 + 0.15);
  t.el.style.zIndex = Math.round(p * 100);
}

function updateHints() {
  if (!game || !game.opts.hint) return;
  const codes = new Set();
  for (const t of game.targets)
    if (t.waiting && t.waitT >= (t.item.hintDelay || 0)) codes.add(t.item.seq[t.idx].code);
  kbd.highlight(codes);
}

function burst(t) {
  const rect = t.el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  for (let i = 0; i < 18; i++) {
    const sp = document.createElement('div');
    sp.className = 'ft-spark'; sp.style.background = t.el.style.color;
    sp.style.left = cx + 'px'; sp.style.top = cy + 'px';
    field.appendChild(sp);
    const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 140;
    sp.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist - 6}px, ${Math.sin(ang) * dist - 6}px) scale(0.2)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 300, easing: 'ease-out' }).onfinish = () => sp.remove();
  }
  t.el.animate([{ transform: t.el.style.transform, opacity: 1 },
                { transform: t.el.style.transform + ' scale(1.4)', opacity: 0 }],
               { duration: 250 }).onfinish = () => t.el.remove();
}

function wrong() {
  sound.buzz();
  game.misses++;
  flash.classList.add('on'); requestAnimationFrame(() => flash.classList.remove('on'));
  field.classList.remove('ft-shake'); void field.offsetWidth; field.classList.add('ft-shake');
}

function typeInto(t) {
  const step = t.item.seq[t.idx], sp = t.spans[t.idx];
  if (step.reveal) { sp.textContent = step.ch; sp.classList.add('filled'); }
  sp.classList.remove('next');
  if (t.idx < t.item.seq.length - 1) {
    if (!step.reveal) sp.classList.add('done');
    t.idx++;
    t.spans[t.idx].classList.add('next');
    sound.step();
    updateHints();
    return;
  }
  complete(t);
}

function complete(t) {
  const g = game;
  g.targets.splice(g.targets.indexOf(t), 1);
  burst(t);
  if (t.item.say) say(t.item.say.text, t.item.say.lang);
  const inTime = !t.waiting;
  g.done++;
  g.score += (inTime ? 10 : 3) * (t.item.kind === 'letter' ? 1 : 2);
  if (inTime) {
    g.inTime++;
    if (++g.sinceSpeedup >= SPEEDUP_EVERY) {
      g.sinceSpeedup = 0;
      g.approach = Math.max(MIN_APPROACH, g.approach - SPEEDUP_SECONDS);
      sound.levelUp();
    } else sound.ding();
  } else sound.late();
  g.spawnTimer = Math.min(g.spawnTimer, 0.45);
  hud();
  updateHints();
}

document.addEventListener('keydown', (e) => {
  if (!game || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { const g = stop(); g.opts.onExit && g.opts.onExit(g); return; }
  if (['Tab', 'Shift', 'CapsLock', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return;
  e.preventDefault();
  if (e.repeat) return;
  pressCode(codeFromEvent(e));
});

// One path for physical keys and taps on the on-screen keyboard.
function pressCode(code) {
  if (!game) return;
  // A word already being typed gets the key first, then the nearest target.
  const matches = game.targets
    .filter(t => t.item.seq[t.idx].code === code)
    .sort((a, b) => (b.idx > 0) - (a.idx > 0) || b.t / b.duration - a.t / a.duration);
  if (matches.length) typeInto(matches[0]);
  else wrong();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  starSpeed = game ? 4 / game.approach : 0.6;
  drawStars(dt);
  if (game) {
    const g = game;
    let hintsChanged = false;
    for (const t of g.targets) {
      if (t.waiting) {
        const before = t.waitT;
        t.waitT += dt;
        if (before < (t.item.hintDelay || 0) && t.waitT >= (t.item.hintDelay || 0)) hintsChanged = true;
        continue;
      }
      t.t += dt;
      if (t.t >= t.duration) {
        t.t = t.duration; t.waiting = true;
        t.el.classList.add('waiting');
        hintsChanged = true;
      }
      place(t);
    }
    if (hintsChanged) updateHints();
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0 && g.targets.length < g.opts.maxOnScreen) {
      spawn();
      g.spawnTimer = g.opts.maxOnScreen > 1 ? g.approach / g.opts.maxOnScreen : 0.45;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.Floaty = {
  TOUCH, HEBREW, ENGLISH, DIGITS, FINALS: new Set(['ן','ם','ך','ף','ץ']),
  codeForChar, codeFromEvent, sound, say, audio,
  setSpeech(on) { speechOn = on; },
  letterItem, wordItem, mathItem,
  mount, start, stop, isRunning: () => !!game,
};
})();
