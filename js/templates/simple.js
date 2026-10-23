// Simple, clean looks. The "satisfying wave" family lives here.
import {
  TAU, clamp, lerp, rgba, shade, mix, mirrored, resample, smoothLine, smoothLoop,
  photoBackground, fadeEdge, vignette, circlePhoto, coverPhoto, withGlow,
  roundRect, drawCover, band, noise1, formatTime,
} from '../helpers.js';
import { fontCss } from '../fonts.js';

const softWave = {
  id: 'soft-wave',
  name: 'Soft Wave',
  ne: 'मधुर तरंग',
  cat: 'simple',
  text: (f) => ({
    title: { y: f.portrait ? 0.14 : 0.13 },
  }),
  setup: () => ({ pts: new Float32Array(56), echo: new Float32Array(56) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.12 });
    fadeEdge(ctx, f, 'bottom', 0.55, 0.78);
    fadeEdge(ctx, f, 'top', 0.3, 0.35);

    const n = st.pts.length;
    const m = mirrored(a.bands, n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const flow = 0.78 + 0.22 * Math.sin(i * 0.55 - f.t * 2.4);
      const taper = Math.pow(Math.sin(Math.PI * x), 0.9);
      const v = clamp(m[i] * flow) * taper;
      st.pts[i] = lerp(st.pts[i], v, 0.55);
      st.echo[i] = lerp(st.echo[i], st.pts[i], 0.08); // slow trailing copy
    }
    const cy = h * (f.portrait ? 0.74 : 0.78);
    const amp = s * (f.portrait ? 0.2 : 0.17) * (1 + a.kick * 0.12);
    const xs = (i) => (i / (n - 1)) * w;

    const ribbon = (arr, up, down, fill, alpha) => {
      const top = [], bot = [];
      for (let i = 0; i < n; i++) {
        top.push([xs(i), cy - arr[i] * amp * up]);
        bot.push([xs(i), cy + arr[i] * amp * down]);
      }
      ctx.beginPath();
      smoothLine(ctx, top);
      smoothLine(ctx, bot.reverse(), false);
      ctx.closePath();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 1;
      return top;
    };

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, f.color.accent2);
    grad.addColorStop(0.5, f.color.accent);
    grad.addColorStop(1, f.color.accent2);

    ribbon(st.echo, 1.25, 0.9, rgba(shade(f.color.accent, 0.3), 1), 0.18);
    const top = ribbon(st.pts, 1, 0.55, grad, 0.85);

    withGlow(ctx, rgba(f.color.accent, 0.9), s * 0.03, () => {
      ctx.beginPath();
      smoothLine(ctx, top);
      ctx.lineWidth = Math.max(1.5, s * 0.0045);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineCap = 'round';
      ctx.stroke();
    });
    // quiet centre line so silence still shows a calm thread
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, cy - Math.max(1, s * 0.0012), w, Math.max(1, s * 0.0024));
  },
};

