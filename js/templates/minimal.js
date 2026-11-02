// Five quieter compositions: the photo and song title do most of the work.
import { mix, rgba } from '../helpers.js';
import { look, fill, photo, rect, rule, dot, eq, wave, progress, words, PAPER, INK, CREAM } from './studio-shared.js';

const linen = look({
  id: 'linen', name: 'Linen', ne: 'सादा कागज', cat: 'simple',
  description: 'Warm paper, a small photo, room to breathe.', descriptionNe: 'न्यानो कागजमा फोटो र खुला ठाउँ।',
  tags: ['minimal', 'light', 'photo', 'quiet'],
  text: (f) => words(f, { y: f.portrait ? 0.70 : 0.77, color: INK, font: 'martel', size: 0.059 }),
  draw(ctx, f) {
    fill(ctx, f, PAPER);
    const d = f.s * (f.portrait ? 0.7 : 0.49), x = (f.w - d) / 2, y = f.h * (f.portrait ? 0.19 : 0.13);
    photo(ctx, f, x, y, d, d);
    const ink = mix(f.color.accent, INK, 0.65);
    eq(ctx, f, f.w * 0.40, y + d + f.s * 0.055, f.w * 0.20, f.s * 0.025, ink, { n: 22, center: true });
    progress(ctx, f, f.w * 0.28, f.h * 0.91, f.w * 0.44, ink);
  },
});

const gallery = look({
  id: 'gallery-print', name: 'Gallery Print', ne: 'ग्यालरी फोटो', cat: 'simple',
  description: 'A generous photo with a clean caption below.', descriptionNe: 'ठूलो फोटो र तल सफा अक्षर।',
  tags: ['minimal', 'light', 'photo', 'frame'],
  text: (f) => words(f, { x: 0.07, y: 0.79, subY: 0.88, align: 'left', width: 0.75, color: INK, size: 0.065 }),
  draw(ctx, f) {
    fill(ctx, f, '#fcfaf4');
    photo(ctx, f, f.w * 0.055, f.h * 0.055, f.w * 0.89, f.h * 0.65);
    rule(ctx, f.w * 0.07, f.h * 0.935, f.w * 0.93, f.h * 0.935, '#d1cabb', f.s * 0.0015);
    eq(ctx, f, f.w * 0.85, f.h * 0.88, f.w * 0.08, f.s * 0.065, INK, { n: 6 });
  },
});

const mono = look({
  id: 'mono-split', name: 'Mono Split', ne: 'श्यामश्वेत', cat: 'simple',
  description: 'Black and white photography, editorial type.', descriptionNe: 'श्यामश्वेत फोटो र स्पष्ट शीर्षक।',
  tags: ['minimal', 'monochrome', 'photo', 'editorial'],
  text: (f) => words(f, f.portrait
    ? { x: 0.09, y: 0.73, subY: 0.79, align: 'left', width: 0.80, size: 0.085 }
    : { x: 0.57, y: 0.43, subY: 0.55, align: 'left', width: 0.36, size: 0.074 }),
  draw(ctx, f) {
    fill(ctx, f, '#171a19');
    const p = f.portrait;
    photo(ctx, f, f.w * 0.05, f.h * 0.05, f.w * (p ? 0.9 : 0.45), f.h * (p ? 0.57 : 0.9), { kind: 'gray' });
    const x = f.w * (p ? 0.09 : 0.57), y = f.h * (p ? 0.88 : 0.74), width = f.w * (p ? 0.8 : 0.35);
    wave(ctx, f, x, y, width, f.s * 0.035, CREAM);
    rule(ctx, x, f.h * (p ? 0.67 : 0.27), x + f.s * 0.055, f.h * (p ? 0.67 : 0.27), f.color.accent, f.s * 0.008);
  },
});

const fineLine = look({
  id: 'fine-line', name: 'Fine Line', ne: 'मसिनो रेखा', cat: 'simple',
  description: 'An uninterrupted photo and one delicate waveform.', descriptionNe: 'पूरै फोटो र एउटा मसिनो तरंग।',
  tags: ['minimal', 'photo', 'wave', 'quiet'],
  text: (f) => words(f, { y: 0.77, size: 0.065 }),
  draw(ctx, f) {
    fill(ctx, f, '#101713');
    photo(ctx, f, 0, 0, f.w, f.h);
    const g = ctx.createLinearGradient(0, f.h * 0.3, 0, f.h);
    g.addColorStop(0, 'rgba(7,15,11,0)'); g.addColorStop(0.6, 'rgba(7,15,11,0.82)'); g.addColorStop(1, '#070f0b');
    rect(ctx, 0, 0, f.w, f.h, g);
    wave(ctx, f, f.w * 0.12, f.h * 0.62, f.w * 0.76, f.s * 0.055, CREAM, f.s * 0.002);
    dot(ctx, f.w * 0.5, f.h * 0.93, f.s * (0.003 + f.a.level * 0.004), f.color.accent);
  },
});

const softFocus = look({
  id: 'soft-focus', name: 'Soft Focus', ne: 'मधुर फोटो', cat: 'simple',
  description: 'A sharp portrait floating in its own colours.', descriptionNe: 'फोटोकै रङमा स्पष्ट तस्बिर।',
  tags: ['minimal', 'photo', 'soft', 'album'],
  text: (f) => words(f, { y: f.portrait ? 0.72 : 0.79, size: 0.066 }),
  draw(ctx, f) {
    fill(ctx, f, '#17201d');
    photo(ctx, f, 0, 0, f.w, f.h, { kind: 'blur' });
    rect(ctx, 0, 0, f.w, f.h, 'rgba(8,18,15,0.72)');
    const d = f.s * (f.portrait ? 0.72 : 0.53), x = (f.w - d) / 2, y = f.h * (f.portrait ? 0.18 : 0.13);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = f.s * 0.05; ctx.shadowOffsetY = f.s * 0.025;
    rect(ctx, x, y, d, d, '#182421', f.s * 0.008); ctx.restore();
    photo(ctx, f, x, y, d, d, { radius: f.s * 0.008 });
    eq(ctx, f, f.w * 0.40, f.h * 0.94, f.w * 0.20, f.s * 0.025, rgba(CREAM, 0.8), { n: 24, center: true });
  },
});

export default [linen, gallery, mono, fineLine, softFocus];
