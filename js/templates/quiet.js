import { TAU, rgba } from '../helpers.js';
import { look, fill, photo, archPhoto, rect, rule, ring, dot, eq, wave, progress, words } from './studio-shared.js';

const moon = look({
  id: 'moon-window', name: 'Moon Window', ne: 'जूनको झ्याल', cat: 'calm',
  description: 'A moon-shaped portrait in a quiet midnight sky.', descriptionNe: 'शान्त रातमा जूनजस्तो गोलो फोटो।',
  tags: ['quiet', 'night', 'circle', 'minimal'],
  text: (f) => words(f, { y: 0.78, font: 'martel', size: 0.061, color: '#e1e6df' }),
  draw(ctx, f) {
    fill(ctx, f, '#172c34');
    const r = f.s * (f.portrait ? 0.32 : 0.24), x = f.w / 2, y = f.h * (f.portrait ? 0.38 : 0.38);
    ring(ctx, x, y, r + f.s * 0.026, '#66868a', f.s * 0.0015);
    photo(ctx, f, x - r, y - r, r * 2, r * 2, { radius: r });
    const a = -Math.PI / 2 + f.progress * TAU;
    dot(ctx, x + Math.cos(a) * (r + f.s * 0.026), y + Math.sin(a) * (r + f.s * 0.026), f.s * 0.006, '#d9dfbc');
    wave(ctx, f, f.w * 0.37, f.h * 0.94, f.w * 0.26, f.s * 0.018, '#89afb2');
  },
});

const ripple = look({
  id: 'ripple-study', name: 'Ripple Study', ne: 'लहरको धुन', cat: 'calm',
  description: 'Fine water rings responding softly to the music.', descriptionNe: 'गीतसँग बिस्तारै चल्ने पानीका घेरा।',
  tags: ['quiet', 'water', 'circle', 'light'],
  text: (f) => words(f, { y: 0.80, subY: 0.89, color: '#304a45', size: 0.067 }),
  draw(ctx, f) {
    fill(ctx, f, '#dce5d9');
    const x = f.w / 2, y = f.h * 0.39, r = f.s * (f.portrait ? 0.24 : 0.19);
    for (let i = 0; i < 7; i++) {
      const phase = (i / 7 + f.t * 0.035) % 1;
      const rr = r + f.s * (0.025 + phase * 0.2) + f.a.bass * f.s * 0.008;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.86);
      ring(ctx, 0, 0, rr, rgba('#668e80', (1 - phase) * 0.5), f.s * 0.0015); ctx.restore();
    }
    photo(ctx, f, x - r, y - r, r * 2, r * 2, { radius: r });
    wave(ctx, f, f.w * 0.35, f.h * 0.70, f.w * 0.30, f.s * 0.014, '#496f61');
  },
});

const stillWater = look({
  id: 'still-water', name: 'Still Water', ne: 'शान्त पानी', cat: 'calm',
  description: 'A photograph reflected across a gentle waterline.', descriptionNe: 'शान्त पानीमा फोटोको प्रतिबिम्ब।',
  tags: ['quiet', 'water', 'landscape', 'photo'],
  text: (f) => words(f, { y: 0.80, subY: 0.89, color: '#e3eee7', font: 'martel', size: 0.061 }),
  draw(ctx, f) {
    fill(ctx, f, '#18342f');
    const x = f.w * 0.07, y = f.h * 0.09, w = f.w * 0.86, h = f.h * 0.38, base = y + h;
    photo(ctx, f, x, y, w, h);
    ctx.save(); ctx.translate(0, base * 2); ctx.scale(1, -1);
    photo(ctx, f, x, y, w, h, { alpha: 0.28 }); ctx.restore();
    const g = ctx.createLinearGradient(0, base, 0, f.h * 0.76);
    g.addColorStop(0, 'rgba(24,52,47,0)'); g.addColorStop(1, '#18342f');
    rect(ctx, 0, base, f.w, f.h - base, g);
    wave(ctx, f, x, base, w, f.s * 0.010, '#a0c3b3', f.s * 0.002);
    for (let i = 0; i < 5; i++) {
      const yy = base + f.s * (0.035 + i * 0.035);
      const shift = Math.sin(f.t * 0.4 + i) * f.s * 0.01;
      rule(ctx, f.w * (0.20 + i * 0.015) + shift, yy, f.w * (0.80 - i * 0.015) + shift, yy, rgba('#b3d5c6', 0.12 - i * 0.018), f.s * 0.0015);
    }
  },
});

const paper = look({
  id: 'pressed-memory', name: 'Pressed Memory', ne: 'संगालेको सम्झना', cat: 'calm',
  description: 'A photo tucked into an olive-coloured scrapbook.', descriptionNe: 'जैतुनी रङको पानामा संगालेको फोटो।',
  tags: ['quiet', 'paper', 'warm', 'memory'],
  text: (f) => words(f, f.portrait || f.square
    ? { y: 0.77, color: '#3c4734', font: 'kalam', size: 0.073 }
    : { x: 0.73, y: 0.46, subY: 0.59, width: 0.37, color: '#3c4734', font: 'kalam', size: 0.072 }),
  draw(ctx, f) {
    fill(ctx, f, '#d9dcc6');
    const p = f.portrait || f.square, d = f.s * (f.portrait ? 0.65 : p ? 0.49 : 0.63);
    const cx = p ? f.w / 2 : f.w * 0.29, cy = f.h * (p ? 0.38 : 0.47);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.055);
    rect(ctx, -d / 2 - f.s * 0.025, -d / 2 - f.s * 0.025, d + f.s * 0.05, d + f.s * 0.09, '#faf5e6');
    photo(ctx, f, -d / 2, -d / 2, d, d);
    rect(ctx, -d * 0.2, -d / 2 - f.s * 0.045, d * 0.4, f.s * 0.065, 'rgba(168,162,123,0.62)');
    ctx.restore();
    wave(ctx, f, f.w * (p ? 0.30 : 0.61), f.h * (p ? 0.93 : 0.76), f.w * (p ? 0.40 : 0.25), f.s * 0.02, '#677657');
  },
});

const daybreak = look({
  id: 'daybreak', name: 'Daybreak', ne: 'बिहानी', cat: 'calm',
  description: 'A sunlit arch in warm peach and terracotta.', descriptionNe: 'न्यानो सुन्तला रङमा बिहानीको झ्याल।',
  tags: ['quiet', 'warm', 'arch', 'light'],
  text: (f) => words(f, { y: 0.80, subY: 0.89, color: '#663f32', font: 'martel', size: 0.062 }),
  draw(ctx, f) {
    fill(ctx, f, '#ead2bb');
    const w = f.s * (f.portrait ? 0.63 : 0.44), h = f.s * (f.portrait ? 0.85 : 0.58);
    const x = (f.w - w) / 2, y = f.h * (f.portrait ? 0.17 : 0.10);
    dot(ctx, f.w * (f.portrait ? 0.77 : 0.67), f.h * 0.23, f.s * 0.10, '#c7875e');
    archPhoto(ctx, f, x, y, w, h);
    eq(ctx, f, f.w * 0.36, f.h * 0.72, f.w * 0.28, f.s * 0.025, '#9d6047', { n: 24, center: true });
    progress(ctx, f, f.w * 0.28, f.h * 0.96, f.w * 0.44, '#9d6047');
  },
});

export default [moon, ripple, stillWater, paper, daybreak];
