// Simple, clean looks. The "satisfying wave" family lives here.
import {
  TAU, clamp, lerp, rgba, shade, mix, mirrored, resample, smoothLine, smoothLoop,
  photoBackground, fadeEdge, vignette, circlePhoto, coverPhoto, withGlow,
  roundRect, drawCover, band, noise1, formatTime, rng, slowZoom,
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

// ---------- Silk Lines ----------
// Each thread listens to its own slice of the spectrum, bass first.
const SILK = [
  { lo: 0.0, hi: 0.08, k: 1.15, sp: 1.1, ph: 0.0, c: 0.0, gain: 1.15 },
  { lo: 0.06, hi: 0.18, k: 1.55, sp: -1.4, ph: 1.3, c: 0.2, gain: 1.05 },
  { lo: 0.16, hi: 0.32, k: 2.0, sp: 1.7, ph: 2.6, c: 0.45, gain: 1.0 },
  { lo: 0.3, hi: 0.5, k: 2.45, sp: -2.0, ph: 3.9, c: 0.7, gain: 1.05 },
  { lo: 0.48, hi: 0.72, k: 2.9, sp: 2.3, ph: 5.1, c: 1.0, gain: 1.15 },
  { lo: 0.7, hi: 1.0, k: 3.4, sp: -2.6, ph: 0.7, c: 0.55, gain: 1.25 },
];

const silkLines = {
  id: 'silk',
  name: 'Silk Lines',
  ne: 'रेशमी धागो',
  cat: 'simple',
  setup: () => ({
    v: new Float32Array(SILK.length), ph: SILK.map((L) => L.ph),
    pts: Array.from({ length: 72 }, () => [0, 0]),
  }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.1 });
    fadeEdge(ctx, f, 'bottom', 0.58, 0.82);
    fadeEdge(ctx, f, 'top', 0.3, 0.35);

    const cy = h * (f.portrait ? 0.75 : 0.77);
    const n = st.pts.length;
    const maxA = s * (f.portrait ? 0.17 : 0.15);

    // soft light behind the threads that breathes with the bass
    const gr = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, w * 0.5);
    gr.addColorStop(0, rgba(f.color.accent, 0.16 + a.bass * 0.12 + a.beat * 0.06));
    gr.addColorStop(1, rgba(f.color.accent, 0));
    ctx.save();
    ctx.translate(w / 2, cy);
    ctx.scale(1, 0.32);
    ctx.translate(-w / 2, -cy);
    ctx.fillStyle = gr;
    ctx.fillRect(0, cy - w * 0.5, w, w);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const thin = Math.max(1.2, s * 0.0026);
    SILK.forEach((L, j) => {
      st.v[j] = follow(st.v[j], band(f, L.lo, L.hi) * L.gain, 0.5, 0.07);
      st.ph[j] += f.dt * L.sp * (0.5 + a.energy * 0.9);
      const amp = maxA * (0.12 + st.v[j] * 0.88) * (1 + a.kick * 0.18);
      // the widest part drifts slowly, so the threads cross and weave
      const c = 0.5 + 0.16 * noise1(f.t * 0.13 + j * 3.1, j);
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        const env = Math.exp(-Math.pow((x - c) / 0.27, 2)) * Math.pow(Math.sin(Math.PI * x), 0.7);
        st.pts[i][0] = x * w;
        st.pts[i][1] = cy - amp * env * Math.sin(x * L.k * TAU + st.ph[j]);
      }
      const col = shade(mix(f.color.accent2, f.color.accent, L.c), 0.22);
      // every thread fades out towards both edges
      const fade = (al, c = col) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.22, rgba(c, al));
        g.addColorStop(0.78, rgba(c, al));
        g.addColorStop(1, rgba(c, 0));
        return g;
      };
      // faint body between the thread and the centre line
      ctx.beginPath();
      smoothLine(ctx, st.pts);
      ctx.lineTo(w, cy);
      ctx.lineTo(0, cy);
      ctx.closePath();
      ctx.fillStyle = fade(0.045);
      ctx.fill();
      // wide faint stroke for the glow, thin bright one on top
      ctx.beginPath();
      smoothLine(ctx, st.pts);
      ctx.strokeStyle = fade(0.14);
      ctx.lineWidth = thin * 5;
      ctx.stroke();
      ctx.strokeStyle = fade(0.9, shade(col, 0.3));
      ctx.lineWidth = j === 0 ? thin * 1.4 : thin;
      ctx.stroke();
    });
    ctx.restore();

    // quiet centre thread that fades out at both ends
    const cl = ctx.createLinearGradient(0, 0, w, 0);
    cl.addColorStop(0, 'rgba(255,255,255,0)');
    cl.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    cl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cl;
    ctx.fillRect(0, cy - Math.max(0.5, s * 0.0008), w, Math.max(1, s * 0.0016));
  },
};