const circleRing = {
  id: 'circle-ring',
  name: 'Circle Ring',
  ne: 'गोलो घेरा',
  cat: 'simple',
  text: (f) => (f.portrait
    ? { title: { y: 0.72 }, sub: { y: 0.765 } }
    : { title: { y: 0.855, size: 0.068 }, sub: { y: 0.925, size: 0.034 } }),
  setup: () => ({ bars: new Float32Array(120), spin: 0 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.3, zoom: 0.12 });
    vignette(ctx, f, 0.55);

    const cx = w / 2, cy = h * (f.portrait ? 0.42 : 0.42);
    const r = s * (f.portrait ? 0.24 : 0.17) * (1 + a.kick * 0.05);
    const n = st.bars.length;
    const m = mirrored(a.bands, n);
    st.spin += f.dt * (0.05 + a.energy * 0.15);

    // soft halo behind the circle that breathes with the bass
    const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * (1.9 + a.bass * 0.6));
    halo.addColorStop(0, rgba(f.color.accent, 0.35 + a.beat * 0.25));
    halo.addColorStop(1, rgba(f.color.accent, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, (TAU * r) / n * 0.5);
    for (let i = 0; i < n; i++) {
      st.bars[i] = lerp(st.bars[i], m[i], 0.6);
      const ang = (i / n) * TAU - Math.PI / 2 + st.spin;
      const len = s * (0.012 + st.bars[i] * 0.13);
      const r0 = r + s * 0.018;
      const c = Math.cos(ang), sn = Math.sin(ang);
      ctx.strokeStyle = i % 2 ? f.color.accent : shade(f.color.accent2, 0.15);
      ctx.beginPath();
      ctx.moveTo(cx + c * r0, cy + sn * r0);
      ctx.lineTo(cx + c * (r0 + len), cy + sn * (r0 + len));
      ctx.stroke();
    }

    withGlow(ctx, rgba(f.color.accent, 1), s * 0.04, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, r + s * 0.006, 0, TAU);
      ctx.lineWidth = Math.max(2, s * 0.007);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });
    circlePhoto(ctx, f, cx, cy, r, 1.05 + a.beat * 0.02);
  },
};


// Adds a rounded rectangle to the current path (no beginPath), so many bars
// can be filled with one call.
function addPill(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// One full-frame gradient that does two jobs: a colour glow around (cx, cy)
// that fades out at r1, then a dark vignette towards the corners. Cheaper
// than drawing a glow and a vignette separately.
function glowVignette(ctx, f, cx, cy, r0, r1, alpha, dark = 0.55) {
  const far = Math.max(Math.hypot(cx, cy), Math.hypot(f.w - cx, cy), Math.hypot(cx, f.h - cy), Math.hypot(f.w - cx, f.h - cy));
  const t1 = clamp((r1 - r0) / (far - r0), 0.05, 0.8);
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, far);
  g.addColorStop(0, rgba(f.color.accent, alpha));
  g.addColorStop(t1, rgba(f.color.accent, 0));
  g.addColorStop(Math.max(t1 + 0.01, 0.45), 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${dark})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.w, f.h);
}

// Fast rise, slower fall: bars jump with a hit and settle gently.
const follow = (cur, target, up = 0.6, down = 0.16) => lerp(cur, target, target > cur ? up : down);

