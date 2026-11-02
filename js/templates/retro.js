// Music-room objects, re-composed for wide videos, Shorts and square covers.
import { TAU, mix, rgba, formatTime } from '../helpers.js';
import { look, fill, photo, rect, rule, dot, ring, wave, progress, label, record, words, PAPER, INK, CREAM } from './studio-shared.js';

const sleeve = look({
  id: 'sleeve-notes', name: 'Sleeve Notes', ne: 'रेकर्डको खोल', cat: 'retro',
  description: 'Your album sleeve, with a slowly turning record.', descriptionNe: 'फोटोको खोलबाट निस्केको घुम्ने रेकर्ड।',
  tags: ['vintage', 'album', 'vinyl', 'warm'],
  text: (f) => words(f, f.portrait || f.square
    ? { y: 0.77, color: INK, font: 'martel', size: 0.06 }
    : { x: 0.64, y: 0.38, subY: 0.51, width: 0.30, align: 'left', color: INK, font: 'martel', size: 0.06 }),
  draw(ctx, f) {
    fill(ctx, f, '#e5dcc7');
    const stacked = f.portrait || f.square, d = f.s * (f.square ? 0.48 : stacked ? 0.57 : 0.59);
    const x = stacked ? f.w * 0.12 : f.w * 0.07, y = stacked ? f.h * (f.square ? 0.14 : 0.20) : (f.h - d) / 2;
    record(ctx, f, x + d * 0.92, y + d * 0.50, d * 0.46);
    rect(ctx, x - f.s * 0.012, y - f.s * 0.012, d + f.s * 0.024, d + f.s * 0.024, CREAM);
    photo(ctx, f, x, y, d, d);
    if (stacked) {
      wave(ctx, f, f.w * 0.35, f.h * 0.68, f.w * 0.30, f.s * 0.018, '#7c5434');
      progress(ctx, f, f.w * 0.25, f.h * 0.91, f.w * 0.5, INK);
    }
    else {
      wave(ctx, f, f.w * 0.64, f.h * 0.65, f.w * 0.28, f.s * 0.025, '#7c5434');
      label(ctx, f, formatTime(f.t), f.w * 0.64, f.h * 0.73, '#685f4d');
    }
  },
});

const cassette = look({
  id: 'mixtape', name: 'Mixtape', ne: 'मिक्सटेप', cat: 'retro',
  description: 'A photo-label cassette with moving tape reels.', descriptionNe: 'फोटो टाँसिएको क्यासेट र घुम्ने रिल।',
  tags: ['vintage', 'cassette', 'warm', 'playful'],
  text: (f) => words(f, { y: f.portrait ? 0.71 : 0.80, color: INK, font: 'kalam', size: 0.075 }),
  draw(ctx, f) {
    fill(ctx, f, '#e8bd85');
    const w = Math.min(f.w * 0.84, f.s), h = w * 0.61;
    const x = (f.w - w) / 2, y = f.h * (f.portrait ? 0.23 : 0.10);
    rect(ctx, x, y, w, h, '#333c35', f.s * 0.025);
    const inset = w * 0.045;
    photo(ctx, f, x + inset, y + h * 0.09, w - 2 * inset, h * 0.47, { radius: w * 0.012 });
    rect(ctx, x + inset, y + h * 0.57, w - 2 * inset, h * 0.14, '#e4d6b4');
    wave(ctx, f, x + w * 0.10, y + h * 0.64, w * 0.80, h * 0.04, INK);
    rect(ctx, x + w * 0.19, y + h * 0.30, w * 0.62, h * 0.25, '#20261f', h * 0.125);
    for (const cx of [x + w * 0.29, x + w * 0.71]) {
      const cy = y + h * 0.425, r = h * 0.092;
      dot(ctx, cx, cy, r, '#e8dfc9');
      ring(ctx, cx, cy, r * 0.6, '#8b917e', f.s * 0.005);
      for (let j = 0; j < 6; j++) {
        const a = f.t * 0.7 + j * TAU / 6;
        rule(ctx, cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38,
          cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, '#333c35', r * 0.17);
      }
      dot(ctx, cx, cy, r * 0.28, '#333c35');
    }
    rect(ctx, x + w * 0.27, y + h * 0.82, w * 0.46, h * 0.13, '#20261f', f.s * 0.01);
    for (const dx of [0.04, 0.96]) for (const dy of [0.06, 0.94]) dot(ctx, x + w * dx, y + h * dy, w * 0.005, '#c2c3ad');
  },
});

function meter(ctx, f, x, y, w, h, value) {
  rect(ctx, x, y, w, h, '#e8d5a7', f.s * 0.008);
  const r = Math.min(w * 0.40, h * 0.78);
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (1.18 + i / 12 * 0.64);
    rule(ctx, x + w / 2 + Math.cos(a) * r, y + h * 0.91 + Math.sin(a) * r,
      x + w / 2 + Math.cos(a) * r * 0.89, y + h * 0.91 + Math.sin(a) * r * 0.89, i > 9 ? '#9a362b' : '#61563d', f.s * 0.002);
  }
  const a = Math.PI * (1.2 + value * 0.6);
  rule(ctx, x + w / 2, y + h * 0.91, x + w / 2 + Math.cos(a) * r * 0.9,
    y + h * 0.91 + Math.sin(a) * r * 0.9, '#a7452f', f.s * 0.003);
  dot(ctx, x + w / 2, y + h * 0.91, w * 0.022, '#61563d');
}

