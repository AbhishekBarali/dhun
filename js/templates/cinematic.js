import { rgba } from '../helpers.js';
import { look, fill, photo, rect, rule, wave, eq, progress, words, CREAM } from './studio-shared.js';

const letterbox = look({
  id: 'letterbox', name: 'Letterbox', ne: 'सिनेमाको पर्दा', cat: 'cinematic',
  description: 'A wide film frame with quiet opening titles.', descriptionNe: 'फराकिलो फिल्मको फ्रेम र शान्त शीर्षक।',
  tags: ['cinema', 'minimal', 'photo', 'dark'],
  text: (f) => words(f, { y: 0.81, subY: 0.90, font: 'martel', size: 0.060 }),
  draw(ctx, f) {
    fill(ctx, f, '#101411');
    photo(ctx, f, 0, f.h * 0.15, f.w, f.h * 0.54);
    progress(ctx, f, f.w * 0.08, f.h * 0.71, f.w * 0.84, '#bca77b');
    wave(ctx, f, f.w * 0.40, f.h * 0.075, f.w * 0.2, f.s * 0.016, '#a99f86');
  },
});

const filmstrip = look({
  id: 'silver-screen', name: 'Silver Screen', ne: 'रजतपट', cat: 'cinematic',
  description: 'Monochrome film with a moving exposure line.', descriptionNe: 'श्यामश्वेत फिल्म र चल्ने उज्यालो रेखा।',
  tags: ['cinema', 'monochrome', 'film', 'vintage'],
  text: (f) => words(f, { y: 0.80, subY: 0.89, font: 'martel', size: 0.060 }),
  draw(ctx, f) {
    fill(ctx, f, '#121515');
    const x = f.w * 0.07, y = f.h * 0.07, w = f.w * 0.86, h = f.h * 0.59;
    photo(ctx, f, x, y, w, h, { kind: 'gray' });
    for (let i = 0; i < 14; i++) {
      const yy = y + (i + 0.25) / 14 * h;
      rect(ctx, f.w * 0.025, yy, f.w * 0.023, h / 26, '#deded2', f.s * 0.003);
      rect(ctx, f.w * 0.952, yy, f.w * 0.023, h / 26, '#deded2', f.s * 0.003);
    }
    const yy = y + h * ((f.t * 0.03) % 1);
    rule(ctx, x, yy, x + w, yy, 'rgba(255,255,255,0.12)', f.s * 0.003);
    eq(ctx, f, f.w * 0.39, f.h * 0.72, f.w * 0.22, f.s * 0.023, CREAM, { n: 20, center: true });
  },
});

const opening = look({
  id: 'opening-credits', name: 'Opening Credits', ne: 'सुरुको शीर्षक', cat: 'cinematic',
  description: 'Large opening titles beside a dramatic photo.', descriptionNe: 'ठूलो शीर्षकसँगै नाटकीय फोटो।',
  tags: ['cinema', 'editorial', 'title', 'dark'],
  text: (f) => words(f, f.portrait
    ? { x: 0.09, y: 0.77, subY: 0.85, width: 0.82, align: 'left', font: 'rozha', size: 0.093 }
    : { x: 0.07, y: 0.48, subY: 0.64, width: 0.43, align: 'left', font: 'rozha', size: 0.098 }),
  draw(ctx, f) {
    fill(ctx, f, '#141b1c');
    const p = f.portrait;
    photo(ctx, f, f.w * (p ? 0 : 0.47), 0, f.w * (p ? 1 : 0.53), f.h * (p ? 0.66 : 1));
    const g = p ? ctx.createLinearGradient(0, f.h * 0.33, 0, f.h * 0.67)
      : ctx.createLinearGradient(f.w * 0.47, 0, f.w * 0.68, 0);
    g.addColorStop(0, p ? 'rgba(20,27,28,0)' : '#141b1c');
    g.addColorStop(1, p ? '#141b1c' : 'rgba(20,27,28,0)');
    rect(ctx, f.w * (p ? 0 : 0.47), p ? f.h * 0.33 : 0, f.w * (p ? 1 : 0.21), f.h * (p ? 0.34 : 1), g);
    const x = f.w * (p ? 0.09 : 0.07), y = f.h * (p ? 0.67 : 0.28);
    rule(ctx, x, y, x + f.s * 0.11, y, '#d1b06b', f.s * 0.005);
    wave(ctx, f, x, f.h * 0.94, f.w * (p ? 0.82 : 0.34), f.s * 0.018, '#c4b596');
  },
});

