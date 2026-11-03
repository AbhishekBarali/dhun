import { TAU, mix, rgba } from '../helpers.js';
import { look, fill, photo, rect, dot, ring, eq, wave, progress, words, INK, CREAM } from './studio-shared.js';

const colorBlock = look({
  id: 'color-block', name: 'Color Block', ne: 'रङ्गीन खण्ड', cat: 'hiphop',
  description: 'Confident blocks of colour with a punchy photo crop.', descriptionNe: 'गाढा रङका खण्ड र आकर्षक फोटो।',
  tags: ['bold', 'poster', 'colour', 'graphic'],
  text: (f) => words(f, f.portrait
    ? { x: 0.09, y: 0.76, subY: 0.84, align: 'left', width: 0.82, color: INK, font: 'khand', size: 0.095 }
    : { x: 0.08, y: 0.39, subY: 0.53, align: 'left', width: 0.39, color: INK, font: 'khand', size: 0.10 }),
  draw(ctx, f) {
    fill(ctx, f, mix(f.color.accent, '#fff2cd', 0.64));
    const p = f.portrait;
    photo(ctx, f, f.w * (p ? 0.07 : 0.53), f.h * 0.06, f.w * (p ? 0.86 : 0.42), f.h * (p ? 0.56 : 0.88));
    rect(ctx, f.w * (p ? 0.07 : 0.53), f.h * (p ? 0.57 : 0.85), f.w * (p ? 0.20 : 0.10), f.h * 0.05, '#232922');
    eq(ctx, f, f.w * (p ? 0.09 : 0.08), f.h * (p ? 0.94 : 0.77), f.w * (p ? 0.82 : 0.34), f.s * 0.09, INK, { n: 24 });
  },
});

const orbit = look({
  id: 'orbit-pop', name: 'Orbit Pop', ne: 'रङ्गीन परिक्रमा', cat: 'dance',
  description: 'A circular photo with playful orbiting colour.', descriptionNe: 'गोलो फोटोवरिपरि घुम्ने रमाइला रङ।',
  tags: ['playful', 'colour', 'circle', 'pop'],
  text: (f) => words(f, { y: 0.80, subY: 0.89, color: '#272f41', font: 'baloo', size: 0.077 }),
  draw(ctx, f) {
    fill(ctx, f, '#e5e9ee');
    const x = f.w / 2, y = f.h * 0.38, r = f.s * (f.portrait ? 0.27 : 0.22);
    const a = mix(f.color.accent, '#ec764f', 0.55), b = '#5d7794';
    for (let i = 0; i < 3; i++) {
      const or = r + f.s * (0.04 + i * 0.045);
      ring(ctx, x, y, or, rgba(b, 0.20), f.s * 0.002);
      const angle = f.t * (0.18 + i * 0.07) + i * 2.1;
      dot(ctx, x + Math.cos(angle) * or, y + Math.sin(angle) * or, f.s * (0.013 + i * 0.007) * (1 + f.a.bass * 0.15), i % 2 ? b : a);
    }
    photo(ctx, f, x - r, y - r, r * 2, r * 2, { radius: r });
    eq(ctx, f, f.w * 0.36, f.h * 0.72, f.w * 0.28, f.s * 0.025, '#516783', { center: true, n: 20 });
  },
});

const disco = look({
  id: 'disco-tiles', name: 'Disco Tiles', ne: 'डिस्को टाइल', cat: 'dance',
  description: 'A colourful tile wall that gently grooves with the beat.', descriptionNe: 'बिटसँगै चल्ने रङ्गीन टाइलको भित्ता।',
  tags: ['playful', 'colour', 'disco', 'pattern'],
  text: (f) => words(f, { y: 0.80, subY: 0.90, font: 'baloo', size: 0.079, color: '#ffedc5' }),
  draw(ctx, f) {
    fill(ctx, f, '#292f2b');
    const colors = ['#b96146', '#cfaa61', '#809a83', '#748b9c', '#a8767c'];
    const cols = f.portrait ? 6 : f.square ? 8 : 12;
    const step = f.w * 0.88 / cols, x = f.w * 0.06, y = f.h * 0.06;
    const rows = Math.max(4, Math.floor(f.h * 0.61 / step));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = f.a.bands[(i * 5 + j * 7) % 64];
      const gap = step * (0.08 + (1 - v) * 0.06);
      rect(ctx, x + i * step + gap, y + j * step + gap, step - gap * 2, step - gap * 2,
        colors[(i + j * 2) % colors.length], step * 0.09);
    }
    const d = f.s * (f.portrait ? 0.57 : 0.40);
    const px = (f.w - d) / 2, py = f.h * 0.34 - d / 2;
    rect(ctx, px - f.s * 0.013, py - f.s * 0.013, d + f.s * 0.026, d + f.s * 0.026, '#292f2b', f.s * 0.007);
    photo(ctx, f, px, py, d, d);
    wave(ctx, f, f.w * 0.26, f.h * 0.72, f.w * 0.48, f.s * 0.02, '#d8b66f');
  },
});