const classicBars = {
  id: 'bars',
  name: 'Classic Bars',
  ne: 'क्लासिक बार',
  cat: 'simple',
  setup: (f) => {
    const n = f.portrait ? 28 : f.square ? 36 : 56;
    return { n, v: new Float32Array(n), peak: new Float32Array(n), hold: new Float32Array(n) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.1, punch: 0.012 });
    fadeEdge(ctx, f, 'bottom', 0.62, 0.88);
    fadeEdge(ctx, f, 'top', 0.3, 0.35);

    const n = st.n;
    const m = mirrored(a.bands, n);
    const base = h * (f.portrait ? 0.77 : 0.8);
    const maxH = s * (f.portrait ? 0.5 : 0.4);
    const side = w * (f.portrait ? 0.07 : 0.06);
    const step = (w - side * 2) / n;
    const bw = step * 0.64;
    const minH = s * 0.012;
    const gap = s * 0.008;

    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const taper = 0.55 + 0.45 * Math.sin(Math.PI * x);
      st.v[i] = follow(st.v[i], clamp(m[i] * taper * (1 + a.kick * 0.15)));
      if (st.v[i] >= st.peak[i]) { st.peak[i] = st.v[i]; st.hold[i] = 0.35; }
      else if ((st.hold[i] -= f.dt) <= 0) st.peak[i] = Math.max(st.v[i], st.peak[i] - f.dt * 0.55);
    }

    // bars
    const grad = ctx.createLinearGradient(0, base, 0, base - maxH);
    grad.addColorStop(0, shade(f.color.accent, -0.05));
    grad.addColorStop(0.55, f.color.accent);
    grad.addColorStop(1, shade(f.color.accent2, 0.3));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = minH + st.v[i] * maxH;
      addPill(ctx, side + i * step + (step - bw) / 2, base - bh, bw, bh, bw / 2);
    }
    withGlow(ctx, rgba(f.color.accent, 0.55 + a.beat * 0.3), s * 0.025, () => {
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // soft reflection under the floor line
    const refl = ctx.createLinearGradient(0, base + gap, 0, base + gap + maxH * 0.3);
    refl.addColorStop(0, rgba(f.color.accent, 0.38));
    refl.addColorStop(1, rgba(f.color.accent, 0));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = (minH + st.v[i] * maxH) * 0.3;
      addPill(ctx, side + i * step + (step - bw) / 2, base + gap, bw, bh, bw / 2);
    }
    ctx.fillStyle = refl;
    ctx.fill();

    // falling peak caps
    ctx.beginPath();
    const capH = Math.max(2, s * 0.007);
    for (let i = 0; i < n; i++) {
      const y = base - minH - st.peak[i] * maxH - gap - capH;
      addPill(ctx, side + i * step + (step - bw) / 2, y, bw, capH, capH / 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    // floor line
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(side, base + gap * 0.35, w - side * 2, Math.max(1, s * 0.0016));
  },
};

// Where every part of the player card sits, shared by text() and draw().
function playerLayout(f) {
  const { w, h, s } = f;
  if (!f.portrait && !f.square) {
    const c = h * 0.5, p = h * 0.06, iw = h * 0.68;
    const cw = p * 3 + c + iw, ch = c + p * 2;
    const x0 = (w - cw) / 2, y0 = (h - ch) / 2;
    const top = y0 + p;
    const ix = x0 + p * 2 + c;
    return {
      wide: true, x0, y0, cw, ch, r: s * 0.04, cx: x0 + p, cy: top, c, ix, iw,
      titleY: top + c * 0.14, subY: top + c * 0.29, titleSize: 0.06, subSize: 0.034,
      barsY: top + c * 0.52, barsH: c * 0.2,
      progY: top + c * 0.74, timeY: top + c * 0.83, ctrlY: top + c * 0.94, ctrlR: c * 0.085,
    };
  }
  const cw = f.portrait ? w * 0.84 : s * 0.54;
  const p = cw * 0.07, c = cw - p * 2;
  const ch = p + c + c * 0.78 + p * 0.5;
  const x0 = (w - cw) / 2, y0 = (h - ch) / 2 + (f.portrait ? h * 0.01 : 0);
  const top = y0 + p;
  return {
    wide: false, x0, y0, cw, ch, r: cw * 0.06, cx: x0 + p, cy: top, c, ix: x0 + p, iw: c,
    titleY: top + c * 1.12, subY: top + c * 1.215,
    titleSize: f.portrait ? 0.064 : 0.045, subSize: f.portrait ? 0.038 : 0.028,
    barsY: top + c * 1.35, barsH: c * 0.1,
    progY: top + c * 1.48, timeY: top + c * 1.54, ctrlY: top + c * 1.67, ctrlR: c * 0.075,
  };
}

// Prev / next icon: two triangles and a bar. dir = -1 for prev, 1 for next.
function skipIcon(ctx, x, y, r, dir) {
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    const ox = x + dir * (k - 0.5) * r * 0.9;
    ctx.moveTo(ox - dir * r * 0.45, y - r * 0.5);
    ctx.lineTo(ox + dir * r * 0.45, y);
    ctx.lineTo(ox - dir * r * 0.45, y + r * 0.5);
    ctx.closePath();
  }
  const bx = x + dir * r * 0.9 - (dir > 0 ? 0 : r * 0.14);
  ctx.rect(bx, y - r * 0.5, r * 0.14, r);
  ctx.fill();
}

