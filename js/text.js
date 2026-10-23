// Words on the video: the song name, a second line (singer / channel) and any
// extra text the user adds. Each item can be dragged anywhere on the preview.
import { fontCss } from './fonts.js';
import { roundRect, rgba, clamp } from './helpers.js';

export const STYLES = ['shadow', 'outline', 'glow', 'box', 'tag', 'plain'];

let nextId = 1;
export function makeItem(role, text, props = {}) {
  return {
    id: 'txt' + nextId++,
    role,             // 'title' | 'sub' | 'extra'
    text,
    x: 0.5, y: 0.5,   // centre of the text, as a fraction of width / height
    size: 0.06,       // letter height as a fraction of the video's short side
    font: 'mukta',
    color: '#ffffff',
    style: 'shadow',
    align: 'center',
    upper: false,
    opacity: 1,
    hidden: false,    // the "Show" tick is off
    touched: {},      // fields the user changed by hand (kept when switching looks)
    ...props,
  };
}

// Default places for the title and second line. Templates can override any
// field with a text(f) function returning { title: {...}, sub: {...} }.
export function defaultLayout(f) {
  const top = f.portrait ? 0.13 : 0.12;
  return {
    // maxW: widest the words may get (fraction of the width) before they shrink to fit.
    title: { x: 0.5, y: top, size: 0.075, align: 'center', font: 'mukta', color: '#ffffff', style: 'shadow', upper: false, maxW: 0.92 },
    sub: { x: 0.5, y: top + (f.portrait ? 0.045 : 0.075), size: 0.036, align: 'center', font: 'mukta', color: '#ffffff', style: 'shadow', upper: false, opacity: 0.85, maxW: 0.92 },
    extra: { size: 0.045, font: 'mukta', color: '#ffffff', style: 'shadow', maxW: 0.92 },
  };
}

const LAYOUT_FIELDS = ['x', 'y', 'size', 'align', 'font', 'color', 'style', 'upper', 'opacity', 'maxW'];

// Apply a template's layout to the items, keeping anything the user changed.
export function applyLayout(items, tpl, f) {
  const base = defaultLayout(f);
  const custom = tpl && tpl.text ? tpl.text(f) || {} : {};
  for (const it of items) {
    const role = it.role === 'extra' ? 'extra' : it.role;
    const spec = { ...base[role], ...(custom[role] || {}) };
    for (const k of LAYOUT_FIELDS) {
      if (spec[k] === undefined || it.touched[k]) continue;
      if (role === 'extra' && (k === 'x' || k === 'y')) continue;
      it[k] = spec[k];
    }
  }
}

function resolveColor(c, f) {
  if (c === 'accent') return f.color.accent;
  if (c === 'accent2') return f.color.accent2;
  return c;
}

// Draw one item; stores its on-screen box in item._box for tapping/dragging.
export function drawItem(ctx, f, it, alpha = 1, pulse = 0) {
  const raw = it.upper ? it.text.toUpperCase() : it.text;
  const lines = raw.split('\n').filter((l, i, arr) => l.length || arr.length === 1);
  if (it.hidden || !raw.trim()) { it._box = null; return; }
  let px = it.size * f.s * (1 + pulse);
  ctx.save();
  ctx.font = fontCss(it.font, px);
  ctx.textBaseline = 'middle';
  ctx.textAlign = it.align;
  let bw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  // Long words shrink to fit their space instead of running off the edge.
  const maxPx = (it.maxW || 0) * f.w;
  if (maxPx > 0 && bw > maxPx) {
    px *= maxPx / bw;
    ctx.font = fontCss(it.font, px);
    bw = maxPx;
  }
  const lh = px * 1.18;
  const bh = lh * lines.length;
  const cx = it.x * f.w, cy = it.y * f.h;
  const left = it.align === 'left' ? cx : it.align === 'right' ? cx - bw : cx - bw / 2;
  const top = cy - bh / 2;
  it._box = { x: left - px * 0.25, y: top - px * 0.15, w: bw + px * 0.5, h: bh + px * 0.3 };
  const color = resolveColor(it.color, f);
  ctx.globalAlpha = clamp(alpha * it.opacity);

  if (it.style === 'box' || it.style === 'tag') {
    const pad = px * 0.35;
    ctx.fillStyle = it.style === 'box' ? 'rgba(0,0,0,0.5)' : color;
    roundRect(ctx, left - pad, top - pad * 0.45, bw + pad * 2, bh + pad * 0.9, px * 0.22);
    ctx.fill();
  }
  const textColor = it.style === 'tag' ? '#111111' : color;
  lines.forEach((line, i) => {
    const y = top + lh * (i + 0.5) + px * 0.04;
    if (it.style === 'shadow') {
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = px * 0.35;
      ctx.shadowOffsetY = px * 0.06;
    } else if (it.style === 'glow') {
      ctx.shadowColor = rgba(color.startsWith('#') ? color : '#ffffff', 0.9);
      ctx.shadowBlur = px * (0.45 + pulse * 3);
    } else if (it.style === 'outline') {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, px * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(line, cx, y);
    }
    ctx.fillStyle = textColor;
    ctx.fillText(line, cx, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  });
  ctx.restore();
}

export function drawItems(ctx, f, items, { alpha = 1, beatText = false } = {}) {
  const pulse = beatText ? f.a.beat * 0.045 : 0;
  for (const it of items) drawItem(ctx, f, it, alpha, it.role === 'title' ? pulse : pulse * 0.5);
}

// Selection outline + centre guide, preview only (never recorded).
export function drawSelection(ctx, f, it, guide) {
  if (!it || !it._box) return;
  const b = it._box;
  ctx.save();
  ctx.setLineDash([f.s * 0.012, f.s * 0.008]);
  ctx.lineWidth = Math.max(1.5, f.s * 0.004);
  ctx.strokeStyle = '#ffd166';
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  if (guide) {
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,209,102,0.7)';
    ctx.beginPath();
    ctx.moveTo(f.w / 2, 0);
    ctx.lineTo(f.w / 2, f.h);
    ctx.stroke();
  }
  ctx.restore();
}

export function hitTest(items, x, y) {
  for (let i = items.length - 1; i >= 0; i--) {
    const b = items[i]._box;
    if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return items[i];
  }
  return null;
}
