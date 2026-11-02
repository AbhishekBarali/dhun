// Small drawing primitives for the new collection. No images or fonts are
// fetched here: every look uses the person's photo and the existing renderer.
import { TAU, clamp, drawCover, roundRect, slowZoom, rgba } from '../helpers.js';
import { fontCss } from '../fonts.js';

export const PAPER = '#f1ecdf';
export const INK = '#262823';
export const CREAM = '#f8f3e7';

export function look(spec) { return { isNew: true, ...spec }; }
export function fill(ctx, f, color) { ctx.fillStyle = color; ctx.fillRect(0, 0, f.w, f.h); }
export function rect(ctx, x, y, w, h, color, radius = 0) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
}
export function rule(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function dot(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = color; ctx.fill();
}
export function ring(ctx, x, y, r, color, width = 1) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
export function photo(ctx, f, x, y, w, h, { radius = 0, kind = 'sharp', alpha = 1, zoom = 0.035 } = {}) {
  const z = slowZoom(f, zoom);
  ctx.save();
  roundRect(ctx, x, y, w, h, radius); ctx.clip(); ctx.globalAlpha *= alpha;
  drawCover(ctx, f.photo[kind], x, y, w, h, z.zoom, z.fx, z.fy);
  ctx.restore();
}
export function archPhoto(ctx, f, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.clip();
  photo(ctx, f, x, y, w, h); ctx.restore();
}

// These defaults reserve a real area for editable words in every aspect ratio.
export function words(f, { x = 0.5, y = 0.78, width = 0.82, align = 'center', color = CREAM,
  subColor = color, size = 0.072, subY, font = 'mukta' } = {}) {
  return {
    title: { x, y, maxW: width, align, color, font, size, style: 'plain', opacity: 1 },
    sub: { x, y: subY ?? y + (f.portrait ? 0.045 : 0.082), maxW: width,
      align, color: subColor, font: 'mukta', size: 0.032, style: 'plain', opacity: 0.82 },
    extra: { color, style: 'plain' },
  };
}

export function eq(ctx, f, x, y, w, h, color, { n = 36, center = false, dots = false } = {}) {
  const step = w / n;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const k = Math.round(Math.abs(i / (n - 1) * 2 - 1) * 50);
    const v = clamp(f.a.bands[k] || 0);
    const bh = Math.max(f.s * 0.003, v * h);
    if (dots) {
      const count = Math.max(1, Math.round(v * 8));
      for (let j = 0; j < count; j++) dot(ctx, x + (i + 0.5) * step, y - j * h / 8, step * 0.22, color);
    } else {
      const bw = step * 0.45;
      rect(ctx, x + (i + 0.275) * step, center ? y - bh / 2 : y - bh, bw, bh, color, bw / 2);
    }
  }
}

export function wave(ctx, f, x, y, w, h, color, width = f.s * 0.003) {
  ctx.beginPath();
  for (let i = 0; i <= 96; i++) {
    const v = f.a.wave[Math.min(f.a.wave.length - 1, Math.floor(i / 96 * (f.a.wave.length - 1)))] || 0;
    const yy = y + v * h * Math.sin(i / 96 * Math.PI);
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x + i / 96 * w, yy);
  }
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width); ctx.stroke();
}

export function progress(ctx, f, x, y, w, color) {
  const width = Math.max(1, f.s * 0.002);
  rule(ctx, x, y, x + w, y, rgba(color, 0.22), width);
  rule(ctx, x, y, x + w * clamp(f.progress || 0), y, color, width * 2);
}

export function label(ctx, f, text, x, y, color, size = 0.022, align = 'left') {
  ctx.font = fontCss('mukta', f.s * size, 500); ctx.textBaseline = 'middle';
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// A real record's concentric grooves, with the user's picture on its label.
export function record(ctx, f, x, y, r) {
  dot(ctx, x, y, r, '#171916');
  for (let i = 0; i < 14; i++) ring(ctx, x, y, r * (0.45 + i * 0.036), i % 3 ? '#32342f' : '#454740', Math.max(0.7, f.s * 0.001));
  ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * 0.22);
  photo(ctx, f, -r * 0.37, -r * 0.37, r * 0.74, r * 0.74, { radius: r * 0.37, zoom: 0 });
  ctx.restore(); dot(ctx, x, y, r * 0.045, PAPER);
}
