// Contemporary Nepali compositions with generous space for Devanagari titles.
import { rgba } from '../helpers.js';
import { look, fill, photo, archPhoto, rect, rule, dot, ring, eq, wave, words } from './studio-shared.js';

const sunko = look({
  id: 'sunko-frame', name: 'Sunko Frame', ne: 'सुनको घेरा', cat: 'nepali',
  description: 'A restrained gold frame on deep maroon.', descriptionNe: 'गाढा मरुनमा सादा सुनौलो घेरा।',
  tags: ['traditional', 'gold', 'elegant', 'photo'],
  text: (f) => words(f, { y: 0.79, font: 'yatra', color: '#f6dfac', size: 0.073 }),
  draw(ctx, f) {
    fill(ctx, f, '#351f24');
    const x = f.w * 0.095, y = f.h * 0.09, w = f.w * 0.81, h = f.h * 0.58, pad = f.s * 0.016;
    photo(ctx, f, x, y, w, h);
    ctx.strokeStyle = '#aa8650'; ctx.lineWidth = f.s * 0.002;
    ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
    const len = f.s * 0.06;
    for (const dx of [0, 1]) for (const dy of [0, 1]) {
      const cx = x + dx * w, cy = y + dy * h;
      rule(ctx, cx, cy + (dy ? -len : len), cx, cy, '#f3d7a3', f.s * 0.005);
      rule(ctx, cx, cy, cx + (dx ? -len : len), cy, '#f3d7a3', f.s * 0.005);
    }
    wave(ctx, f, f.w * 0.32, f.h * 0.94, f.w * 0.36, f.s * 0.018, '#d4af70');
  },
});

const radio = look({
  id: 'sajha-radio', name: 'Sajha Radio', ne: 'साँझको रेडियो', cat: 'nepali',
  description: 'A familiar radio face for favourite old songs.', descriptionNe: 'मन पर्ने पुराना गीतका लागि रेडियोको रूप।',
  tags: ['traditional', 'vintage', 'radio', 'warm'],
  text: (f) => words(f, { y: f.portrait ? 0.74 : 0.80, color: '#efe2be', font: 'yatra', size: 0.071 }),
  draw(ctx, f) {
    fill(ctx, f, '#344337');
    const w = Math.min(f.w * 0.86, f.s * 1.18), h = w * 0.49;
    const x = (f.w - w) / 2, y = f.h * (f.portrait ? 0.25 : 0.13);
    rect(ctx, x, y, w, h, '#ad7851', f.s * 0.025);
    rect(ctx, x + w * 0.025, y + h * 0.05, w * 0.95, h * 0.89, '#e6d5b2', f.s * 0.016);
    const r = h * 0.36, cx = x + w * 0.245, cy = y + h * 0.49;
    dot(ctx, cx, cy, r * 1.08, '#5c593f');
    photo(ctx, f, cx - r, cy - r, r * 2, r * 2, { radius: r });
    ring(ctx, cx, cy, r * 1.02, '#ebca80', f.s * 0.004);
    const tx = x + w * 0.49, ty = y + h * 0.23, tw = w * 0.43;
    rect(ctx, tx, ty, tw, h * 0.26, '#384235', f.s * 0.006);
    for (let i = 0; i < 25; i++) rule(ctx, tx + tw * (0.06 + i / 24 * 0.88), ty + h * 0.05,
      tx + tw * (0.06 + i / 24 * 0.88), ty + h * (i % 4 ? 0.12 : 0.17), '#c6bc88', f.s * 0.0014);
    const head = tx + tw * (0.08 + f.progress * 0.84);
    rule(ctx, head, ty + h * 0.025, head, ty + h * 0.23, '#e78951', f.s * 0.005);
    for (const v of [0.55, 0.86]) {
      dot(ctx, x + w * v, y + h * 0.72, h * 0.11, '#5c593f');
      ring(ctx, x + w * v, y + h * 0.72, h * 0.085, '#c6b689', f.s * 0.002);
    }
    eq(ctx, f, x + w * 0.64, y + h * 0.76, w * 0.13, h * 0.10, '#5c593f', { n: 9 });
  },
});