const musicPlayer = {
  id: 'player',
  name: 'Music Player',
  ne: 'म्युजिक प्लेयर',
  cat: 'simple',
  text(f) {
    const L = playerLayout(f);
    return {
      title: { x: L.ix / f.w, y: L.titleY / f.h, size: L.titleSize, align: 'left', style: 'plain', maxW: L.iw / f.w },
      sub: { x: L.ix / f.w, y: L.subY / f.h, size: L.subSize, align: 'left', style: 'plain', opacity: 0.7, maxW: L.iw / f.w },
    };
  },
  setup: () => ({ v: new Float32Array(36) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const L = playerLayout(f);
    photoBackground(ctx, f, { kind: 'blur', dim: 0.32, zoom: 0.12 });

    // colour glow behind the card that breathes with the bass
    const gx = L.cx + L.c / 2, gy = L.cy + L.c / 2;
    glowVignette(ctx, f, gx, gy, L.c * 0.2, L.c * (1.2 + a.bass * 0.5), 0.3 + a.beat * 0.2, 0.45);

    // glass card
    roundRect(ctx, L.x0, L.y0, L.cw, L.ch, L.r);
    const card = ctx.createLinearGradient(0, L.y0, 0, L.y0 + L.ch);
    card.addColorStop(0, 'rgba(20,20,26,0.42)');
    card.addColorStop(1, 'rgba(8,8,12,0.62)');
    ctx.fillStyle = card;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();

    // album cover, a small bump on each kick
    const bump = 1 + a.kick * 0.018;
    const cs = L.c * bump, cx = L.cx - (cs - L.c) / 2, cy = L.cy - (cs - L.c) / 2;
    const cr = L.c * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let k = 3; k >= 1; k--) {
      const o = cs * 0.012 * k;
      roundRect(ctx, cx - o, cy - o + cs * 0.02, cs + o * 2, cs + o * 2, cr + o);
      ctx.fill();
    }
    coverPhoto(ctx, f, cx, cy, cs, cr, 1.04);

    // live bars, like a voice-note waveform
    const n = st.v.length;
    const m = mirrored(a.bands, n);
    const step = L.iw / n, bw = step * 0.55;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      st.v[i] = follow(st.v[i], m[i], 0.65, 0.2);
      const bh = Math.max(bw, st.v[i] * L.barsH * 2);
      addPill(ctx, L.ix + i * step + (step - bw) / 2, L.barsY - bh / 2, bw, bh, bw / 2);
    }
    const bg = ctx.createLinearGradient(L.ix, 0, L.ix + L.iw, 0);
    bg.addColorStop(0, f.color.accent2);
    bg.addColorStop(0.5, shade(f.color.accent, 0.15));
    bg.addColorStop(1, f.color.accent2);
    ctx.fillStyle = bg;
    ctx.fill();

    // progress bar
    const th = Math.max(3, s * 0.008);
    const prog = clamp(f.progress || 0);
    roundRect(ctx, L.ix, L.progY - th / 2, L.iw, th, th / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    roundRect(ctx, L.ix, L.progY - th / 2, Math.max(th, L.iw * prog), th, th / 2);
    ctx.fillStyle = shade(f.color.accent, 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(L.ix + L.iw * prog, L.progY, th * 1.3, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // times
    ctx.font = fontCss('mukta', L.subSize * s * 0.8, 500);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(f.t), L.ix, L.timeY);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(f.dur), L.ix + L.iw, L.timeY);

    // controls: prev, pause (it is playing), next
    const px = L.ix + L.iw / 2, py = L.ctrlY, R = L.ctrlR;
    ctx.beginPath();
    ctx.arc(px, py, R * (1.15 + a.beat * 0.35), 0, TAU);
    ctx.fillStyle = rgba(f.color.accent, 0.18 * (1 - a.beat * 0.5));
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, R, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#15151a';
    roundRect(ctx, px - R * 0.36, py - R * 0.4, R * 0.24, R * 0.8, R * 0.06);
    ctx.fill();
    roundRect(ctx, px + R * 0.12, py - R * 0.4, R * 0.24, R * 0.8, R * 0.06);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    skipIcon(ctx, px - R * 2.9, py, R * 0.62, -1);
    skipIcon(ctx, px + R * 2.9, py, R * 0.62, 1);
  },
};