const tapeDeck = look({
  id: 'listening-room', name: 'Listening Room', ne: 'सङ्गीत कोठा', cat: 'retro',
  description: 'Warm analogue meters and an album on the shelf.', descriptionNe: 'पुरानो मिटरको चालसँगै एल्बमको फोटो।',
  tags: ['vintage', 'radio', 'album', 'warm'],
  text: (f) => words(f, { y: f.portrait ? 0.74 : 0.80, size: 0.062, color: '#f3e3be' }),
  draw(ctx, f) {
    fill(ctx, f, '#272b25');
    const p = f.portrait || f.square, d = f.s * (f.square ? 0.42 : p ? 0.6 : 0.44);
    const x = p ? (f.w - d) / 2 : f.w * 0.12, y = f.h * (f.square ? 0.08 : p ? 0.10 : 0.17);
    photo(ctx, f, x, y, d, d);
    const mx = p ? f.w * 0.15 : f.w * 0.47, my = f.h * (f.square ? 0.57 : p ? 0.51 : 0.25);
    const mw = f.w * (p ? 0.33 : 0.18), mh = f.s * (f.square ? 0.11 : 0.15);
    meter(ctx, f, mx, my, mw, mh, f.a.bass);
    meter(ctx, f, mx + mw + f.w * 0.025, my, mw, mh, f.a.mid);
    const yy = my + mh + f.s * 0.045;
    wave(ctx, f, mx, yy, mw * 2 + f.w * 0.025, f.s * 0.016, '#d5a966');
    rule(ctx, f.w * 0.08, f.h * 0.93, f.w * 0.92, f.h * 0.93, '#605b43', f.s * 0.002);
  },
});

const contact = look({
  id: 'contact-sheet', name: 'Contact Sheet', ne: 'फोटो पाना', cat: 'retro',
  description: 'Three crops from one photo, like a roll of film.', descriptionNe: 'एउटै फोटोका तीन भाग, फिल्मको पानाजस्तै।',
  tags: ['vintage', 'film', 'photo', 'collage'],
  text: (f) => words(f, { x: 0.075, y: 0.80, width: 0.85, align: 'left', color: INK, size: 0.069 }),
  draw(ctx, f) {
    fill(ctx, f, PAPER);
    const p = f.portrait, gap = f.s * 0.02, x = f.w * 0.065, y = f.h * 0.09;
    const totalW = f.w * 0.87, totalH = f.h * 0.59;
    rect(ctx, x, y, totalW, totalH, '#272923');
    for (let i = 0; i < 3; i++) {
      const cw = p ? totalW - gap * 2 : (totalW - gap * 4) / 3;
      const ch = p ? (totalH - gap * 4) / 3 : totalH - gap * 4;
      const px = x + gap + (p ? 0 : i * (cw + gap));
      const py = y + (p ? gap + i * (ch + gap) : gap * 2);
      photo(ctx, f, px, py, cw, ch, { kind: i === 0 ? 'gray' : 'sharp', zoom: 0.04 + i * 0.3 });
    }
    if (!p) for (let i = 0; i < 24; i++) {
      rect(ctx, x + totalW * (i + 0.3) / 24, y + gap * 0.4, totalW / 44, gap * 0.7, PAPER, gap * 0.15);
      rect(ctx, x + totalW * (i + 0.3) / 24, y + totalH - gap * 1.1, totalW / 44, gap * 0.7, PAPER, gap * 0.15);
    }
    const accent = mix(f.color.accent, INK, 0.55);
    wave(ctx, f, x, f.h * 0.72, totalW, f.s * 0.012, accent);
    progress(ctx, f, x, f.h * 0.735, totalW, accent);
  },
});

const postcard = look({
  id: 'postcard', name: 'Postcard', ne: 'सम्झनाको चिठी', cat: 'retro',
  description: 'A photograph and a handwritten dedication.', descriptionNe: 'तस्बिरसँगै हातले लेखेजस्तो गीतको नाम।',
  tags: ['vintage', 'paper', 'romantic', 'photo'],
  text: (f) => words(f, f.portrait || f.square
    ? { y: 0.75, color: '#554c39', font: 'kalam', size: 0.073 }
    : { x: 0.74, y: 0.47, subY: 0.60, width: 0.34, color: '#554c39', font: 'kalam', size: 0.068 }),
  draw(ctx, f) {
    fill(ctx, f, '#bbb49c');
    const p = f.portrait || f.square;
    rect(ctx, f.w * 0.04, f.h * 0.06, f.w * 0.92, f.h * 0.88, '#f5edda');
    photo(ctx, f, f.w * 0.065, f.h * 0.09, f.w * (p ? 0.87 : 0.46), f.h * (p ? 0.52 : 0.82));
    if (!p) {
      rule(ctx, f.w * 0.56, f.h * 0.14, f.w * 0.56, f.h * 0.86, '#c8bda4', f.s * 0.0018);
      photo(ctx, f, f.w * 0.855, f.h * 0.13, f.s * 0.095, f.s * 0.12, { kind: 'gray' });
      ring(ctx, f.w * 0.84, f.h * 0.22, f.s * 0.048, rgba('#796d50', 0.45), f.s * 0.002);
    }
    const x = f.w * (p ? 0.25 : 0.62), y = f.h * (p ? 0.87 : 0.77);
    wave(ctx, f, x, y, f.w * (p ? 0.50 : 0.27), f.s * 0.017, '#927c56');
  },
});

export default [sleeve, cassette, tapeDeck, contact, postcard];