const mithila = look({
  id: 'mithila-frame', name: 'Mithila Frame', ne: 'मिथिला फ्रेम', cat: 'nepali',
  description: 'Ink-red geometry around a paper-mounted photo.', descriptionNe: 'कागजमा रातो बुट्टाले घेरिएको फोटो।',
  tags: ['traditional', 'pattern', 'paper', 'light'],
  text: (f) => words(f, { y: 0.77, font: 'rozha', size: 0.076, color: '#722c2b' }),
  draw(ctx, f) {
    fill(ctx, f, '#f3e5ca');
    const ink = '#9b4140', x = f.w * 0.12, y = f.h * 0.13, w = f.w * 0.76, h = f.h * 0.48;
    photo(ctx, f, x, y, w, h);
    ctx.strokeStyle = ink; ctx.lineWidth = f.s * 0.002;
    ctx.strokeRect(f.w * 0.045, f.h * 0.04, f.w * 0.91, f.h * 0.92);
    const count = Math.max(8, Math.round(f.w / f.s * 18));
    for (const yy of [f.h * 0.075, f.h * 0.925]) for (let i = 0; i < count; i++) {
      const cx = f.w * (0.075 + i / (count - 1) * 0.85), r = f.s * 0.012;
      ctx.beginPath(); ctx.moveTo(cx, yy - r); ctx.lineTo(cx + r, yy); ctx.lineTo(cx, yy + r); ctx.lineTo(cx - r, yy); ctx.closePath();
      ctx.strokeStyle = ink; ctx.stroke(); dot(ctx, cx, yy, r * 0.23, ink);
    }
    for (const xx of [f.w * 0.075, f.w * 0.925]) for (let j = 0; j < 12; j++) {
      dot(ctx, xx, f.h * (0.14 + j * 0.064), f.s * 0.0035, ink);
    }
    eq(ctx, f, f.w * 0.36, f.h * 0.68, f.w * 0.28, f.s * 0.032, ink, { n: 22, center: true });
  },
});

const chautari = look({
  id: 'chautari', name: 'Chautari', ne: 'चौतारी', cat: 'nepali',
  description: 'An arched photograph, forest green and brass.', descriptionNe: 'हरियो पृष्ठभूमिमा मेहराबभित्रको फोटो।',
  tags: ['traditional', 'quiet', 'arch', 'green'],
  text: (f) => words(f, f.portrait || f.square
    ? { y: 0.78, font: 'yatra', color: '#f2e5bd', size: 0.069 }
    : { x: 0.70, y: 0.43, subY: 0.56, width: 0.43, font: 'yatra', color: '#f2e5bd', size: 0.076 }),
  draw(ctx, f) {
    fill(ctx, f, '#213d35');
    const p = f.portrait || f.square;
    const w = f.s * (p ? 0.56 : 0.48), h = f.s * (f.portrait ? 0.91 : p ? 0.56 : 0.75);
    const x = p ? (f.w - w) / 2 : f.w * 0.10, y = f.h * (f.portrait ? 0.16 : 0.10);
    for (let i = 3; i >= 1; i--) {
      const gap = f.s * 0.018 * i;
      ctx.beginPath(); ctx.moveTo(x - gap, y + h);
      ctx.lineTo(x - gap, y + w / 2);
      ctx.arc(x + w / 2, y + w / 2, w / 2 + gap, Math.PI, 0);
      ctx.lineTo(x + w + gap, y + h);
      ctx.strokeStyle = rgba('#bca86d', i === 1 ? 0.85 : 0.3); ctx.lineWidth = f.s * 0.002; ctx.stroke();
    }
    archPhoto(ctx, f, x, y, w, h);
    const wx = f.w * (p ? 0.30 : 0.56), wy = f.h * (p ? 0.93 : 0.73);
    wave(ctx, f, wx, wy, f.w * (p ? 0.40 : 0.28), f.s * 0.025, '#cfb974');
  },
});

const lok = look({
  id: 'lok-rang', name: 'Lok Rang', ne: 'लोक रङ', cat: 'nepali',
  description: 'A bold folk-music poster in vermilion and cream.', descriptionNe: 'सिन्दूरी रङमा लोकगीतको पोस्टर।',
  tags: ['traditional', 'poster', 'bold', 'folk'],
  text: (f) => words(f, f.portrait
    ? { x: 0.10, y: 0.75, subY: 0.82, align: 'left', width: 0.80, color: '#4b221b', font: 'yatra', size: 0.085 }
    : { x: 0.09, y: 0.38, subY: 0.51, align: 'left', width: 0.38, color: '#4b221b', font: 'yatra', size: 0.085 }),
  draw(ctx, f) {
    fill(ctx, f, '#f2dcac');
    const p = f.portrait;
    rect(ctx, f.w * (p ? 0 : 0.51), 0, f.w * (p ? 1 : 0.49), f.h * (p ? 0.64 : 1), '#a8432e');
    const x = f.w * (p ? 0.10 : 0.55), y = f.h * 0.08, w = f.w * (p ? 0.80 : 0.40), h = f.h * (p ? 0.50 : 0.84);
    photo(ctx, f, x, y, w, h);
    const bx = f.w * (p ? 0.10 : 0.09), by = f.h * (p ? 0.91 : 0.71), bw = f.w * (p ? 0.8 : 0.33);
    eq(ctx, f, bx, by, bw, f.s * 0.075, '#a8432e', { n: 25 });
    rule(ctx, bx, by + f.s * 0.016, bx + bw, by + f.s * 0.016, '#a8432e', f.s * 0.002);
  },
});

export default [sunko, radio, mithila, chautari, lok];