const vinylRecord = {
  id: 'vinyl',
  name: 'Vinyl Record',
  ne: 'भिनाइल रेकर्ड',
  cat: 'simple',
  setup: () => ({ spin: 0, rings: new Float32Array(18), label: null, labelSrc: null }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.38, zoom: 0.1 });

    const cx = w * (f.portrait ? 0.46 : f.square ? 0.48 : 0.47);
    const cy = h * (f.portrait ? 0.52 : 0.6);
    const R = s * (f.portrait ? 0.38 : f.square ? 0.33 : 0.32) * (1 + a.kick * 0.025);
    st.spin += f.dt * TAU * 0.28 * (0.75 + a.energy * 0.7);

    // halo that swells with the bass
    glowVignette(ctx, f, cx, cy, R * 0.9, R * (1.45 + a.bass * 0.45), 0.32 + a.beat * 0.25, 0.55);
    // soft shadow just outside the disc
    const sh = ctx.createRadialGradient(cx, cy + R * 0.03, R * 0.96, cx, cy + R * 0.03, R * 1.12);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.03, R * 1.12, 0, TAU);
    ctx.fill();

    // the disc
    const disc = ctx.createRadialGradient(cx, cy, R * 0.35, cx, cy, R);
    disc.addColorStop(0, '#1b1b20');
    disc.addColorStop(0.7, '#0e0e12');
    disc.addColorStop(1, '#050507');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = disc;
    ctx.fill();

    // grooves that light up with their part of the spectrum
    const n = st.rings.length;
    const m = resample(a.bands, n);
    ctx.lineWidth = Math.max(1, s * 0.0022);
    for (let i = 0; i < n; i++) {
      st.rings[i] = follow(st.rings[i], m[n - 1 - i], 0.5, 0.15);
      const rr = R * (0.42 + (i / (n - 1)) * 0.54);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.strokeStyle = rgba(shade(f.color.accent, 0.2), 0.05 + st.rings[i] * st.rings[i] * 0.45);
      ctx.stroke();
    }

    // light sheen: two soft wedges that sway slowly
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const sway = -0.75 + 0.25 * Math.sin(f.t * 0.45);
    for (const off of [0, Math.PI]) {
      for (const wd of [0.1, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, sway + off - wd, sway + off + wd);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${0.045 + a.beat * 0.02})`;
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();

    // centre label: the photo, spinning
    const lr = R * 0.36;
    // the round label is drawn once into a small canvas, then just rotated
    const ls = Math.ceil(lr * 2.1);
    if (!st.label || st.labelSrc !== f.photo.sharp || st.label.width !== ls) {
      st.label = st.label || document.createElement('canvas');
      st.label.width = st.label.height = ls;
      const lc = st.label.getContext('2d');
      lc.beginPath();
      lc.arc(ls / 2, ls / 2, ls / 2, 0, TAU);
      lc.clip();
      drawCover(lc, f.photo.sharp, 0, 0, ls, ls, 1.05);
      st.labelSrc = f.photo.sharp;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st.spin);
    ctx.drawImage(st.label, -lr, -lr, lr * 2, lr * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, lr, 0, TAU);
    ctx.lineWidth = Math.max(1.5, s * 0.005);
    ctx.strokeStyle = f.color.accent;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.035, 0, TAU);
    ctx.fillStyle = '#0c0c0f';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();

    // tonearm, creeping inwards as the song plays
    const px = cx + R * 1.08, py = cy - R * 0.92;
    const ang = 0.32, rr = R * (0.9 - clamp(f.progress || 0) * 0.32);
    const tx = cx + Math.cos(ang) * rr, ty = cy + Math.sin(ang) * rr;
    const dir = Math.atan2(ty - py, tx - px);
    const lw = Math.max(2, R * 0.035);
    const arm = (color, off) => {
      ctx.save();
      ctx.translate(off, off * 1.5);
      ctx.lineCap = 'round';
      ctx.lineWidth = lw;
      ctx.strokeStyle = color || '#d9d9de';
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(dir) * R * 0.2, py - Math.sin(dir) * R * 0.2);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      // headshell
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(dir);
      ctx.fillStyle = color || '#ececf0';
      roundRect(ctx, -R * 0.02, -R * 0.045, R * 0.13, R * 0.09, R * 0.02);
      ctx.fill();
      ctx.restore();
      // counterweight
      ctx.save();
      ctx.translate(px - Math.cos(dir) * R * 0.22, py - Math.sin(dir) * R * 0.22);
      ctx.rotate(dir);
      ctx.fillStyle = color || '#9a9aa2';
      roundRect(ctx, -R * 0.06, -R * 0.045, R * 0.09, R * 0.09, R * 0.02);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    };
    arm('rgba(0,0,0,0.35)', R * 0.025); // shadow
    arm(null, 0);
    const base = ctx.createRadialGradient(px - R * 0.03, py - R * 0.03, 0, px, py, R * 0.11);
    base.addColorStop(0, '#f2f2f5');
    base.addColorStop(1, '#6d6d75');
    ctx.beginPath();
    ctx.arc(px, py, R * 0.1, 0, TAU);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, R * 0.04, 0, TAU);
    ctx.fillStyle = '#2a2a30';
    ctx.fill();
  },
};

// Back to front: high notes far away, bass in the front wave.
const OCEAN = [
  { lo: 0.62, hi: 1.0, y: 0.6, fr: 2.1, sp: 0.35, seed: 0.3, tone: 0.3, alpha: 0.45 },
  { lo: 0.42, hi: 0.66, y: 0.67, fr: 2.7, sp: -0.5, seed: 1.7, tone: 0.2, alpha: 0.55 },
  { lo: 0.24, hi: 0.46, y: 0.74, fr: 1.8, sp: 0.62, seed: 2.9, tone: 0.1, alpha: 0.66 },
  { lo: 0.1, hi: 0.26, y: 0.81, fr: 2.4, sp: -0.78, seed: 4.1, tone: 0.02, alpha: 0.78 },
  { lo: 0.0, hi: 0.1, y: 0.88, fr: 1.5, sp: 0.95, seed: 5.3, tone: -0.12, alpha: 0.93 },
];

const oceanWaves = {
  id: 'ocean-waves',
  name: 'Layered Waves',
  ne: 'लहरैलहर',
  cat: 'simple',
  setup: () => ({ v: new Float32Array(OCEAN.length), pts: OCEAN.map(() => []) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.08 });
    fadeEdge(ctx, f, 'top', 0.3, 0.35); // the waves themselves cover the bottom

    const n = 34;
    const lift = f.portrait ? 0.06 : 0;
    const spread = f.portrait ? 0.75 : 1;
    OCEAN.forEach((L, k) => {
      const raw = band(f, L.lo, L.hi) * (k === OCEAN.length - 1 ? 1 + a.kick * 0.5 : 1);
      st.v[k] = follow(st.v[k], raw, 0.35, 0.1);
      const v = st.v[k];
      const base = h * (1 - (1 - L.y) * spread - lift) - v * s * 0.05;
      const amp = s * (0.022 + v * 0.075);
      const fr = L.fr * (f.portrait ? 0.6 : 1);
      const pts = st.pts[k];
      pts.length = n;
      let top = h;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        const y = base - amp * (
          0.65 * Math.sin(x * fr * TAU + f.t * L.sp * 2 + L.seed)
          + 0.22 * Math.sin(x * fr * 2.3 * TAU - f.t * L.sp * 1.4 + L.seed * 2)
          + 0.25 * noise1(x * 3 + f.t * L.sp, k));
        const p = pts[i] || (pts[i] = [0, 0]);
        p[0] = -w * 0.04 + x * w * 1.08;
        p[1] = y;
        if (y < top) top = y;
      }
      const col = shade(mix(f.color.accent2, f.color.accent, k / (OCEAN.length - 1)), L.tone);
      const g = ctx.createLinearGradient(0, top, 0, h);
      g.addColorStop(0, rgba(col, L.alpha));
      g.addColorStop(1, rgba(shade(col, -0.55), Math.min(1, L.alpha + 0.1)));
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w * 1.04, h);
      ctx.lineTo(-w * 0.04, h);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      // bright crest line
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineWidth = Math.max(1, s * (0.002 + k * 0.0006));
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + v * 0.35})`;
      ctx.stroke();
    });
  },
};

