// Exercise generators for Nevo's math mode (grades 6-8): algebra, arithmetic,
// angles, segments, areas and plane geometry. Each exercise carries two hints:
// the first names the rule to use, the second shows how to set it up.
(function () {
'use strict';

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const rad = d => d * Math.PI / 180;
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
// Math text is laid out left to right inside the Hebrew page.
const m = s => `<span class="m" dir="ltr">${s}</span>`;
const neg = n => (n < 0 ? '−' + Math.abs(n) : String(n));
const par = n => (n < 0 ? `(${neg(n)})` : String(n));
const frac = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;

// ---- Tiny geometry scene, rendered to SVG ----
class Scene {
  constructor() { this.P = {}; this.ops = []; this.extra = []; this.labelsUp = false; }
  pt(name, x, y, show = true) { this.P[name] = { x, y, show }; return this; }
  seg(a, b, o = {}) { this.ops.push({ k: 'seg', a, b, o }); return this; }
  // A line through a and b, drawn past both ends.
  line(a, b, ext = 0.35, o = {}) {
    const A = this.P[a], B = this.P[b], dx = B.x - A.x, dy = B.y - A.y;
    const p = { x: A.x - dx * ext, y: A.y - dy * ext }, q = { x: B.x + dx * ext, y: B.y + dy * ext };
    this.extra.push(p, q);
    this.ops.push({ k: 'segp', p, q, o });
    return this;
  }
  angle(v, p, q, label, o = {}) { this.ops.push({ k: 'ang', v, p, q, label, o }); return this; }
  right(v, p, q) { this.ops.push({ k: 'right', v, p, q }); return this; }
  circle(c, r) {
    const C = this.P[c];
    this.extra.push({ x: C.x - r, y: C.y - r }, { x: C.x + r, y: C.y + r });
    this.ops.push({ k: 'circle', c, r });
    return this;
  }
  tag(x, y, text, cls = 'lbl') { this.ops.push({ k: 'tag', x, y, text, cls }); return this; }

  render(W = 380, H = 250, pad = 34) {
    const all = [...Object.values(this.P), ...this.extra];
    const minX = Math.min(...all.map(p => p.x)), maxX = Math.max(...all.map(p => p.x));
    const minY = Math.min(...all.map(p => p.y)), maxY = Math.max(...all.map(p => p.y));
    const sc = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
    const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
    const T = p => [ox + (p.x - minX) * sc, H - oy - (p.y - minY) * sc];
    const shown = Object.values(this.P).filter(p => p.show);
    const cpts = (shown.length ? shown : all).map(T);
    const cx = cpts.reduce((s, p) => s + p[0], 0) / cpts.length;
    const cy = cpts.reduce((s, p) => s + p[1], 0) / cpts.length;
    const out = [];
    const txt = (x, y, s, cls = 'lbl') =>
      out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="middle" dominant-baseline="central">${s}</text>`);
    const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

    for (const op of this.ops) {
      if (op.k === 'seg' || op.k === 'segp') {
        const [x1, y1] = T(op.k === 'seg' ? this.P[op.a] : op.p), [x2, y2] = T(op.k === 'seg' ? this.P[op.b] : op.q);
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${op.o.dash ? 'ln dash' : 'ln'}"/>`);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        let [nx, ny] = unit(-(y2 - y1), x2 - x1);
        if (op.o.side) { nx *= op.o.side; ny *= op.o.side; }
        else if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
        if (op.o.ticks) {
          const [ux, uy] = unit(x2 - x1, y2 - y1);
          for (let i = 0; i < op.o.ticks; i++) {
            const off = (i - (op.o.ticks - 1) / 2) * 5, px = mx + ux * off, py = my + uy * off;
            out.push(`<line x1="${px - nx * 6}" y1="${py - ny * 6}" x2="${px + nx * 6}" y2="${py + ny * 6}" class="ln"/>`);
          }
        }
        if (op.o.label != null) txt(mx + nx * 15, my + ny * 15, op.o.label, op.o.unknown ? 'unk' : 'giv');
      } else if (op.k === 'ang') {
        const [vx, vy] = T(this.P[op.v]), [px, py] = T(this.P[op.p]), [qx, qy] = T(this.P[op.q]);
        const a1 = Math.atan2(py - vy, px - vx);
        let d = Math.atan2(qy - vy, qx - vx) - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d <= -Math.PI) d += 2 * Math.PI;
        const r = op.o.r || (Math.abs(d) < rad(40) ? 34 : 24);
        const sx = vx + r * Math.cos(a1), sy = vy + r * Math.sin(a1);
        const ex = vx + r * Math.cos(a1 + d), ey = vy + r * Math.sin(a1 + d);
        out.push(`<path d="M${sx} ${sy} A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${ex} ${ey}" class="${op.o.unknown ? 'arc unk-arc' : 'arc'}"/>`);
        if (op.label != null) {
          const b = a1 + d / 2, lr = r + 16;
          txt(vx + lr * Math.cos(b), vy + lr * Math.sin(b), op.label, op.o.unknown ? 'unk' : 'giv');
        }
      } else if (op.k === 'right') {
        const [vx, vy] = T(this.P[op.v]), [px, py] = T(this.P[op.p]), [qx, qy] = T(this.P[op.q]);
        const [ux, uy] = unit(px - vx, py - vy), [wx, wy] = unit(qx - vx, qy - vy), s = 12;
        out.push(`<path d="M${vx + ux * s} ${vy + uy * s} L${vx + (ux + wx) * s} ${vy + (uy + wy) * s} L${vx + wx * s} ${vy + wy * s}" class="arc"/>`);
      } else if (op.k === 'circle') {
        const [x, y] = T(this.P[op.c]);
        out.push(`<circle cx="${x}" cy="${y}" r="${op.r * sc}" class="ln"/>`);
      } else if (op.k === 'tag') {
        const [x, y] = T({ x: op.x, y: op.y });
        txt(x, y, op.text, op.cls);
      }
    }
    for (const [name, p] of Object.entries(this.P)) {
      if (!p.show) continue;
      const [x, y] = T(p);
      const [ux, uy] = this.labelsUp ? [0, -1] : unit(x - cx, y - cy);
      out.push(`<circle cx="${x}" cy="${y}" r="3" class="dot"/>`);
      txt(x + ux * 16, y + uy * 16, name, 'pname');
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="geo" direction="ltr" role="img" aria-label="שרטוט">${out.join('')}</svg>`;
  }
}

// Triangle with base 0-1 on the x axis and the given angles at its two base vertices.
function triFromAngles(A, B) {
  const C = 180 - A - B, ac = Math.sin(rad(B)) / Math.sin(rad(C));
  return [[0, 0], [1, 0], [ac * Math.cos(rad(A)), ac * Math.sin(rad(A))]];
}

const RULES = {
  triSum: 'סכום הזוויות במשולש הוא 180°.',
  adjacent: 'זוויות צמודות (על ישר אחד) משלימות זו את זו ל־180°.',
  vertical: 'זוויות קודקודיות שוות זו לזו.',
  corresponding: 'בין שני ישרים מקבילים, זוויות מתאימות שוות.',
  alternate: 'בין שני ישרים מקבילים, זוויות מתחלפות שוות.',
  coInterior: 'בין שני ישרים מקבילים, זוויות חד־צדדיות משלימות ל־180°.',
  isosceles: 'במשולש שווה־שוקיים, זוויות הבסיס שוות זו לזו.',
  exterior: 'זווית חיצונית למשולש שווה לסכום שתי הזוויות הפנימיות שאינן צמודות לה.',
  polygon: 'סכום הזוויות הפנימיות במצולע בעל n צלעות הוא (n−2)·180°.',
  pythagoras: 'משפט פיתגורס: במשולש ישר־זווית, סכום ריבועי הניצבים שווה לריבוע היתר (a² + b² = c²).',
  segAdd: 'חיבור קטעים: כשנקודה B נמצאת על הקטע AC, מתקיים AB + BC = AC.',
  midpoint: 'נקודת אמצע מחלקת את הקטע לשני קטעים שווים.',
  midsegment: 'קטע אמצעים במשולש (המחבר אמצעי שתי צלעות) מקביל לצלע השלישית ושווה למחציתה.',
  bisector: 'חוצה זווית מחלק את הזווית לשתי זוויות שוות.',
  circle: 'היקף מעגל: P = 2πr. שטח עיגול: S = πr².',
};

// ---- Geometry ----
function triSum() {
  const A = R(30, 110), B = R(25, 160 - A), C = 180 - A - B;
  const [a, b, c] = triFromAngles(A, B), s = new Scene();
  s.pt('A', ...a).pt('B', ...b).pt('C', ...c).seg('A', 'B').seg('B', 'C').seg('C', 'A')
    .angle('A', 'B', 'C', A + '°').angle('B', 'C', 'A', B + '°').angle('C', 'A', 'B', '?', { unknown: true });
  return {
    grade: 'ו', topic: 'זוויות במשולש',
    q: `במשולש ABC נתון: ${m(`∠A = ${A}°`)}, ${m(`∠B = ${B}°`)}. מצא את ${m('∠C')}.`,
    svg: s.render(), answer: C, unit: '°',
    hints: [RULES.triSum, m(`∠C = 180° − ${A}° − ${B}°`)],
    solution: m(`∠C = 180° − ${A}° − ${B}° = ${C}°`),
  };
}

function adjacent() {
  const a = R(25, 155), s = new Scene();
  s.pt('A', -1, 0).pt('B', 1, 0).pt('O', 0, 0).pt('C', Math.cos(rad(a)), Math.sin(rad(a)))
    .seg('A', 'B').seg('O', 'C').angle('O', 'B', 'C', a + '°').angle('O', 'C', 'A', '?', { unknown: true });
  return {
    grade: 'ו', topic: 'זוויות צמודות',
    q: `הנקודות A, O, B נמצאות על ישר אחד, ${m(`∠BOC = ${a}°`)}. מצא את ${m('∠AOC')}.`,
    svg: s.render(), answer: 180 - a, unit: '°',
    hints: [RULES.adjacent, m(`∠AOC = 180° − ${a}°`)],
    solution: m(`∠AOC = 180° − ${a}° = ${180 - a}°`),
  };
}

// Four angles around a crossing: TR, TL, BL, BR.
const POS = { TR: ['r', 'u'], TL: ['u', 'l'], BL: ['l', 'd'], BR: ['d', 'r'] };
function addCross(s, X, x, y, dir, len = 0.55) {
  s.pt(X, x, y, false)
    .pt(X + 'r', x + len, y, false).pt(X + 'l', x - len, y, false)
    .pt(X + 'u', x + dir[0] * len, y + dir[1] * len, false).pt(X + 'd', x - dir[0] * len, y - dir[1] * len, false);
}

function crossing() {
  let th; do th = R(30, 150); while (Math.abs(th - 90) < 10);
  const dir = [Math.cos(rad(th)), Math.sin(rad(th))], s = new Scene();
  addCross(s, 'O', 0, 0, dir, 1);
  s.line('Ol', 'Or', 0.1).line('Od', 'Ou', 0.1);
  const val = p => (p === 'TR' || p === 'BL' ? th : 180 - th);
  const keys = Object.keys(POS), given = pick(keys);
  let ask; do ask = pick(keys); while (ask === given);
  const opposite = { TR: 'BL', BL: 'TR', TL: 'BR', BR: 'TL' }[given] === ask;
  s.angle('O', 'O' + POS[given][0], 'O' + POS[given][1], val(given) + '°')
   .angle('O', 'O' + POS[ask][0], 'O' + POS[ask][1], '?', { unknown: true });
  return {
    grade: 'ז', topic: 'ישרים נחתכים',
    q: `שני ישרים נחתכים. אחת הזוויות שנוצרו היא ${m(val(given) + '°')}. מצא את הזווית המסומנת ב־?.`,
    svg: s.render(), answer: val(ask), unit: '°',
    hints: opposite
      ? [RULES.vertical, 'הזווית המבוקשת נמצאת מול הזווית הנתונה.']
      : [RULES.adjacent, 'שתי הזוויות יושבות זו ליד זו על אותו ישר: ' + m(`? = 180° − ${val(given)}°`)],
    solution: opposite ? `זוויות קודקודיות: ${m('? = ' + val(ask) + '°')}`
                       : `זוויות צמודות: ${m(`? = 180° − ${val(given)}° = ${val(ask)}°`)}`,
  };
}

function parallel() {
  let th; do th = R(35, 145); while (Math.abs(th - 90) < 12);
  const d = [Math.cos(rad(th)), Math.sin(rad(th))], h = 1.4, lx = -h * d[0] / d[1];
  const s = new Scene();
  addCross(s, 'U', 0, h, d); addCross(s, 'L', lx, 0, d);
  const x0 = Math.min(0, lx) - 1.1, x1 = Math.max(0, lx) + 1.1;
  s.pt('a1', x0, h, false).pt('a2', x1, h, false).pt('b1', x0, 0, false).pt('b2', x1, 0, false)
    .seg('a1', 'a2').seg('b1', 'b2').line('Ld', 'Uu', 0.25)
    .tag(x1 + 0.15, h, 'a', 'pname').tag(x1 + 0.15, 0, 'b', 'pname');
  const val = p => (p === 'TR' || p === 'BL' ? th : 180 - th);
  const pairs = [
    ['TR', 'TR', 'corresponding'], ['TL', 'TL', 'corresponding'], ['BL', 'BL', 'corresponding'], ['BR', 'BR', 'corresponding'],
    ['BL', 'TR', 'alternate'], ['BR', 'TL', 'alternate'],
    ['BR', 'TR', 'coInterior'], ['BL', 'TL', 'coInterior'],
  ];
  const [gu, al, rel] = pick(pairs);
  s.angle('U', 'U' + POS[gu][0], 'U' + POS[gu][1], val(gu) + '°')
   .angle('L', 'L' + POS[al][0], 'L' + POS[al][1], '?', { unknown: true });
  const names = { corresponding: 'מתאימות', alternate: 'מתחלפות', coInterior: 'חד־צדדיות' };
  const how = rel === 'coInterior' ? m(`? = 180° − ${val(gu)}°`) : m(`? = ${val(gu)}°`);
  return {
    grade: 'ח', topic: 'ישרים מקבילים',
    q: `הישרים a ו־b מקבילים ונחתכים על ידי ישר שלישי. מצא את הזווית המסומנת ב־?.`,
    svg: s.render(), answer: val(al), unit: '°',
    hints: [RULES[rel], `הזווית הנתונה והזווית המבוקשת הן זוויות ${names[rel]}: ${how}`],
    solution: `זוויות ${names[rel]}: ${rel === 'coInterior' ? m(`? = 180° − ${val(gu)}° = ${val(al)}°`) : m(`? = ${val(al)}°`)}`,
  };
}

function isosceles() {
  const askBase = Math.random() < 0.5;
  const base = askBase ? null : R(30, 80);
  const apex = askBase ? 2 * R(10, 70) : 180 - 2 * base;
  const b = askBase ? (180 - apex) / 2 : base;
  const [B, C, A] = triFromAngles(b, b), s = new Scene();
  s.pt('B', ...B).pt('C', ...C).pt('A', ...A)
    .seg('A', 'B', { ticks: 1 }).seg('A', 'C', { ticks: 1 }).seg('B', 'C');
  if (askBase) s.angle('A', 'B', 'C', apex + '°').angle('B', 'C', 'A', '?', { unknown: true });
  else s.angle('B', 'C', 'A', b + '°').angle('A', 'B', 'C', '?', { unknown: true });
  return {
    grade: 'ח', topic: 'משולש שווה־שוקיים',
    q: askBase
      ? `במשולש ABC נתון ${m('AB = AC')} ו־${m(`∠A = ${apex}°`)}. מצא את ${m('∠B')}.`
      : `במשולש ABC נתון ${m('AB = AC')} ו־${m(`∠B = ${b}°`)}. מצא את ${m('∠A')}.`,
    svg: s.render(), answer: askBase ? b : apex, unit: '°',
    hints: askBase
      ? [RULES.isosceles, `${m('∠B = ∠C')}, ולכן ${m(`2·∠B + ${apex}° = 180°`)}`]
      : [RULES.isosceles, `${m(`∠C = ∠B = ${b}°`)}, ואז משתמשים בסכום הזוויות במשולש.`],
    solution: askBase ? m(`∠B = (180° − ${apex}°) : 2 = ${b}°`) : m(`∠A = 180° − 2·${b}° = ${apex}°`),
  };
}

function exterior() {
  const Bv = R(30, 80), Cv = R(30, 150 - Bv - 10), Av = 180 - Bv - Cv;
  const [B, C, A] = triFromAngles(Bv, Cv), s = new Scene();
  s.pt('B', ...B).pt('C', ...C).pt('A', ...A).pt('D', 1.7, 0)
    .seg('A', 'B').seg('A', 'C').seg('B', 'D')
    .angle('A', 'B', 'C', Av + '°').angle('B', 'C', 'A', Bv + '°').angle('C', 'D', 'A', '?', { unknown: true });
  return {
    grade: 'ח', topic: 'זווית חיצונית',
    q: `במשולש ABC הצלע BC הוארכה עד D. נתון ${m(`∠A = ${Av}°`)}, ${m(`∠B = ${Bv}°`)}. מצא את ${m('∠ACD')}.`,
    svg: s.render(), answer: Av + Bv, unit: '°',
    hints: [RULES.exterior, m(`∠ACD = ∠A + ∠B`)],
    solution: m(`∠ACD = ${Av}° + ${Bv}° = ${Av + Bv}°`),
  };
}

function polygon() {
  const n = pick([5, 6, 8, 9, 10, 12]), sum = (n - 2) * 180, regular = Math.random() < 0.6;
  const s = new Scene(), names = 'ABCDEFGHIJKL'.split('');
  for (let i = 0; i < n; i++) {
    const r = regular ? 1 : 0.75 + Math.random() * 0.4, a = rad(90 + 360 * i / n);
    s.pt(names[i], r * Math.cos(a), r * Math.sin(a), n <= 8);
  }
  for (let i = 0; i < n; i++) s.seg(names[i], names[(i + 1) % n]);
  const word = { 5: 'מחומש', 6: 'משושה', 8: 'מתומן', 9: 'מצולע בעל 9 צלעות', 10: 'מעושר', 12: 'מצולע בעל 12 צלעות' }[n];
  if (regular) {
    s.angle(names[0], names[1], names[n - 1], '?', { unknown: true });
    return {
      grade: 'ז', topic: 'זוויות במצולע',
      q: `לפניך ${word} משוכלל (${n} צלעות שוות ו־${n} זוויות שוות). מצא את גודל כל זווית פנימית.`,
      svg: s.render(), answer: sum / n, unit: '°',
      hints: [RULES.polygon, `סכום הזוויות: ${m(`(${n}−2)·180° = ${sum}°`)}. כל הזוויות שוות, אז מחלקים ב־${n}.`],
      solution: m(`${sum}° : ${n} = ${sum / n}°`),
    };
  }
  return {
    grade: 'ז', topic: 'זוויות במצולע',
    q: `מה סכום הזוויות הפנימיות ב${word}${word.includes('צלעות') ? '' : ` (${n} צלעות)`}?`,
    svg: s.render(), answer: sum, unit: '°',
    hints: [RULES.polygon, `מציבים ${m('n = ' + n)}: ${m(`(${n}−2)·180°`)}`],
    solution: m(`(${n}−2)·180° = ${sum}°`),
  };
}

function pythagoras() {
  const [p, q, r] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]]);
  const k = p > 7 ? 1 : pick([1, 2, 3]);
  const a = p * k, b = q * k, c = r * k, askHyp = Math.random() < 0.55;
  const s = new Scene();
  s.pt('C', 0, 0).pt('B', b, 0).pt('A', 0, a).right('C', 'B', 'A')
    .seg('C', 'B', { label: b }).seg('C', 'A', askHyp ? { label: a } : { label: '?', unknown: true })
    .seg('A', 'B', askHyp ? { label: '?', unknown: true } : { label: c });
  return {
    grade: 'ח', topic: 'משפט פיתגורס',
    q: askHyp
      ? `במשולש ישר־זווית ABC (${m('∠C = 90°')}) הניצבים הם ${m(`AC = ${a}`)}, ${m(`BC = ${b}`)}. מצא את היתר ${m('AB')}.`
      : `במשולש ישר־זווית ABC (${m('∠C = 90°')}) נתון ${m(`AB = ${c}`)}, ${m(`BC = ${b}`)}. מצא את ${m('AC')}.`,
    svg: s.render(), answer: askHyp ? c : a, unit: '',
    hints: askHyp
      ? [RULES.pythagoras, m(`AB² = ${a}² + ${b}² = ${a * a} + ${b * b}`)]
      : [RULES.pythagoras, m(`AC² = ${c}² − ${b}² = ${c * c} − ${b * b}`)],
    solution: askHyp ? m(`AB² = ${a * a + b * b} ⇒ AB = ${c}`) : m(`AC² = ${a * a} ⇒ AC = ${a}`),
  };
}

function segments() {
  const kind = pick(['sum', 'diff', 'mid']), s = new Scene();
  s.labelsUp = true;
  if (kind === 'mid') {
    const half = R(3, 25), askWhole = Math.random() < 0.5;
    s.pt('A', 0, 0).pt('M', half, 0).pt('B', 2 * half, 0)
      .seg('A', 'M', { ticks: 1, side: -1, label: askWhole ? half : null })
      .seg('M', 'B', { ticks: 1, side: -1, label: askWhole ? null : '?', unknown: !askWhole });
    if (askWhole) s.tag(half, -half * 0.18, 'AB = ?', 'unk');
    else s.tag(half, -half * 0.18, `AB = ${2 * half}`, 'giv');
    return {
      grade: 'ו', topic: 'קטעים',
      q: askWhole ? `M היא אמצע הקטע AB, ו־${m(`AM = ${half}`)}. מה אורך ${m('AB')}?`
                  : `M היא אמצע הקטע AB, ו־${m(`AB = ${2 * half}`)}. מה אורך ${m('MB')}?`,
      svg: s.render(380, 150), answer: askWhole ? 2 * half : half, unit: 'ס״מ',
      hints: [RULES.midpoint, askWhole ? m('AB = 2·AM') : m('MB = AB : 2')],
      solution: askWhole ? m(`AB = 2·${half} = ${2 * half}`) : m(`MB = ${2 * half} : 2 = ${half}`),
    };
  }
  const x = R(3, 20), y = R(3, 20);
  s.pt('A', 0, 0).pt('B', x, 0).pt('C', x + y, 0)
    .seg('A', 'B', { side: -1, label: x }).seg('B', 'C', { side: -1, label: kind === 'sum' ? y : '?', unknown: kind !== 'sum' });
  s.tag((x + y) / 2, -(x + y) * 0.09, kind === 'sum' ? 'AC = ?' : `AC = ${x + y}`, kind === 'sum' ? 'unk' : 'giv');
  return {
    grade: 'ו', topic: 'קטעים',
    q: kind === 'sum'
      ? `הנקודה B נמצאת על הקטע AC. ${m(`AB = ${x}`)}, ${m(`BC = ${y}`)}. מה אורך ${m('AC')}?`
      : `הנקודה B נמצאת על הקטע AC. ${m(`AC = ${x + y}`)}, ${m(`AB = ${x}`)}. מה אורך ${m('BC')}?`,
    svg: s.render(380, 150), answer: kind === 'sum' ? x + y : y, unit: 'ס״מ',
    hints: [RULES.segAdd, kind === 'sum' ? m(`AC = ${x} + ${y}`) : m(`BC = AC − AB = ${x + y} − ${x}`)],
    solution: kind === 'sum' ? m(`AC = ${x + y}`) : m(`BC = ${y}`),
  };
}

function midsegment() {
  const half = R(3, 18), askDE = Math.random() < 0.5;
  const Bv = R(45, 75), Cv = R(45, 75), [B, C, A] = triFromAngles(Bv, Cv);
  const s = new Scene();
  const D = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], E = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
  s.pt('A', ...A).pt('B', ...B).pt('C', ...C).pt('D', ...D).pt('E', ...E)
    .seg('A', 'D', { ticks: 1 }).seg('D', 'B', { ticks: 1 }).seg('A', 'E', { ticks: 2 }).seg('E', 'C', { ticks: 2 })
    .seg('B', 'C', askDE ? { label: 2 * half } : { label: '?', unknown: true })
    .seg('D', 'E', askDE ? { label: '?', unknown: true, side: 1 } : { label: half, side: 1 });
  return {
    grade: 'ח', topic: 'קטע אמצעים',
    q: askDE
      ? `במשולש ABC, הנקודה D היא אמצע AB והנקודה E היא אמצע AC. ${m(`BC = ${2 * half}`)}. מה אורך ${m('DE')}?`
      : `במשולש ABC, הנקודה D היא אמצע AB והנקודה E היא אמצע AC. ${m(`DE = ${half}`)}. מה אורך ${m('BC')}?`,
    svg: s.render(), answer: askDE ? half : 2 * half, unit: 'ס״מ',
    hints: [RULES.midsegment, askDE ? m('DE = BC : 2') : m('BC = 2·DE')],
    solution: askDE ? m(`DE = ${2 * half} : 2 = ${half}`) : m(`BC = 2·${half} = ${2 * half}`),
  };
}

function area() {
  const kind = pick(['rect', 'tri', 'para', 'trap']), s = new Scene();
  if (kind === 'rect') {
    const w = R(3, 15), h = R(2, 12);
    s.pt('A', 0, 0).pt('B', w, 0).pt('C', w, h).pt('D', 0, h)
      .seg('A', 'B', { label: w }).seg('B', 'C', { label: h }).seg('C', 'D').seg('D', 'A').right('A', 'B', 'D');
    return {
      grade: 'ו', topic: 'שטחים', q: `מה שטח המלבן ABCD?`, svg: s.render(), answer: w * h, unit: 'סמ״ר',
      hints: ['שטח מלבן = אורך · רוחב.', m(`S = ${w}·${h}`)], solution: m(`S = ${w}·${h} = ${w * h}`),
    };
  }
  if (kind === 'tri') {
    const b = R(4, 16), h = R(3, 12) , off = R(1, b - 1);
    s.pt('A', 0, 0).pt('B', b, 0).pt('C', off, h).pt('H', off, 0)
      .seg('A', 'B', { label: b }).seg('B', 'C').seg('C', 'A').seg('C', 'H', { dash: true, label: h, side: 1 }).right('H', 'B', 'C');
    if ((b * h) % 2) return area();
    return {
      grade: 'ו', topic: 'שטחים', q: `במשולש ABC, ${m('CH')} הוא הגובה לצלע AB. מה שטח המשולש?`,
      svg: s.render(), answer: b * h / 2, unit: 'סמ״ר',
      hints: ['שטח משולש = (צלע · הגובה אליה) : 2.', m(`S = ${b}·${h} : 2`)], solution: m(`S = ${b * h} : 2 = ${b * h / 2}`),
    };
  }
  if (kind === 'para') {
    const b = R(4, 14), h = R(3, 10), off = R(2, 5);
    s.pt('A', 0, 0).pt('B', b, 0).pt('C', b + off, h).pt('D', off, h).pt('H', off, 0)
      .seg('A', 'B', { label: b }).seg('B', 'C').seg('C', 'D').seg('D', 'A').seg('D', 'H', { dash: true, label: h, side: -1 }).right('H', 'B', 'D');
    return {
      grade: 'ז', topic: 'שטחים', q: `מה שטח המקבילית ABCD? (${m('DH')} הוא גובה)`,
      svg: s.render(), answer: b * h, unit: 'סמ״ר',
      hints: ['שטח מקבילית = צלע · הגובה אליה.', m(`S = ${b}·${h}`)], solution: m(`S = ${b}·${h} = ${b * h}`),
    };
  }
  const a = R(8, 18), c = R(3, a - 2), h = R(3, 10), off = R(1, a - c - 1 || 1);
  if (((a + c) * h) % 2) return area();
  s.pt('A', 0, 0).pt('B', a, 0).pt('C', off + c, h).pt('D', off, h).pt('H', off, 0)
    .seg('A', 'B', { label: a }).seg('B', 'C').seg('C', 'D', { label: c }).seg('D', 'A').seg('D', 'H', { dash: true, label: h, side: -1 }).right('H', 'B', 'D');
  return {
    grade: 'ז', topic: 'שטחים', q: `מה שטח הטרפז ABCD? (${m('AB ∥ DC')}, ${m('DH')} הוא גובה)`,
    svg: s.render(), answer: (a + c) * h / 2, unit: 'סמ״ר',
    hints: ['שטח טרפז = (סכום הבסיסים · הגובה) : 2.', m(`S = (${a} + ${c})·${h} : 2`)],
    solution: m(`S = ${a + c}·${h} : 2 = ${(a + c) * h / 2}`),
  };
}

function circle() {
  const r = R(2, 12), askArea = Math.random() < 0.5, s = new Scene();
  s.pt('O', 0, 0).pt('A', r, 0).circle('O', r).seg('O', 'A', { label: 'r = ' + r, side: 1 });
  const ans = askArea ? +(3.14 * r * r).toFixed(2) : +(2 * 3.14 * r).toFixed(2);
  return {
    grade: 'ו', topic: 'מעגל',
    q: `רדיוס המעגל הוא ${r} ס״מ. מה ${askArea ? 'שטח העיגול' : 'היקף המעגל'}? (השתמש ב־${m('π = 3.14')})`,
    svg: s.render(260, 230), answer: ans, unit: askArea ? 'סמ״ר' : 'ס״מ', tol: 0.05,
    hints: [RULES.circle, askArea ? m(`S = 3.14·${r}²`) : m(`P = 2·3.14·${r}`)],
    solution: askArea ? m(`S = 3.14·${r * r} = ${ans}`) : m(`P = 6.28·${r} = ${ans}`),
  };
}

function bisector() {
  const half = R(15, 70), askWhole = Math.random() < 0.5, s = new Scene();
  s.pt('B', 0, 0).pt('C', 1.5, 0).pt('D', 1.5 * Math.cos(rad(half)), 1.5 * Math.sin(rad(half)))
    .pt('A', 1.5 * Math.cos(rad(2 * half)), 1.5 * Math.sin(rad(2 * half)))
    .seg('B', 'C').seg('B', 'A').seg('B', 'D', { dash: true });
  if (askWhole) s.angle('B', 'D', 'A', half + '°', { r: 30 }).angle('B', 'C', 'A', '?', { unknown: true, r: 58 });
  else s.angle('B', 'C', 'A', 2 * half + '°', { r: 58 }).angle('B', 'C', 'D', '?', { unknown: true, r: 30 });
  return {
    grade: 'ז', topic: 'חוצה זווית',
    q: askWhole ? `${m('BD')} חוצה את ${m('∠ABC')}, ו־${m(`∠ABD = ${half}°`)}. מצא את ${m('∠ABC')}.`
                : `${m('BD')} חוצה את ${m('∠ABC')}, ו־${m(`∠ABC = ${2 * half}°`)}. מצא את ${m('∠DBC')}.`,
    svg: s.render(), answer: askWhole ? 2 * half : half, unit: '°',
    hints: [RULES.bisector, askWhole ? m('∠ABC = 2·∠ABD') : m('∠DBC = ∠ABC : 2')],
    solution: askWhole ? m(`∠ABC = 2·${half}° = ${2 * half}°`) : m(`∠DBC = ${2 * half}° : 2 = ${half}°`),
  };
}

function triangleX() {
  const ks = pick([[1, 2, 3], [2, 3, 4], [1, 1, 2], [1, 2, 6], [2, 3, 5], [1, 3, 5], [3, 4, 5], [1, 4, 7], [2, 2, 5]]);
  const sum = ks[0] + ks[1] + ks[2], x = 180 / sum;
  const lbl = k => (k === 1 ? 'x' : k + 'x');
  const [a, b, c] = triFromAngles(ks[0] * x, ks[1] * x), s = new Scene();
  s.pt('A', ...a).pt('B', ...b).pt('C', ...c).seg('A', 'B').seg('B', 'C').seg('C', 'A')
    .angle('A', 'B', 'C', lbl(ks[0])).angle('B', 'C', 'A', lbl(ks[1])).angle('C', 'A', 'B', lbl(ks[2]));
  return {
    grade: 'ז', topic: 'זוויות ומשוואה',
    q: `זוויות המשולש מסומנות בשרטוט. מצא את ${m('x')} (במעלות).`,
    svg: s.render(), answer: x, unit: '°',
    hints: [RULES.triSum, m(`${lbl(ks[0])} + ${lbl(ks[1])} + ${lbl(ks[2])} = 180 ⇒ ${sum}x = 180`)],
    solution: m(`${sum}x = 180 ⇒ x = ${x}`),
  };
}

// ---- Algebra and arithmetic ----
function linear() {
  const x = R(-9, 12), a = R(2, 9);
  if (Math.random() < 0.6) {
    let b; do b = R(-20, 20); while (!b);
    const c = a * x + b;
    return {
      grade: 'ז', topic: 'משוואות', q: `פתור את המשוואה: ${m(`${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${neg(c)}`)}`,
      answer: x, unit: '',
      hints: ['כדי לבודד את x מבצעים את אותה פעולה בשני האגפים: קודם מעבירים את המספר החופשי, אחר כך מחלקים במקדם של x.',
              m(`${a}x = ${neg(c)} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${neg(c - b)}`)],
      solution: m(`${a}x = ${neg(c - b)} ⇒ x = ${neg(x)}`),
    };
  }
  let c; do c = R(1, 8); while (c === a);
  let b; do b = R(-15, 15); while (!b);
  const d = a * x + b - c * x;
  return {
    grade: 'ח', topic: 'משוואות',
    q: `פתור את המשוואה: ${m(`${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c === 1 ? '' : c}x ${d < 0 ? '−' : '+'} ${Math.abs(d)}`)}`,
    answer: x, unit: '',
    hints: ['מעבירים את כל האיברים עם x לאגף אחד ואת המספרים לאגף השני (מעבר אגף הופך סימן).',
            m(`${a}x − ${c}x = ${neg(d)} − ${par(b)} ⇒ ${neg(a - c)}x = ${neg(d - b)}`)],
    solution: m(`${neg(a - c)}x = ${neg(d - b)} ⇒ x = ${neg(x)}`),
  };
}

function negatives() {
  const kind = pick(['add', 'mul', 'div']);
  if (kind === 'add') {
    const a = R(-15, 15), b = R(-15, 15), c = R(-15, 15);
    return {
      grade: 'ז', topic: 'מספרים מכוונים', q: `חשב: ${m(`${par(a)} + ${par(b)} − ${par(c)}`)}`, answer: a + b - c, unit: '',
      hints: ['חיסור של מספר שלילי הוא חיבור: ' + m('−(−3) = +3') + '. חיבור מספר שלילי הוא חיסור.',
              m(`${par(a)} + ${par(b)} ${c < 0 ? '+ ' + Math.abs(c) : '− ' + c}`)],
      solution: m(`= ${neg(a + b - c)}`),
    };
  }
  const a = R(-12, 12) || 3, b = R(-9, 9) || -4;
  if (kind === 'mul') return {
    grade: 'ז', topic: 'מספרים מכוונים', q: `חשב: ${m(`${par(a)} · ${par(b)}`)}`, answer: a * b, unit: '',
    hints: ['חוק הסימנים: פלוס כפול פלוס ומינוס כפול מינוס נותנים פלוס; מינוס כפול פלוס נותן מינוס.',
            `קודם קובעים את הסימן, ואז כופלים: ${m(`${Math.abs(a)}·${Math.abs(b)} = ${Math.abs(a * b)}`)}`],
    solution: m(`${par(a)} · ${par(b)} = ${neg(a * b)}`),
  };
  return {
    grade: 'ז', topic: 'מספרים מכוונים', q: `חשב: ${m(`${par(a * b)} : ${par(b)}`)}`, answer: a, unit: '',
    hints: ['חוק הסימנים בחילוק זהה לכפל: סימנים שווים נותנים פלוס, סימנים שונים נותנים מינוס.',
            `קודם קובעים את הסימן, ואז מחלקים: ${m(`${Math.abs(a * b)} : ${Math.abs(b)} = ${Math.abs(a)}`)}`],
    solution: m(`= ${neg(a)}`),
  };
}

function orderOps() {
  const a = R(2, 20), b = R(2, 6), c = R(5, 12), d = R(1, c - 1), sq = Math.random() < 0.4;
  const inner = c - d, val = a + b * (sq ? inner * inner : inner);
  return {
    grade: 'ו', topic: 'סדר פעולות', q: `חשב: ${m(`${a} + ${b} · (${c} − ${d})${sq ? '²' : ''}`)}`, answer: val, unit: '',
    hints: ['סדר פעולות חשבון: סוגריים ← חזקות ← כפל וחילוק ← חיבור וחיסור.',
            m(`(${c} − ${d}) = ${inner}${sq ? `, ${inner}² = ${inner * inner}` : ''}`)],
    solution: m(`${a} + ${b}·${sq ? inner * inner : inner} = ${a} + ${b * (sq ? inner * inner : inner)} = ${val}`),
  };
}

function percent() {
  const p = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]), n = 20 * R(1, 15);
  if ((n * p) % 100) return percent();
  if (Math.random() < 0.5) return {
    grade: 'ו', topic: 'אחוזים', q: `כמה זה ${m(`${p}%`)} מ־${m(n)}?`, answer: n * p / 100, unit: '',
    hints: ['אחוז הוא חלק אחד ממאה: ' + m('p% מ־N = N · p : 100') + '.', m(`${n} · ${p} : 100`)],
    solution: m(`${n}·${p} : 100 = ${n * p / 100}`),
  };
  return {
    grade: 'ז', topic: 'אחוזים', q: `מחיר חולצה ${n} ₪. בהנחה של ${m(`${p}%`)}, כמה תעלה החולצה?`, answer: n - n * p / 100, unit: '₪',
    hints: ['מחשבים כמה שקלים היא ההנחה (' + m('N · p : 100') + ') ומחסירים מהמחיר.', `ההנחה: ${m(`${n}·${p} : 100 = ${n * p / 100}`)} ₪`],
    solution: m(`${n} − ${n * p / 100} = ${n - n * p / 100}`),
  };
}

function fractions() {
  const b = pick([2, 3, 4, 5, 6, 8]), d = pick([3, 4, 6, 8, 10, 12].filter(x => x !== b));
  const a = R(1, b - 1), c = R(1, d - 1), sub = Math.random() < 0.4 && a / b > c / d;
  const L = b * d / gcd(b, d), num = a * (L / b) + (sub ? -1 : 1) * c * (L / d), g = gcd(num, L);
  const sym = sub ? '−' : '+';
  return {
    grade: 'ו', topic: 'שברים', q: `חשב: ${m(`${frac(a, b)} ${sym} ${frac(c, d)}`)} <small>(אפשר לכתוב תשובה כמו 7/12)</small>`,
    answer: num / L, unit: '', tol: 0.01,
    hints: ['כדי לחבר או לחסר שברים מביאים אותם למכנה משותף.',
            `מכנה משותף ${L}: ${m(`${frac(a * L / b, L)} ${sym} ${frac(c * L / d, L)}`)}`],
    solution: m(`= ${frac(num, L)}${g > 1 ? ` = ${frac(num / g, L / g)}` : ''}`),
  };
}

function ratio() {
  const a = R(1, 7), b = R(a + 1, 9), unitPart = R(2, 12), total = (a + b) * unitPart;
  return {
    grade: 'ז', topic: 'יחס', q: `נבו וחבר חילקו ${total} קלפים ביחס ${m(`${a} : ${b}`)}. כמה קלפים קיבל זה שקיבל יותר?`,
    answer: b * unitPart, unit: '',
    hints: ['ביחס ' + m(`${a} : ${b}`) + ' יש ' + (a + b) + ' חלקים שווים. מחלקים את הכמות במספר החלקים.',
            `חלק אחד: ${m(`${total} : ${a + b} = ${unitPart}`)}`],
    solution: m(`${b}·${unitPart} = ${b * unitPart}`),
  };
}

function powers() {
  const kind = pick(['pow', 'sq', 'root', 'cube']);
  if (kind === 'pow') { const e = R(3, 8); return {
    grade: 'ז', topic: 'חזקות', q: `חשב: ${m(`2<sup>${e}</sup>`)}`, answer: 2 ** e, unit: '',
    hints: ['חזקה היא כפל חוזר: ' + m('2³ = 2·2·2') + '.', m(Array(e).fill(2).join('·'))], solution: m(`= ${2 ** e}`) }; }
  const n = R(4, 15);
  if (kind === 'sq') return { grade: 'ו', topic: 'חזקות', q: `חשב: ${m(`${n}²`)}`, answer: n * n, unit: '',
    hints: ['ריבוע של מספר הוא המספר כפול עצמו.', m(`${n}·${n}`)], solution: m(`= ${n * n}`) };
  if (kind === 'root') return { grade: 'ח', topic: 'שורשים', q: `חשב: ${m(`√${n * n}`)}`, answer: n, unit: '',
    hints: ['שורש ריבועי של מספר הוא המספר החיובי שבריבוע נותן אותו.', `איזה מספר כפול עצמו נותן ${n * n}?`], solution: m(`${n}·${n} = ${n * n}`) };
  const k = R(2, 6);
  return { grade: 'ז', topic: 'חזקות', q: `חשב: ${m(`${k}³`)}`, answer: k ** 3, unit: '',
    hints: ['חזקה היא כפל חוזר: ' + m('a³ = a·a·a') + '.', m(`${k}·${k}·${k}`)], solution: m(`= ${k ** 3}`) };
}

function substitute() {
  const p = R(2, 6), q = R(2, 5), a = R(-6, 8) || 2, b = R(-6, 6) || -1;
  return {
    grade: 'ז', topic: 'הצבה', q: `חשב את ${m(`${p}a − ${q}b`)} כאשר ${m(`a = ${neg(a)}`)}, ${m(`b = ${neg(b)}`)}.`,
    answer: p * a - q * b, unit: '',
    hints: ['מציבים את הערכים במקום האותיות (מספר שלילי בתוך סוגריים), ואז מחשבים לפי סדר פעולות.',
            m(`${p}·${par(a)} − ${q}·${par(b)}`)],
    solution: m(`${neg(p * a)} − ${par(q * b)} = ${neg(p * a - q * b)}`),
  };
}

const GEO = [triSum, adjacent, crossing, parallel, isosceles, exterior, polygon, pythagoras, segments, midsegment, area, circle, bisector, triangleX];
const ALG = [linear, negatives, orderOps, percent, fractions, ratio, powers, substitute];

let lastGen = null;
function next(filter) {
  const pool = filter === 'geo' ? GEO : filter === 'alg' ? ALG : [...GEO, ...ALG];
  let gen; do gen = pick(pool); while (pool.length > 1 && gen === lastGen);
  lastGen = gen;
  const ex = gen();
  ex.area = GEO.includes(gen) ? 'גאומטריה' : 'אלגברה וחשבון';
  return ex;
}

// Accepts integers, decimals and fractions such as 7/12 or −3.
function parse(str) {
  const s = str.replace('−', '-').trim();
  if (/^-?\d+\/\d+$/.test(s)) { const [n, d] = s.split('/').map(Number); return d ? n / d : NaN; }
  if (/^-?\d*\.?\d+$/.test(s)) return Number(s);
  return NaN;
}
function check(ex, str) {
  const v = parse(str);
  return !Number.isNaN(v) && Math.abs(v - ex.answer) <= (ex.tol || 1e-6);
}

window.NevoMath = { next, check, parse };
})();