const panorama = look({
  id: 'panorama', name: 'Panorama', ne: 'फराकिलो दृश्य', cat: 'cinematic',
  description: 'One panoramic strip, framed by its own atmosphere.', descriptionNe: 'फोटोकै रङभित्र फराकिलो दृश्य।',
  tags: ['cinema', 'landscape', 'photo', 'quiet'],
  text: (f) => words(f, { y: f.portrait ? 0.71 : 0.79, subY: f.portrait ? 0.78 : 0.89, size: 0.066 }),
  draw(ctx, f) {
    fill(ctx, f, '#1c2423');
    photo(ctx, f, 0, 0, f.w, f.h, { kind: 'blur' });
    rect(ctx, 0, 0, f.w, f.h, 'rgba(12,23,23,0.8)');
    const y = f.h * (f.portrait ? 0.27 : 0.22), h = f.h * (f.portrait ? 0.30 : 0.39);
    photo(ctx, f, 0, y, f.w, h);
    rule(ctx, 0, y, f.w, y, rgba(CREAM, 0.5), f.s * 0.0015);
    rule(ctx, 0, y + h, f.w, y + h, rgba(CREAM, 0.5), f.s * 0.0015);
    wave(ctx, f, f.w * 0.27, f.h * 0.13, f.w * 0.46, f.s * 0.025, CREAM);
  },
});

const diptych = look({
  id: 'double-exposure', name: 'Double Exposure', ne: 'दोहोरो छाया', cat: 'cinematic',
  description: 'An intimate colour portrait against a monochrome echo.', descriptionNe: 'श्यामश्वेत छायामाथि रङ्गीन फोटो।',
  tags: ['cinema', 'portrait', 'photo', 'collage'],
  text: (f) => words(f, { x: f.portrait ? 0.5 : 0.07, y: 0.82, subY: 0.91,
    width: f.portrait ? 0.85 : 0.72, align: f.portrait ? 'center' : 'left', font: 'martel', size: 0.062 }),
  draw(ctx, f) {
    fill(ctx, f, '#17201e');
    photo(ctx, f, 0, 0, f.w, f.h, { kind: 'gray', zoom: 0.12, alpha: 0.36 });
    const g = ctx.createLinearGradient(0, f.h * 0.48, 0, f.h);
    g.addColorStop(0, 'rgba(16,25,22,0)'); g.addColorStop(0.6, '#101916'); g.addColorStop(1, '#101916');
    rect(ctx, 0, 0, f.w, f.h, g);
    const w = f.w * (f.portrait ? 0.65 : 0.35), h = f.h * (f.portrait ? 0.48 : 0.59);
    const x = f.w * (f.portrait ? 0.175 : 0.57), y = f.h * 0.12;
    rect(ctx, x - f.s * 0.006, y - f.s * 0.006, w + f.s * 0.012, h + f.s * 0.012, '#d6ccae');
    photo(ctx, f, x, y, w, h);
    eq(ctx, f, f.w * (f.portrait ? 0.33 : 0.10), f.h * (f.portrait ? 0.70 : 0.65), f.w * 0.30, f.s * 0.035, '#c0af86', { n: 28, center: true });
  },
});

export default [letterbox, filmstrip, opening, panorama, diptych];