// Three see-through layers, back to front.
const BLOB = [
  { seed: 3, push: 0.62, wob: 0.13, size: 1.16, alpha: 0.28, spin: 0.12 },
  { seed: 7, push: 0.46, wob: 0.1, size: 1.1, alpha: 0.42, spin: -0.09 },
  { seed: 11, push: 0.3, wob: 0.06, size: 1.05, alpha: 0.9, spin: 0.05 },
];

const liquidBlob = {
  id: 'blob',
  name: 'Liquid Blob',
  ne: 'तरल थोपा',
  cat: 'simple',
  setup: () => ({ v: new Float32Array(48), pts: Array.from({ length: 48 }, () => [0, 0]) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.42, zoom: 0.12 });

    const cx = w / 2, cy = h * (f.portrait ? 0.5 : 0.57);
    const r = s * (f.portrait ? 0.24 : f.square ? 0.18 : 0.19) * (1 + a.kick * 0.04);
    const n = st.v.length;
    const nb = a.bands.length;
    // spectrum runs twice round the circle, bass at top and bottom, so it stays balanced
    for (let i = 0; i < n; i++) {
      const p = ((i / n) * 2 + 0.25) % 1;
      const d = Math.abs(p * 2 - 1);
      st.v[i] = follow(st.v[i], a.bands[Math.round((1 - d) * (nb - 1) * 0.8)], 0.4, 0.12);
    }

    glowVignette(ctx, f, cx, cy, r, r * (2.4 + a.bass * 0.6), 0.22 + a.beat * 0.18, 0.5);

    BLOB.forEach((L, k) => {
      const rot = f.t * L.spin;
      // wobble made of whole waves around the circle, so the loop closes cleanly
      const w2 = noise1(f.t * 0.6, L.seed), w3 = noise1(f.t * 0.5 + 9, L.seed), w5 = noise1(f.t * 0.8 + 21, L.seed);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * TAU + rot;
        // spectrum position, offset per layer so the layers do not move as one
        const sv = st.v[(i + k * 5) % n];
        const wob = w2 * Math.sin(2 * th + f.t * 0.7) + w3 * Math.sin(3 * th - f.t * 0.9) * 0.7 + w5 * Math.sin(5 * th + f.t * 1.3) * 0.4;
        const rr = r * (L.size + (L.push * sv * sv * 1.3 + L.wob * wob) * (1 + a.kick * 0.35));
        st.pts[i][0] = cx + Math.cos(th) * rr;
        st.pts[i][1] = cy + Math.sin(th) * rr;
      }
      ctx.beginPath();
      smoothLoop(ctx, st.pts);
      if (k === BLOB.length - 1) {
        const g = ctx.createRadialGradient(cx, cy - r * 0.5, r * 0.2, cx, cy, r * 1.6);
        g.addColorStop(0, shade(f.color.accent2, 0.25));
        g.addColorStop(1, f.color.accent);
        withGlow(ctx, rgba(f.color.accent, 0.9), s * 0.022, () => {
          ctx.globalAlpha = L.alpha;
          ctx.fillStyle = g;
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = rgba(k ? mix(f.color.accent, f.color.accent2, 0.5) : f.color.accent2, L.alpha);
        ctx.fill();
        ctx.lineWidth = Math.max(1, s * 0.002);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
      }
    });

    ctx.beginPath();
    ctx.arc(cx, cy, r + s * 0.004, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    circlePhoto(ctx, f, cx, cy, r, 1.05 + a.beat * 0.02);
  },
};

const pulseLine = {
  id: 'pulse-line',
  name: 'Pulse Line',
  ne: 'धड्कन रेखा',
  cat: 'simple',
  setup: () => ({
    v: new Float32Array(110), e1: new Float32Array(110), e2: new Float32Array(110),
    pts: Array.from({ length: 110 }, () => [0, 0]), peak: 0.3,
  }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.58, zoom: 0.1 });

    const cy = h * (f.portrait ? 0.52 : 0.56);
    const n = st.v.length;
    const wave = a.wave, wl = wave.length;
    const win = 20;

    // soft glow that swells with the bass
    const gr = s * (0.3 + a.bass * 0.25) * (f.portrait ? 1.2 : 2);
    glowVignette(ctx, f, w / 2, cy, 0, gr, 0.16 + a.beat * 0.2, 0.6);

    // sample the waveform, lightly averaged so it reads as a smooth line
    let pk = 0;
    for (let i = 0; i < n; i++) {
      const j = Math.floor((i / (n - 1)) * (wl - win));
      let sum = 0;
      for (let k = 0; k < win; k++) sum += wave[j + k];
      st.pts[i][0] = sum / win;
      pk = Math.max(pk, Math.abs(st.pts[i][0]));
    }
    // two soft blur passes along the line
    for (let pass = 0; pass < 2; pass++) {
      let prev = st.pts[0][0];
      for (let i = 1; i < n - 1; i++) {
        const cur = st.pts[i][0];
        st.pts[i][0] = (prev + cur * 2 + st.pts[i + 1][0]) / 4;
        prev = cur;
      }
    }
    st.peak = pk > st.peak ? pk : lerp(st.peak, pk, 0.03);
    const norm = 1 / Math.max(0.12, st.peak);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const taper = Math.pow(Math.sin(Math.PI * x), 1.6);
      const target = st.pts[i][0] * norm * taper;
      st.v[i] = lerp(st.v[i], target, 0.45);
      st.e1[i] = lerp(st.e1[i], st.v[i], 0.14);
      st.e2[i] = lerp(st.e2[i], st.v[i], 0.06);
    }

    const amp = s * (f.portrait ? 0.16 : 0.14) * (0.45 + a.level * 0.9 + a.kick * 0.3);
    const line = (arr, scale, color, width) => {
      for (let i = 0; i < n; i++) {
        st.pts[i][0] = (i / (n - 1)) * w;
        st.pts[i][1] = cy - arr[i] * amp * scale;
      }
      ctx.beginPath();
      smoothLine(ctx, st.pts);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const thin = Math.max(1, s * 0.0022);
    line(st.e2, 1.6, rgba(shade(f.color.accent2, 0.2), 0.22), thin);
    line(st.e2, -1.6, rgba(shade(f.color.accent2, 0.2), 0.22), thin);
    line(st.e1, 1.25, rgba(shade(f.color.accent2, 0.2), 0.38), thin);
    line(st.e1, -1.25, rgba(shade(f.color.accent2, 0.2), 0.38), thin);
    line(st.v, -0.75, rgba(shade(f.color.accent, 0.2), 0.55), thin * 1.5);
    withGlow(ctx, rgba(f.color.accent, 1), s * (0.025 + a.beat * 0.02), () => {
      line(st.v, 1, '#ffffff', Math.max(2, s * 0.0055));
    });
  },
};

export default [softWave, circleRing, classicBars, musicPlayer, vinylRecord, oceanWaves, liquidBlob, pulseLine];