const cutPaper = look({
  id: 'cut-paper', name: 'Cut Paper', ne: 'कागजी कोलाज', cat: 'hiphop',
  description: 'A graphic photo collage with oversized poster type.', descriptionNe: 'ठूला अक्षर र फोटोको कागजी कोलाज।',
  tags: ['bold', 'collage', 'poster', 'paper'],
  text: (f) => words(f, f.portrait || f.square
    ? { x: 0.09, y: 0.76, subY: 0.85, width: 0.82, align: 'left', color: '#f7e6bf', font: 'khand', size: 0.10 }
    : { x: 0.08, y: 0.45, subY: 0.59, width: 0.40, align: 'left', color: '#f7e6bf', font: 'khand', size: 0.10 }),
  draw(ctx, f) {
    fill(ctx, f, '#754b52');
    const p = f.portrait || f.square, d = f.s * (f.square ? 0.49 : p ? 0.72 : 0.63);
    const x = f.w * (p ? 0.50 : 0.73), y = f.h * (p ? 0.35 : 0.47);
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.07);
    rect(ctx, -d * 0.56, -d * 0.51, d * 1.10, d * 1.08, '#d4a066');
    ctx.rotate(-0.13);
    rect(ctx, -d / 2 - f.s * 0.015, -d / 2 - f.s * 0.015, d + f.s * 0.03, d + f.s * 0.03, CREAM);
    photo(ctx, f, -d / 2, -d / 2, d, d, { kind: 'gray' }); ctx.restore();
    const bx = f.w * 0.09, by = f.h * (p ? 0.94 : 0.79);
    eq(ctx, f, bx, by, f.w * (p ? 0.8 : 0.31), f.s * 0.06, '#dfb277', { n: 22 });
  },
});

const groove = look({
  id: 'groove-stack', name: 'Groove Stack', ne: 'धुनका तह', cat: 'dance',
  description: 'A record-shop sleeve beside a stack of dancing ribbons.', descriptionNe: 'एल्बमको छेउमा नाच्ने रङ्गीन तरंग।',
  tags: ['playful', 'wave', 'vintage', 'colour'],
  text: (f) => words(f, { y: 0.80, subY: 0.89, font: 'baloo', size: 0.077, color: '#f7e6c1' }),
  draw(ctx, f) {
    fill(ctx, f, '#34473c');
    const p = f.portrait || f.square, d = f.s * (f.square ? 0.40 : p ? 0.58 : 0.48);
    const x = p ? (f.w - d) / 2 : f.w * 0.12, y = f.h * (p ? 0.08 : 0.14);
    photo(ctx, f, x, y, d, d);
    const wx = f.w * (p ? 0.15 : 0.51), wy = f.h * (f.square ? 0.53 : p ? 0.47 : 0.22), ww = f.w * (p ? 0.70 : 0.36);
    const colors = ['#c78361', '#d2a56b', '#e3cb8b', '#a5b68a', '#799e90'];
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const amp = f.s * (0.01 + f.a.bands[(i + j * 7) % 64] * 0.027);
        const yy = wy + j * f.s * (f.square ? 0.038 : 0.053) + Math.sin(u * TAU * 1.5 - f.t * 0.8 + j * 0.7) * amp * Math.sin(Math.PI * u);
        if (!i) ctx.moveTo(wx, yy); else ctx.lineTo(wx + ww * u, yy);
      }
      ctx.strokeStyle = colors[j]; ctx.lineWidth = f.s * 0.012; ctx.lineCap = 'round'; ctx.stroke();
    }
    progress(ctx, f, f.w * 0.16, f.h * 0.95, f.w * 0.68, '#adba99');
  },
});

export default [colorBlock, orbit, disco, cutPaper, groove];