// ---------- Mirror Bars ----------
const mirrorBars = {
  id: 'mirror-bars',
  name: 'Mirror Bars',
  ne: 'ऐना बार',
  cat: 'simple',
  setup: (f) => {
    const n = f.portrait ? 52 : f.square ? 68 : 100;
    return { n, v: new Float32Array(n) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.1 });
    fadeEdge(ctx, f, 'bottom', 0.55, 0.85);
    fadeEdge(ctx, f, 'top', 0.3, 0.35);

    const n = st.n;
    const m = mirrored(a.bands, n);
    const base = h * (f.portrait ? 0.8 : 0.82);
    const up = s * (f.portrait ? 0.2 : 0.19);
    const down = up * 0.45;
    const side = w * (f.portrait ? 0.07 : 0.07);
    const step = (w - side * 2) / n;
    const bw = Math.max(1.5, step * 0.5);
    const gap = Math.max(1, s * 0.003);

    for (let i = 0; i < n; i++) {
      // a light blur with the neighbours keeps the outline smooth
      const v = (m[Math.max(0, i - 1)] + m[i] * 2 + m[Math.min(n - 1, i + 1)]) / 4;
      const x = i / (n - 1);
      const taper = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * x), 0.8);
      st.v[i] = follow(st.v[i], clamp(Math.pow(v, 1.5) * 1.15 * taper * (1 + a.kick * 0.18)), 0.55, 0.12);
    }

    // soft light under the middle, swelling with the bass
    const gr = ctx.createRadialGradient(w / 2, base, 0, w / 2, base, w * 0.45);
    gr.addColorStop(0, rgba(f.color.accent, 0.14 + a.bass * 0.14));
    gr.addColorStop(1, rgba(f.color.accent, 0));
    ctx.save();
    ctx.translate(w / 2, base);
    ctx.scale(1, 0.35);
    ctx.translate(-w / 2, -base);
    ctx.fillStyle = gr;
    ctx.fillRect(0, base - w * 0.45, w, w * 0.9);
    ctx.restore();

    // upper half, with a soft glow
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = bw + st.v[i] * up;
      addPill(ctx, side + i * step + (step - bw) / 2, base - gap - bh, bw, bh, bw / 2);
    }
    const g = ctx.createLinearGradient(0, base, 0, base - up);
    g.addColorStop(0, shade(f.color.accent, 0.1));
    g.addColorStop(1, shade(f.color.accent2, 0.45));
    withGlow(ctx, rgba(f.color.accent, 0.45 + a.beat * 0.3), s * 0.012, () => {
      ctx.fillStyle = g;
      ctx.fill();
    });

    // lower half, softer, like a reflection
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = bw + st.v[i] * down;
      addPill(ctx, side + i * step + (step - bw) / 2, base + gap, bw, bh, bw / 2);
    }
    const g2 = ctx.createLinearGradient(0, base, 0, base + down);
    g2.addColorStop(0, rgba(shade(f.color.accent, 0.2), 0.6));
    g2.addColorStop(1, rgba(f.color.accent, 0.15));
    ctx.fillStyle = g2;
    ctx.fill();
  },
};

// ---------- Liquid ----------
const liquid = {
  id: 'liquid',
  name: 'Liquid',
  ne: 'पानीको सतह',
  cat: 'simple',
  setup() {
    const r = rng(41);
    const bubbles = [];
    for (let i = 0; i < 26; i++) {
      bubbles.push({ x: 0.04 + r() * 0.92, u: r(), sp: 0.08 + r() * 0.12, rad: 0.003 + r() * 0.006, ph: r() * TAU });
    }
    const n = 56;
    return {
      bubbles, n, spec: new Float32Array(n), tmp: new Float32Array(n), ripples: [],
      front: Array.from({ length: n }, () => [0, 0]), back: Array.from({ length: n }, () => [0, 0]),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.08 });
    fadeEdge(ctx, f, 'top', 0.3, 0.35);
    fadeEdge(ctx, f, 'bottom', 0.45, 0.45);

    const n = st.n;
    // spectrum, bass in the middle, blurred into a gentle swell
    const m = mirrored(a.bands, n);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) st.tmp[i] = (m[Math.max(0, i - 1)] + m[i] * 2 + m[Math.min(n - 1, i + 1)]) / 4;
      m.set(st.tmp);
    }
    for (let i = 0; i < n; i++) st.spec[i] = follow(st.spec[i], m[i], 0.45, 0.08);

    // each beat sends a ripple out from the middle
    if (a.beatHit) st.ripples.push(0);
    for (let k = st.ripples.length - 1; k >= 0; k--) {
      st.ripples[k] += f.dt;
      if (st.ripples[k] > 2.5) st.ripples.splice(k, 1);
    }

    const level = h * (f.portrait ? 0.8 : 0.8) - a.energy * s * 0.03;
    const x0 = -w * 0.02, dx = (w * 1.04) / (n - 1);
    let top = h;
    const surface = (pts, lift, sp, ph, amp) => {
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        let y = level - lift
          - s * (0.024 * Math.sin(x * TAU * 1.1 + f.t * 0.9 * sp + ph) + 0.012 * Math.sin(x * TAU * 2.7 - f.t * 1.6 * sp + ph * 2)) * (0.7 + a.level * 0.6)
          - st.spec[i] * s * 0.09 * amp;
        for (const age of st.ripples) {
          const d = Math.abs(x - 0.5) * w - age * s * 0.55;
          if (d < 0 && d > -s * 0.5) y -= s * 0.012 * amp * Math.exp(-age * 1.6) * Math.sin(d / (s * 0.05)) * Math.min(1, -d / (s * 0.05));
        }
        pts[i][0] = x0 + i * dx;
        pts[i][1] = y;
        if (y < top) top = y;
      }
    };
    surface(st.back, s * 0.028, -0.8, 2.1, 0.75);
    surface(st.front, 0, 1, 0, 1);

    const fill = (pts) => {
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w * 1.02, h);
      ctx.lineTo(-w * 0.02, h);
      ctx.closePath();
    };
    // back layer
    fill(st.back);
    ctx.fillStyle = rgba(shade(f.color.accent2, 0.1), 0.38);
    ctx.fill();
    ctx.beginPath();
    smoothLine(ctx, st.back);
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();

    // front water
    fill(st.front);
    const g = ctx.createLinearGradient(0, top, 0, h);
    const wc = mix(f.color.accent, f.color.accent2, 0.35);
    g.addColorStop(0, rgba(shade(wc, -0.05), 0.55));
    g.addColorStop(0.35, rgba(shade(wc, -0.5), 0.8));
    g.addColorStop(1, rgba(shade(wc, -0.82), 0.95));
    ctx.fillStyle = g;
    ctx.fill();

    // light just under the surface
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(0, top, 0, top + s * 0.12);
    lg.addColorStop(0, rgba(shade(f.color.accent, 0.4), 0.22 + a.beat * 0.08));
    lg.addColorStop(1, rgba(f.color.accent, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, top, w, s * 0.12);

    // bubbles rising through the water
    ctx.lineWidth = Math.max(1, s * 0.0016);
    for (const b of st.bubbles) {
      b.u += f.dt * b.sp * (0.5 + a.level * 0.8);
      if (b.u > 1) b.u -= 1;
      const bx = b.x * w + Math.sin(b.u * TAU * 1.5 + b.ph) * s * 0.008;
      const k = clamp((bx - x0) / dx, 0, n - 1.001);
      const i = Math.floor(k);
      const sy = lerp(st.front[i][1], st.front[i + 1][1], k - i);
      const r = b.rad * s * (0.8 + b.u * 0.5);
      const by = lerp(h + r, sy + r * 2, b.u);
      const alpha = Math.min(1, (1 - b.u) * 5) * Math.min(1, b.u * 8);
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${0.4 * alpha})`;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.1 * alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // bright crest
    ctx.beginPath();
    smoothLine(ctx, st.front);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(shade(f.color.accent, 0.5), 0.25);
    ctx.lineWidth = Math.max(2, s * 0.012);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.2, s * 0.0028);
    ctx.stroke();
  },
};

// ---------- Dot Wave ----------
const DOT_ROWS = 16;

const dotWave = {
  id: 'dot-wave',
  name: 'Dot Wave',
  ne: 'थोप्लो लहर',
  cat: 'simple',
  setup: (f) => {
    const cols = f.portrait ? 30 : f.square ? 40 : 56;
    return { cols, hist: new Float32Array(DOT_ROWS * cols), now: new Float32Array(cols) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.12 });
    fadeEdge(ctx, f, 'bottom', 0.6, 0.9);
    fadeEdge(ctx, f, 'top', 0.3, 0.35);

    const C = st.cols, R = DOT_ROWS;
    const m = mirrored(a.bands, C);
    // the front row follows the music, every row behind it follows the one in front
    const near = (R - 1) * C;
    for (let c = 0; c < C; c++) {
      const v = (m[Math.max(0, c - 1)] + m[c] * 2 + m[Math.min(C - 1, c + 1)]) / 4;
      st.hist[near + c] = follow(st.hist[near + c], clamp(v * v * 1.3 * (1 + a.kick * 0.25)), 0.5, 0.12);
    }
    const k = 1 - Math.exp(-f.dt * 7);
    for (let r = 0; r < R - 1; r++) {
      for (let c = 0; c < C; c++) st.hist[r * C + c] = lerp(st.hist[r * C + c], st.hist[(r + 1) * C + c], k);
    }

    const hy = h * (f.portrait ? 0.6 : 0.56);
    const yNear = h * (f.portrait ? 0.93 : 0.93);
    const spanNear = w * (f.portrait ? 0.96 : 0.92);
    const zFar = 4;
    const lift = s * (f.portrait ? 0.13 : 0.15);
    const dot = s * (f.portrait ? 0.0056 : 0.0042);
    for (let r = 0; r < R; r++) {
      const p = r / (R - 1);
      const z = lerp(zFar, 1, p);
      const sc = 1 / z;
      const y0 = hy + (yNear - hy) * (sc - 1 / zFar) / (1 - 1 / zFar);
      const span = spanNear * sc;
      const col = shade(mix(f.color.accent2, f.color.accent, p), 0.2 + 0.15 * p);
      // fade towards both sides, so the field ends softly
      const g = ctx.createLinearGradient(w / 2 - span / 2, 0, w / 2 + span / 2, 0);
      const al = 0.2 + 0.8 * p;
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.2, rgba(col, al));
      g.addColorStop(0.8, rgba(col, al));
      g.addColorStop(1, rgba(col, 0));
      ctx.beginPath();
      for (let c = 0; c < C; c++) {
        const v = st.hist[r * C + c];
        const xn = c / (C - 1);
        const x = w / 2 + (xn - 0.5) * span;
        const amb = Math.sin(xn * 9 + f.t * 1.4 + r * 0.6) * 0.012 + Math.sin(xn * 4 - f.t * 0.8 + r * 0.3) * 0.01;
        const y = y0 - (v * lift + amb * s) * sc;
        const rad = Math.max(0.6, dot * sc * (0.75 + v * 0.7));
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, TAU);
      }
      ctx.fillStyle = g;
      ctx.fill();
    }
    // soft halo on the front rows, swelling on the beat
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(w / 2, yNear, 0, w / 2, yNear, spanNear * 0.55);
    hg.addColorStop(0, rgba(f.color.accent, 0.12 + a.bass * 0.1 + a.beat * 0.05));
    hg.addColorStop(1, rgba(f.color.accent, 0));
    ctx.translate(w / 2, yNear);
    ctx.scale(1, 0.4);
    ctx.translate(-w / 2, -yNear);
    ctx.fillStyle = hg;
    ctx.fillRect(0, yNear - spanNear * 0.55, w, spanNear * 1.1);
    ctx.restore();
  },
};

// ---------- Aurora ----------
// A curtain texture: bright along the bottom edge, fading upwards, with fine
// vertical streaks. Drawn once per colour, then stretched slice by slice.
function auroraTexture(col, top, seed) {
  const TW = 256, TH = 256;
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, TH);
  gr.addColorStop(0, rgba(top, 0));
  gr.addColorStop(0.45, rgba(mix(top, col, 0.5), 0.35));
  gr.addColorStop(0.86, rgba(col, 0.95));
  gr.addColorStop(0.93, rgba(shade(col, 0.5), 1));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, TW, TH);
  // streaks: keep each column at its own strength
  const mask = document.createElement('canvas');
  mask.width = TW; mask.height = 1;
  const mg = mask.getContext('2d');
  for (let x = 0; x < TW; x++) {
    const v = 0.5 + 0.3 * noise1(x * 0.09, seed) + 0.2 * noise1(x * 0.37, seed + 3);
    mg.fillStyle = `rgba(0,0,0,${clamp(v * v * 1.4, 0.25, 1)})`;
    mg.fillRect(x, 0, 1, 1);
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0, TW, TH);
  return c;
}

const CURTAINS = [
  { y: 0.36, hgt: 0.3, lo: 0.3, hi: 0.7, sp: 0.6, ph: 0.4, seed: 2, col: 'accent2', alpha: 0.55 },
  { y: 0.47, hgt: 0.34, lo: 0.0, hi: 0.3, sp: -0.45, ph: 2.3, seed: 5, col: 'accent', alpha: 0.75 },
  { y: 0.52, hgt: 0.22, lo: 0.55, hi: 1.0, sp: 0.8, ph: 4.1, seed: 9, col: 'mix', alpha: 0.5 },
];
const AURORA_SLICES = 84;

const aurora = {
  id: 'aurora',
  name: 'Aurora',
  ne: 'आकाशको ज्योति',
  cat: 'simple',
  text: (f) => (f.portrait
    ? { title: { y: 0.66 }, sub: { y: 0.705 } }
    : { title: { y: 0.68 }, sub: { y: 0.76 } }),
  setup: () => ({
    tex: {}, v: CURTAINS.map(() => new Float32Array(AURORA_SLICES)),
    line: new Float32Array(64), pts: Array.from({ length: 64 }, () => [0, 0]),
  }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.5 });
    fadeEdge(ctx, f, 'top', 0.7, 0.62, '#02040c');
    fadeEdge(ctx, f, 'bottom', 0.4, 0.75);

    const lift = f.portrait ? -0.06 : 0;
    const S = AURORA_SLICES;
    // the curtains are soft, so they are drawn at half size and scaled up
    const q = 0.4;
    const bw = Math.max(1, Math.round(w * q)), bhh = Math.max(1, Math.round(h * 0.72 * q));
    if (!st.buf) st.buf = document.createElement('canvas');
    if (st.buf.width !== bw || st.buf.height !== bhh) { st.buf.width = bw; st.buf.height = bhh; }
    const bx = st.buf.getContext('2d');
    bx.globalCompositeOperation = 'source-over';
    bx.globalAlpha = 1;
    bx.clearRect(0, 0, bw, bhh);
    bx.globalCompositeOperation = 'lighter';
    CURTAINS.forEach((L, j) => {
      const base = L.col === 'mix' ? mix(f.color.accent, f.color.accent2, 0.5) : f.color[L.col];
      const col = shade(base, 0.3);
      const key = col + j;
      if (!st.tex[key]) st.tex[key] = auroraTexture(col, shade(f.color.accent2, 0.1), L.seed);
      const tex = st.tex[key];
      const v = st.v[j];
      const spec = band(f, L.lo, L.hi);
      const by = h * (L.y + lift);
      const ph = f.t * 0.05 * L.sp + L.ph;
      for (let i = 0; i < S; i++) {
        const xn = (i + 0.5) / S;
        // the curtain's strength travels slowly along its length
        const local = spec * (0.75 + 0.35 * Math.sin(xn * 7 + f.t * L.sp * 1.3 + L.ph));
        v[i] = follow(v[i], local, 0.35, 0.05);
        const x0 = Math.round((i / S) * bw), x1 = Math.round(((i + 1) / S) * bw);
        const yb = by + s * (0.07 * Math.sin(xn * TAU * 0.75 + ph) + 0.035 * Math.sin(xn * TAU * 1.9 - ph * 1.7) + 0.02 * noise1(xn * 4 + f.t * 0.12, j));
        const hh = s * L.hgt * (0.65 + v[i] * 0.7) * (1 + a.kick * 0.06);
        const edge = Math.pow(Math.sin(Math.PI * xn), 0.6);
        bx.globalAlpha = clamp(L.alpha * edge * (0.35 + v[i] * 0.9 + a.beat * 0.08));
        // streaks sway slowly sideways, like a real curtain of light
        const sx = 52 + xn * 150 + 45 * Math.sin(f.t * 0.07 * L.sp + j * 2);
        bx.drawImage(tex, sx, 0, 150 / S, 256, x0, (yb - hh) * q, x1 - x0, hh * 1.08 * q);
      }
    });
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(st.buf, 0, 0, w, bhh / q);
    ctx.restore();

    // thin glowing wave line along the bottom
    const n = st.line.length;
    const m = mirrored(a.bands, n);
    const cy = h * (f.portrait ? 0.86 : 0.88);
    const amp = s * 0.055 * (1 + a.kick * 0.15);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const v = (m[Math.max(0, i - 1)] + m[i] * 2 + m[Math.min(n - 1, i + 1)]) / 4;
      st.line[i] = follow(st.line[i], v * Math.pow(Math.sin(Math.PI * x), 1.2), 0.5, 0.1);
      st.pts[i][0] = w * (0.08 + x * 0.84);
      st.pts[i][1] = cy - st.line[i] * amp * Math.sin(x * TAU * 3 + f.t * 1.2);
    }
    const lg = ctx.createLinearGradient(w * 0.08, 0, w * 0.92, 0);
    lg.addColorStop(0, rgba(f.color.accent2, 0));
    lg.addColorStop(0.5, shade(f.color.accent, 0.55));
    lg.addColorStop(1, rgba(f.color.accent2, 0));
    ctx.lineCap = 'round';
    withGlow(ctx, rgba(f.color.accent, 0.9), s * 0.02, () => {
      ctx.beginPath();
      smoothLine(ctx, st.pts);
      ctx.strokeStyle = lg;
      ctx.lineWidth = Math.max(1.5, s * 0.003);
      ctx.stroke();
    });
  },
};

// ---------- Horizon ----------
// Height of each black band.
function horizonBand(f) {
  if (f.portrait) return f.h * 0.15;
  if (f.square) return f.h * 0.15;
  return f.h * 0.14;
}

const horizon = {
  id: 'horizon',
  name: 'Horizon',
  ne: 'क्षितिज',
  cat: 'simple',
  text(f) {
    const b = horizonBand(f) / f.h;
    return {
      title: { y: b * 0.44, size: f.portrait ? 0.062 : 0.05, font: 'martel', style: 'plain' },
      sub: { y: b * 0.8, size: f.portrait ? 0.032 : 0.027, style: 'plain', opacity: 0.6 },
    };
  },
  setup: () => ({ v: new Float32Array(80), pts: Array.from({ length: 80 }, () => [0, 0]) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const bh = horizonBand(f);
    // gentle grade (a colour wash in soft light), made once per photo and colour
    const key = f.color.accent + f.color.accent2;
    if (!st.graded || st.src !== f.photo.sharp || st.key !== key) {
      const src = f.photo.sharp;
      const c = st.graded || document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'soft-light';
      const gg = g.createLinearGradient(0, 0, c.width, c.height);
      gg.addColorStop(0, rgba(f.color.accent2, 0.5));
      gg.addColorStop(1, rgba(f.color.accent, 0.5));
      g.fillStyle = gg;
      g.fillRect(0, 0, c.width, c.height);
      st.graded = c; st.src = src; st.key = key;
    }
    const z = slowZoom(f, 0.1);
    drawCover(ctx, st.graded, 0, 0, w, h, z.zoom, z.fx, z.fy);
    vignette(ctx, f, 0.5);
    // warm light rising from the bottom on the bass
    const lg = ctx.createLinearGradient(0, h - bh - s * 0.25, 0, h - bh);
    lg.addColorStop(0, rgba(f.color.accent, 0));
    lg.addColorStop(1, rgba(f.color.accent, 0.08 + a.bass * 0.1));
    ctx.fillStyle = lg;
    ctx.fillRect(0, h - bh - s * 0.25, w, s * 0.25);

    // the bands
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, w, bh);
    ctx.fillRect(0, h - bh, w, bh);

    // one thin spectrum line in the bottom band
    const n = st.v.length;
    const m = mirrored(a.bands, n);
    const cy = h - bh * 0.5;
    const half = w * (f.portrait ? 0.4 : 0.32);
    const amp = bh * 0.42 * (1 + a.kick * 0.12);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const v = (m[Math.max(0, i - 1)] + m[i] * 2 + m[Math.min(n - 1, i + 1)]) / 4;
      st.v[i] = follow(st.v[i], Math.pow(v, 1.3) * Math.pow(Math.sin(Math.PI * x), 1.3), 0.55, 0.1);
      st.pts[i][0] = w / 2 + (x * 2 - 1) * half;
      st.pts[i][1] = cy - st.v[i] * amp;
    }
    const sg = ctx.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.2, shade(f.color.accent, 0.45));
    sg.addColorStop(0.5, '#ffffff');
    sg.addColorStop(0.8, shade(f.color.accent, 0.45));
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // faint mirror below the line
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.translate(0, cy * 2);
    ctx.scale(1, -1);
    ctx.beginPath();
    smoothLine(ctx, st.pts);
    ctx.strokeStyle = sg;
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.stroke();
    ctx.restore();
    withGlow(ctx, rgba(f.color.accent, 1), s * 0.016, () => {
      ctx.beginPath();
      smoothLine(ctx, st.pts);
      ctx.strokeStyle = sg;
      ctx.lineWidth = Math.max(1.6, s * 0.0034);
      ctx.stroke();
    });
  },
};

export default [
  softWave, circleRing, classicBars, musicPlayer, vinylRecord, oceanWaves, liquidBlob, pulseLine,
  silkLines, mirrorBars, liquid, dotWave, aurora, horizon,
];
