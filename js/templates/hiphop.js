// Hip-hop & rap looks: bold, gritty, and the kick drum hits hard.
import {
  TAU, clamp, lerp, rgba, mix, shade, rng, noise1, resample, mirrored,
  drawCover, slowZoom, fadeEdge, vignette, roundRect, smoothLine, withGlow,
} from '../helpers.js';

const GOLD = '#f2c14e';
const GOLD_DARK = '#9c6b12';
const GOLD_LIGHT = '#fff0b8';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Scaling a big image is the slow part of a frame, and so are full-screen
// gradients. Anything that does not move is painted once into a layer and
// copied each frame at 1:1, which is cheap.
const ids = new WeakMap();
let nextId = 1;
const idOf = (o) => {
  if (!ids.has(o)) ids.set(o, nextId++);
  return ids.get(o);
};

function layer(st, name, w, h, key, paint) {
  let o = st[name];
  if (!o || o.w !== w || o.h !== h || o.key !== key) {
    const c = makeCanvas(w, h);
    paint(c.getContext('2d'));
    o = st[name] = { c, w, h, key };
  }
  return o.c;
}

// Film grain painted once per size, then copied at a random offset each frame.
let grainLayer = null;
function grit(ctx, f, amount = 0.1) {
  const pad = 64;
  if (!grainLayer || grainLayer.width !== f.w + pad || grainLayer.height !== f.h + pad) {
    grainLayer = makeCanvas(f.w + pad, f.h + pad);
    const g = grainLayer.getContext('2d');
    const W = grainLayer.width, H = grainLayer.height;
    const d = g.createImageData(W, H);
    const p = d.data;
    const r = rng(11);
    const b = Math.max(1, Math.round(f.s / 540));
    for (let y = 0; y < H; y += b) {
      for (let x = 0; x < W; x += b) {
        const v = r();
        const c = v > 0.5 ? 255 : 0;
        const al = Math.abs(v - 0.5) * 510;
        for (let yy = y; yy < Math.min(H, y + b); yy++) {
          for (let xx = x; xx < Math.min(W, x + b); xx++) {
            const i = (yy * W + xx) * 4;
            p[i] = p[i + 1] = p[i + 2] = c;
            p[i + 3] = al;
          }
        }
      }
    }
    g.putImageData(d, 0, 0);
  }
  ctx.globalAlpha = amount;
  ctx.drawImage(grainLayer, -Math.floor(Math.random() * pad), -Math.floor(Math.random() * pad));
  ctx.globalAlpha = 1;
}

// Red-only and green-blue-only copies of the photo, made once per photo.
// Added together with 'lighter' they give back the photo; pushed apart they
// split the colours.
function splitCopies(st, img) {
  if (st.splitSrc === img) return st.split;
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const make = (tint) => {
    const c = makeCanvas(img.width * k, img.height * k);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  st.split = { red: make('#ff0000'), cyan: make('#00ffff') };
  st.splitSrc = img;
  return st.split;
}

// Full-frame photo with its red half pushed by (-dx, -dy) and the rest by
// (dx, dy), plus a sideways shift ox. zoom must leave room past the edges.
// A tiny push draws the plain photo, which costs a third as much.
function splitPhoto(ctx, f, st, zoom, fx, fy, dx, dy, ox = 0) {
  if (Math.abs(dx) + Math.abs(dy) < f.s * 0.0015) {
    drawCover(ctx, f.photo.sharp, ox, 0, f.w, f.h, zoom, fx, fy);
    return;
  }
  const sp = splitCopies(st, f.photo.sharp);
  drawCover(ctx, sp.cyan, ox + dx, dy, f.w, f.h, zoom, fx, fy);
  ctx.globalCompositeOperation = 'lighter';
  drawCover(ctx, sp.red, ox - dx, -dy, f.w, f.h, zoom, fx, fy);
  ctx.globalCompositeOperation = 'source-over';
}

// Black & white photo tinted in two colours (shadows dark, highlights light).
function duotone(st, img, accent) {
  const key = accent;
  if (st.duoSrc === img && st.duoKey === key) return st.duo;
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  // Multiply the photo by itself once for deeper shadows.
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.7;
  g.drawImage(img, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = shade(accent, 0.4);
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'screen';
  g.fillStyle = shade(mix(accent, '#1a1030', 0.6), -0.7);
  g.fillRect(0, 0, c.width, c.height);
  st.duo = c;
  st.duoSrc = img;
  st.duoKey = key;
  return c;
}

// Thin dark lines like an old monitor, from a cached tile.
let scanTile = null;
function scanlines(ctx, f, alpha = 0.18) {
  if (!scanTile) {
    scanTile = makeCanvas(2, 4);
    const g = scanTile.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 2, 2, 2);
  }
  const scale = Math.max(1, f.s / 540);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.scale(scale, scale);
  ctx.fillStyle = ctx.createPattern(scanTile, 'repeat');
  ctx.fillRect(0, 0, f.w / scale + 4, f.h / scale + 4);
  ctx.restore();
}

// Spectrum without the empty top end, n values.
const spectrum = (f, n, out) => resample(f.a.bands.subarray(0, 46), n, out);

// ---------- 1. Street ----------
const street = {
  id: 'street',
  name: 'Street',
  ne: 'स्ट्रिट',
  cat: 'hiphop',
  text: (f) => ({
    title: { y: f.portrait ? 0.12 : 0.13, size: f.portrait ? 0.12 : 0.09, font: 'teko', upper: true, style: 'outline' },
    sub: { y: f.portrait ? 0.176 : 0.225, size: f.portrait ? 0.052 : 0.038, font: 'bebas', upper: true, style: 'tag', color: 'accent' },
  }),
  setup: () => ({ raw: new Float32Array(28), bars: new Float32Array(28), peaks: new Float32Array(28), hold: new Float32Array(28) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Tinted black & white photo that jolts on every kick.
    const img = duotone(st, f.photo.gray, f.color.accent);
    const z = slowZoom(f, 0.06);
    const k = a.kick * s * 0.028;
    ctx.save();
    ctx.translate(noise1(f.t * 31, 1) * k, noise1(f.t * 31, 2) * k);
    drawCover(ctx, img, 0, 0, w, h, z.zoom * (1.05 + a.kick * 0.035), z.fx, z.fy);
    ctx.restore();
    ctx.drawImage(layer(st, 'over', w, h, 'street', (g) => {
      fadeEdge(g, f, 'bottom', 0.5, 0.85);
      fadeEdge(g, f, 'top', 0.32, 0.55);
      scanlines(g, f, 0.12);
      vignette(g, f, 0.55);
    }), 0, 0);

    // Chunky LED level meter along the bottom.
    const n = f.portrait ? 16 : f.square ? 20 : 28;
    const raw = spectrum(f, n, st.raw.subarray(0, n));
    const segs = 14;
    const left = w * 0.05, area = w * 0.9;
    const slot = area / n, bw = slot * 0.74;
    const H = s * (f.portrait ? 0.34 : 0.3);
    const base = h - s * 0.06;
    const sh = H / segs, segH = sh * 0.68;
    for (let i = 0; i < n; i++) {
      const v = clamp(raw[i] * 1.15 + (i < n * 0.2 ? a.kick * 0.25 : 0));
      st.bars[i] = v > st.bars[i] ? v : Math.max(v, st.bars[i] - f.dt * 1.8);
      if (st.bars[i] >= st.peaks[i]) { st.peaks[i] = st.bars[i]; st.hold[i] = 0.35; }
      else if ((st.hold[i] -= f.dt) < 0) st.peaks[i] = Math.max(0, st.peaks[i] - f.dt * 0.7);
      const lit = Math.round(st.bars[i] * segs);
      const x = left + i * slot + (slot - bw) / 2;
      for (let j = 0; j < segs; j++) {
        const y = base - (j + 1) * sh;
        if (j < lit) ctx.fillStyle = j >= lit - 3 ? f.color.accent : 'rgba(255,255,255,0.93)';
        else ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x, y, bw, segH);
      }
      const pj = Math.min(segs - 1, Math.round(st.peaks[i] * segs));
      if (pj >= lit) {
        ctx.fillStyle = shade(f.color.accent, 0.35);
        ctx.fillRect(x, base - (pj + 1) * sh, bw, segH);
      }
    }
    // Floor line.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(left, base + s * 0.012, area, Math.max(2, s * 0.005));
    grit(ctx, f, 0.14);
  },
};

// ---------- 2. Bass Punch ----------
const bassPunch = {
  id: 'bass-punch',
  name: 'Bass Punch',
  ne: 'बेस पन्च',
  cat: 'hiphop',
  text: (f) => ({
    title: { y: f.portrait ? 0.13 : 0.12, size: f.portrait ? 0.11 : 0.085, font: 'khand', upper: true, style: 'outline' },
    sub: { y: f.portrait ? 0.185 : 0.205, size: f.portrait ? 0.05 : 0.036, font: 'bebas', upper: true, style: 'tag', color: GOLD },
  }),
  setup: () => ({ raw: new Float32Array(40), bars: new Float32Array(40), side: 1, beats: -1 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    if (a.beats !== st.beats) { st.beats = a.beats; st.side = a.beats % 2 ? 1 : -1; }

    // Hard zoom on the kick, colours tear apart on the beat.
    const z = slowZoom(f, 0.06);
    const zoom = z.zoom * (1.05 + a.kick * 0.13);
    const d = s * 0.022 * a.beat * a.beat;
    splitPhoto(ctx, f, st, zoom, z.fx, z.fy, d * st.side, d * 0.25);

    // Ghost copy that blooms out of the photo on the kick.
    if (a.kick > 0.25) {
      ctx.globalAlpha = 0.3 * a.kick;
      drawCover(ctx, f.photo.sharp, 0, 0, w, h, zoom * (1.05 + a.kick * 0.08), z.fx, z.fy);
      ctx.globalAlpha = 1;
    }
    const floorY = h - s * (f.portrait ? 0.16 : 0.13);
    ctx.drawImage(layer(st, 'over', w, h, 'punch', (g) => {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, 0, w, h);
      fadeEdge(g, f, 'top', 0.3, 0.55);
      vignette(g, f, 0.6);
      // Black floor the bars rise out of.
      const fg = g.createLinearGradient(0, floorY - s * 0.3, 0, floorY);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = fg;
      g.fillRect(0, floorY - s * 0.3, w, s * 0.3);
      g.fillStyle = '#050505';
      g.fillRect(0, floorY, w, h - floorY);
    }), 0, 0);

    // Heavy gold bars, bass in the middle.
    const n = f.portrait ? 18 : f.square ? 24 : 36;
    const raw = mirrored(a.bands.subarray(0, 46), n);
    const slot = w / n, bw = slot * 0.7;
    const maxH = s * (f.portrait ? 0.36 : 0.34);
    const gold = ctx.createLinearGradient(0, floorY - maxH, 0, floorY);
    gold.addColorStop(0, GOLD_LIGHT);
    gold.addColorStop(0.35, GOLD);
    gold.addColorStop(1, GOLD_DARK);
    for (let i = 0; i < n; i++) {
      const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const v = clamp(raw[i] * (0.75 + 0.3 * mid) + a.kick * 0.32 * mid * mid);
      st.bars[i] = v > st.bars[i] ? v : Math.max(v, st.bars[i] - f.dt * 2.2);
      const bh = Math.max(s * 0.008, st.bars[i] * maxH);
      const x = i * slot + (slot - bw) / 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - s * 0.004, floorY - bh - s * 0.004, bw + s * 0.008, bh + s * 0.004);
      ctx.fillStyle = gold;
      ctx.fillRect(x, floorY - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, floorY - bh, bw, Math.max(1, s * 0.004));
      // Dim reflection in the black floor.
      ctx.fillStyle = rgba(GOLD, 0.16);
      ctx.fillRect(x, floorY + s * 0.008, bw, bh * 0.35);
    }
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, floorY, w, Math.max(2, s * 0.005));
    grit(ctx, f, 0.07);
  },
};

// ---------- 3. Mixtape ----------
function mixtapeLayout(f) {
  const { w, h, s } = f;
  if (f.portrait) {
    const cw = w * 0.86;
    return {
      cx: w / 2, cy: h * 0.45, cw,
      vu: [[w * 0.27, h * 0.76], [w * 0.73, h * 0.76]], vw: w * 0.42,
    };
  }
  if (f.square) {
    const cw = s * 0.64;
    return {
      cx: w / 2, cy: h * 0.47, cw,
      vu: [[w * 0.33, h * 0.84], [w * 0.67, h * 0.84]], vw: s * 0.3,
    };
  }
  const cw = w * 0.48;
  return {
    cx: w * 0.36, cy: h * 0.58, cw,
    vu: [[w * 0.795, h * 0.41], [w * 0.795, h * 0.76]], vw: w * 0.25,
  };
}

function drawReel(ctx, x, y, hub, pack, rot) {
  // Wound tape, then the white hub with its teeth.
  ctx.fillStyle = '#2b1d16';
  ctx.beginPath();
  ctx.arc(x, y, pack, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,180,0.07)';
  ctx.lineWidth = Math.max(1, hub * 0.05);
  for (let r = hub * 1.4; r < pack; r += hub * 0.32) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = '#efece4';
  ctx.beginPath();
  ctx.arc(x, y, hub, 0, TAU);
  ctx.fill();
  // Spokes so the spin is easy to see.
  ctx.fillStyle = '#b9b4a8';
  for (let i = 0; i < 3; i++) {
    const an = rot + (i / 3) * TAU;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(an);
    ctx.fillRect(-hub * 0.12, -hub * 0.95, hub * 0.24, hub * 0.6);
    ctx.restore();
  }
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x, y, hub * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#efece4';
  for (let i = 0; i < 6; i++) {
    const an = rot + (i / 6) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(an) * hub * 0.42, y + Math.sin(an) * hub * 0.42, hub * 0.1, 0, TAU);
    ctx.fill();
  }
}

function drawCassette(ctx, f, st, L) {
  const { a } = f;
  const W = L.cw, H = W * 0.63;
  const x = -W / 2, y = -H / 2;
  // Shell.
  const body = ctx.createLinearGradient(0, y, 0, y + H);
  body.addColorStop(0, '#2a2a2e');
  body.addColorStop(1, '#141416');
  ctx.fillStyle = body;
  roundRect(ctx, x, y, W, H, W * 0.035);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, W * 0.004);
  ctx.stroke();
  // Screws.
  ctx.fillStyle = '#5a5a60';
  for (const [sx, sy] of [[0.035, 0.05], [0.965, 0.05], [0.035, 0.95], [0.965, 0.95], [0.5, 0.92]]) {
    ctx.beginPath();
    ctx.arc(x + W * sx, y + H * sy, W * 0.011, 0, TAU);
    ctx.fill();
  }

  // Label with the photo on it and two colour stripes.
  const lx = x + W * 0.065, ly = y + H * 0.08, lw = W * 0.87, lh = H * 0.62;
  ctx.save();
  roundRect(ctx, lx, ly, lw, lh, W * 0.015);
  ctx.clip();
  ctx.fillStyle = '#f1e7d0';
  ctx.fillRect(lx, ly, lw, lh);
  drawCover(ctx, f.photo.sharp, lx, ly, lw, lh, 1.02);
  ctx.fillStyle = 'rgba(255,214,150,0.12)';
  ctx.fillRect(lx, ly, lw, lh);
  ctx.fillStyle = f.color.accent;
  ctx.fillRect(lx, ly + lh * 0.83, lw, lh * 0.07);
  ctx.fillStyle = f.color.accent2;
  ctx.fillRect(lx, ly + lh * 0.9, lw, lh * 0.1);
  ctx.restore();
  // Side A badge.
  ctx.fillStyle = '#f1e7d0';
  roundRect(ctx, lx + lw * 0.025, ly + lh * 0.05, lw * 0.09, lw * 0.09, lw * 0.012);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = `700 ${Math.round(lw * 0.07)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', lx + lw * 0.07, ly + lh * 0.05 + lw * 0.048);

  // Window with the reels.
  const wx = x + W * 0.24, wy = y + H * 0.3, ww = W * 0.52, wh = H * 0.26;
  ctx.save();
  roundRect(ctx, wx, wy, ww, wh, wh * 0.5);
  ctx.fillStyle = '#0c0b0b';
  ctx.fill();
  ctx.clip();
  const hub = W * 0.052;
  const p = clamp(f.progress);
  const packL = lerp(W * 0.17, W * 0.075, p), packR = lerp(W * 0.075, W * 0.17, p);
  const rx = W * 0.2;
  // Tape speed is constant, so the smaller reel turns faster.
  const v = W * 0.9;
  st.rotL += f.dt * v / packL;
  st.rotR += f.dt * v / packR;
  drawReel(ctx, -rx, y + H * 0.43, hub, packL, st.rotL);
  drawReel(ctx, rx, y + H * 0.43, hub, packR, st.rotR);
  // Glass shine.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(wx, wy, ww, wh * 0.35);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = Math.max(1.5, W * 0.006);
  roundRect(ctx, wx, wy, ww, wh, wh * 0.5);
  ctx.stroke();

  // Lower head area with its holes.
  const ty = y + H * 0.76;
  ctx.fillStyle = '#232327';
  ctx.beginPath();
  ctx.moveTo(x + W * 0.17, ty);
  ctx.lineTo(x + W * 0.83, ty);
  ctx.lineTo(x + W * 0.88, y + H);
  ctx.lineTo(x + W * 0.12, y + H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#060606';
  for (const hx of [0.3, 0.7]) {
    ctx.beginPath();
    ctx.arc(x + W * hx, y + H * 0.87, W * 0.022, 0, TAU);
    ctx.fill();
  }
  for (const hx of [0.43, 0.54]) ctx.fillRect(x + W * hx, y + H * 0.84, W * 0.03, H * 0.07);
}

function drawVU(ctx, f, cx, cy, vw, value, label) {
  const vh = vw * 0.62;
  const x = cx - vw / 2, y = cy - vh / 2;
  // Bezel and warm backlit face.
  ctx.fillStyle = '#18181a';
  roundRect(ctx, x - vw * 0.04, y - vw * 0.04, vw * 1.08, vh + vw * 0.08, vw * 0.05);
  ctx.fill();
  const face = ctx.createRadialGradient(cx, y + vh * 0.9, vw * 0.05, cx, y + vh * 0.7, vw * 0.75);
  face.addColorStop(0, '#fff3cf');
  face.addColorStop(1, '#e2c88e');
  ctx.fillStyle = face;
  roundRect(ctx, x, y, vw, vh, vw * 0.025);
  ctx.fill();

  const px = cx, py = y + vh * 1.05, r = vh * 0.82;
  const a0 = -Math.PI / 2 - 0.8, a1 = -Math.PI / 2 + 0.8;
  const redAt = 0.72;
  ctx.lineWidth = Math.max(1, vw * 0.012);
  ctx.strokeStyle = '#2a2420';
  ctx.beginPath();
  ctx.arc(px, py, r, a0, lerp(a0, a1, redAt));
  ctx.stroke();
  ctx.strokeStyle = '#c8321e';
  ctx.lineWidth = Math.max(2, vw * 0.03);
  ctx.beginPath();
  ctx.arc(px, py, r, lerp(a0, a1, redAt), a1);
  ctx.stroke();
  // Tick marks.
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, an = lerp(a0, a1, t);
    const len = vh * (i % 2 ? 0.05 : 0.09);
    ctx.strokeStyle = t > redAt ? '#c8321e' : '#2a2420';
    ctx.lineWidth = Math.max(1, vw * 0.008);
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(an) * r, py + Math.sin(an) * r);
    ctx.lineTo(px + Math.cos(an) * (r + len), py + Math.sin(an) * (r + len));
    ctx.stroke();
  }
  ctx.fillStyle = '#2a2420';
  ctx.font = `400 ${Math.round(vh * 0.2)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VU', cx, y + vh * 0.62);
  ctx.font = `400 ${Math.round(vh * 0.13)}px "Bebas Neue", sans-serif`;
  ctx.fillText(label, x + vw * 0.09, y + vh * 0.82);
  ctx.fillStyle = '#c8321e';
  ctx.fillText('+3', x + vw * 0.88, y + vh * 0.2);
  ctx.fillStyle = '#2a2420';
  ctx.fillText('-20', x + vw * 0.12, y + vh * 0.2);

  // Needle.
  ctx.save();
  roundRect(ctx, x, y, vw, vh, vw * 0.025);
  ctx.clip();
  const an = lerp(a0 - 0.05, a1 + 0.05, clamp(value, 0, 1.06));
  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(1.5, vw * 0.009);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(an) * r * 1.08, py + Math.sin(an) * r * 1.08);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(px, py, vw * 0.07, 0, TAU);
  ctx.fill();
  // Glass glare.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + vw * 0.55, y);
  ctx.lineTo(x + vw * 0.3, y + vh);
  ctx.lineTo(x, y + vh);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const mixtape = {
  id: 'mixtape',
  name: 'Mixtape',
  ne: 'मिक्सटेप',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.13, size: 0.11, font: 'khand', upper: true, style: 'shadow' }, sub: { y: 0.185, size: 0.055, font: 'marker', color: '#f3e6c4', style: 'outline' } }
    : f.square
      ? { title: { y: 0.075, size: 0.07, font: 'khand', upper: true, style: 'shadow' }, sub: { y: 0.14, size: 0.036, font: 'marker', color: '#f3e6c4', style: 'outline' } }
      : { title: { y: 0.11, size: 0.075, font: 'khand', upper: true, style: 'shadow' }, sub: { y: 0.185, size: 0.036, font: 'marker', color: '#f3e6c4', style: 'outline' } }),
  setup: () => ({ rotL: 0, rotR: 0, vuL: 0, vuR: 0 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // Warm, dim room behind the tape, with seventies stripes across it.
    const key = `${idOf(f.photo.blur)}${f.color.accent}${f.color.accent2}`;
    ctx.drawImage(layer(st, 'bg', w, h, key, (g) => {
      drawCover(g, f.photo.blur, 0, 0, w, h, 1.1);
      g.fillStyle = 'rgba(28,16,8,0.68)';
      g.fillRect(0, 0, w, h);
      g.save();
      g.translate(w / 2, h * 0.55);
      g.rotate(-0.32);
      const sw = s * 0.05;
      const cols = [shade(f.color.accent2, 0.1), f.color.accent, shade(f.color.accent, -0.35)];
      g.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        g.fillStyle = cols[i];
        g.fillRect(-w * 1.2, (i - 1.5) * sw * 1.1, w * 2.4, sw);
      }
      g.restore();
      vignette(g, f, 0.6);
    }), 0, 0);

    const L = mixtapeLayout(f);
    // The tape bumps on the kick.
    ctx.save();
    ctx.translate(L.cx, L.cy - a.kick * s * 0.012);
    const sc = 1 + a.kick * 0.03;
    ctx.scale(sc, sc);
    withGlow(ctx, 'rgba(0,0,0,0.7)', s * 0.04, () => {
      ctx.fillStyle = '#000';
      roundRect(ctx, -L.cw / 2, -L.cw * 0.315, L.cw, L.cw * 0.63, L.cw * 0.035);
      ctx.fill();
    });
    drawCassette(ctx, f, st, L);
    ctx.restore();

    // VU needles: quick to rise, slower to fall, like real meters.
    const tl = clamp(a.level * 1.05 + a.kick * 0.18 + band(f, 0, 0.15) * 0.15);
    const tr = clamp(a.level * 0.95 + a.mid * 0.3 + a.kick * 0.12);
    st.vuL += (tl - st.vuL) * (1 - Math.exp(-f.dt * (tl > st.vuL ? 18 : 6)));
    st.vuR += (tr - st.vuR) * (1 - Math.exp(-f.dt * (tr > st.vuR ? 18 : 6)));
    drawVU(ctx, f, L.vu[0][0], L.vu[0][1], L.vw, st.vuL, 'L');
    drawVU(ctx, f, L.vu[1][0], L.vu[1][1], L.vw, st.vuR, 'R');
    grit(ctx, f, 0.1);
  },
};

function band(f, lo, hi) {
  const b = f.a.bands, n = b.length;
  const i0 = Math.floor(lo * n), i1 = Math.max(i0 + 1, Math.floor(hi * n));
  let sum = 0;
  for (let i = i0; i < i1; i++) sum += b[i];
  return sum / (i1 - i0);
}

// ---------- 4. Glitch ----------
const glitch = {
  id: 'glitch',
  name: 'Glitch',
  ne: 'ग्लिच',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.8, size: 0.12, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.855, size: 0.052, font: 'bebas', upper: true, style: 'tag', color: '#ffffff' } }
    : { title: { y: 0.8, size: 0.085, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.885, size: 0.036, font: 'bebas', upper: true, style: 'tag', color: '#ffffff' } }),
  setup: () => ({ beats: -1, cuts: [], blocks: [], wave: new Float32Array(90) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const z = slowZoom(f, 0.06);
    const zoom = z.zoom * 1.06;

    // A new set of torn slices for every beat, from a seeded random.
    if (a.beats !== st.beats) {
      st.beats = a.beats;
      const r = rng(a.beats * 977 + 13);
      st.cuts.length = 0;
      const nc = 3 + Math.floor(r() * 4);
      for (let i = 0; i < nc; i++) {
        st.cuts.push({ y: r() * 0.9, hh: 0.015 + r() * r() * 0.12, dx: (r() < 0.5 ? -1 : 1) * (0.03 + r() * 0.09), split: 0.5 + r() });
      }
      st.blocks.length = 0;
      const nb = 4 + Math.floor(r() * 6);
      for (let i = 0; i < nb; i++) {
        st.blocks.push({ x: r(), y: r() * 0.95, bw: 0.01 + r() * 0.06, bh: 0.004 + r() * 0.02, c: Math.floor(r() * 4) });
      }
    }
    const g = clamp(a.beat * 1.2) * clamp(a.beat * 1.2);
    const base = s * 0.004 * clamp(a.beat * 2);
    splitPhoto(ctx, f, st, zoom, z.fx, z.fy, base + s * 0.014 * g, 0);

    // Slices of the picture slide sideways, wrapping round the edge.
    if (g > 0.06) {
      for (const c of st.cuts) {
        const y0 = Math.round(c.y * h), hh = Math.max(1, Math.round(c.hh * h));
        const off = Math.round(c.dx * w * g);
        const d = base + s * 0.022 * c.split * g;
        // The slice, and the part of it that wrapped round the other side.
        for (const x0 of [off, off - Math.sign(off) * w]) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y0, w, hh);
          ctx.clip();
          splitPhoto(ctx, f, st, zoom, z.fx, z.fy, d, 0, x0);
          ctx.restore();
        }
        // A bright seam on the edge of the cut.
        ctx.fillStyle = `rgba(255,255,255,${0.35 * g})`;
        ctx.fillRect(0, y0, w, Math.max(1, s * 0.002));
      }
      const cols = ['#ffffff', '#00f0ff', '#ff2a55', '#000000'];
      for (const b of st.blocks) {
        ctx.fillStyle = cols[b.c];
        ctx.globalAlpha = 0.85 * g;
        ctx.fillRect(b.x * w, b.y * h, b.bw * w, b.bh * h);
      }
      ctx.globalAlpha = 1;
    }

    ctx.drawImage(layer(st, 'over', w, h, 'glitch', (o) => {
      fadeEdge(o, f, 'bottom', 0.45, 0.8);
      fadeEdge(o, f, 'top', 0.2, 0.35);
      scanlines(o, f, 0.14);
      vignette(o, f, 0.45);
    }), 0, 0);

    // A slow bright band rolling down, like a worn tape.
    const by = ((f.t * 0.11) % 1.2 - 0.1) * h;
    const bg = ctx.createLinearGradient(0, by - s * 0.04, 0, by + s * 0.04);
    bg.addColorStop(0, 'rgba(255,255,255,0)');
    bg.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, by - s * 0.04, w, s * 0.08);

    // Waveform in three colours, pushed apart on the beat.
    const n = st.wave.length;
    const cy = h * (f.portrait ? 0.69 : 0.66);
    const amp = s * 0.09 * (1 + a.kick * 0.5);
    for (let i = 0; i < n; i++) {
      const j = Math.floor((i / (n - 1)) * (a.wave.length - 1));
      st.wave[i] = lerp(st.wave[i], a.wave[j], 0.6);
    }
    const line = (dx, col, lw) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = w * 0.06 + (i / (n - 1)) * w * 0.88;
        const taper = Math.sin(Math.PI * i / (n - 1));
        pts.push([x + dx, cy + st.wave[i] * amp * taper]);
      }
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    const lw = Math.max(1.5, s * 0.005);
    const sd = s * (0.003 + 0.01 * g);
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    line(-sd, 'rgba(255,40,80,0.9)', lw);
    line(sd, 'rgba(0,230,255,0.9)', lw);
    ctx.globalCompositeOperation = 'source-over';
    line(0, '#ffffff', lw * 0.7);

    grit(ctx, f, 0.1);
  },
};

// ---------- 5. Graffiti Wall ----------
function graffitiLayout(f) {
  const { w, h, s } = f;
  if (f.portrait) return { px: w * 0.5, py: h * 0.4, ph: h * 0.42, tx: 0.5 };
  if (f.square) return { px: w * 0.5, py: h * 0.38, ph: h * 0.52, tx: 0.5 };
  return { px: w * 0.32, py: h * 0.47, ph: h * 0.7, tx: 0.7 };
}

// Brick wall painted once per size into its own canvas.
function buildWall(w, h, s) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = rng(42);
  g.fillStyle = '#3a3634';
  g.fillRect(0, 0, w, h);
  const bh = s * 0.058, bw = bh * 2.15, gap = Math.max(1, s * 0.006);
  for (let row = 0, y = 0; y < h; row++, y += bh) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let x = off; x < w; x += bw) {
      const l = 26 + r() * 12, hue = 8 + r() * 14, sat = 22 + r() * 18;
      g.fillStyle = `hsl(${hue},${sat}%,${l}%)`;
      g.fillRect(x + gap / 2, y + gap / 2, bw - gap, bh - gap);
      // Darker lower edge and a lighter top edge for a bit of depth.
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x + gap / 2, y + bh - gap / 2 - bh * 0.12, bw - gap, bh * 0.12);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(x + gap / 2, y + gap / 2, bw - gap, bh * 0.08);
    }
  }
  // Speckles and chips.
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)';
    const d = s * (0.002 + r() * 0.004);
    g.fillRect(r() * w, r() * h, d, d);
  }
  // Old faded tags scribbled on the wall.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = `rgba(235,235,235,${0.06 + r() * 0.06})`;
    g.lineWidth = s * (0.006 + r() * 0.008);
    let x = r() * w, y = r() * h;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 9; i++) {
      x += (r() - 0.3) * s * 0.07;
      y += (r() - 0.5) * s * 0.09;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Grime: darker at the top and the bottom.
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0.05)');
  gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  vignette(g, { w, h, s }, 0.55);
  return c;
}

// Torn paper outline: points around a unit rectangle, pushed in at random.
function tornEdge(seed) {
  const r = rng(seed);
  const pts = [];
  const side = (n, fn) => { for (let i = 0; i < n; i++) pts.push(fn(i / n, r() * 0.022 + (r() < 0.12 ? r() * 0.03 : 0))); };
  side(18, (t, j) => [t, j]);
  side(14, (t, j) => [1 - j, t]);
  side(18, (t, j) => [1 - t, 1 - j]);
  side(14, (t, j) => [j, 1 - t]);
  return pts;
}

const graffiti = {
  id: 'graffiti',
  name: 'Graffiti Wall',
  ne: 'भित्ते चित्र',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.71, size: 0.12, font: 'khand', upper: true, style: 'outline' }, sub: { y: 0.77, size: 0.058, font: 'marker', color: 'accent2', style: 'outline' } }
    : f.square
      ? { title: { y: 0.735, size: 0.08, font: 'khand', upper: true, style: 'outline' }, sub: { y: 0.8, size: 0.042, font: 'marker', color: 'accent2', style: 'outline' } }
      : { title: { x: 0.71, y: 0.4, size: 0.09, font: 'khand', upper: true, style: 'outline' }, sub: { x: 0.71, y: 0.5, size: 0.045, font: 'marker', color: 'accent2', style: 'outline' } }),
  setup: (f) => {
    const N = 320;
    return {
      wall: null, edge: tornEdge(5), outer: tornEdge(9),
      px: new Float32Array(N), py: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N),
      pr: new Float32Array(N), life: new Float32Array(N), pc: new Uint8Array(N), next: 0,
      drips: [], splats: [], beats: -1, bars: new Float32Array(20), raw: new Float32Array(20),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const m = Math.ceil(s * 0.01);
    if (!st.wall) st.wall = buildWall(w + m * 2, h + m * 2, s);
    const L = graffitiLayout(f);
    const k = a.kick * s * 0.006;
    ctx.drawImage(st.wall, Math.round(-m + noise1(f.t * 25, 3) * k), Math.round(-m + noise1(f.t * 25, 4) * k));

    const cols = [f.color.accent, f.color.accent2, '#ffffff'];

    // Spray burst on every beat: a cloud, flying dots and a few drips.
    if (a.beats !== st.beats) {
      const first = st.beats < 0;
      st.beats = a.beats;
      if (!first || a.beat > 0.5) {
        const r = rng(a.beats * 31 + 7);
        const pw = L.ph * 0.8;
        const ang = r() * TAU;
        const bx = clamp(L.px + Math.cos(ang) * pw * (0.55 + r() * 0.25), s * 0.05, w - s * 0.05);
        const by = clamp(L.py + Math.sin(ang) * L.ph * (0.5 + r() * 0.2), s * 0.05, h * 0.8);
        const c = Math.floor(r() * 2);
        st.splats.push({ x: bx, y: by, r: s * (0.07 + r() * 0.05), c, life: 1 });
        if (st.splats.length > 5) st.splats.shift();
        for (let i = 0; i < 45; i++) {
          const j = st.next;
          st.next = (st.next + 1) % st.px.length;
          const an = r() * TAU, sp = s * (0.1 + r() * r() * 0.9);
          st.px[j] = bx; st.py[j] = by;
          st.vx[j] = Math.cos(an) * sp; st.vy[j] = Math.sin(an) * sp;
          st.pr[j] = s * (0.002 + r() * r() * 0.009);
          st.life[j] = 1;
          st.pc[j] = r() < 0.75 ? c : 2;
        }
        for (let i = 0; i < 3; i++) {
          st.drips.push({ x: bx + (r() - 0.5) * s * 0.1, y: by + r() * s * 0.03, len: 0, max: s * (0.06 + r() * 0.14), wd: s * (0.004 + r() * 0.005), c, life: 1 });
        }
        while (st.drips.length > 18) st.drips.shift();
      }
    }

    // Soft spray clouds.
    for (const sp of st.splats) {
      sp.life -= f.dt * 0.35;
      if (sp.life <= 0) continue;
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r);
      g.addColorStop(0, rgba(cols[sp.c], 0.7 * sp.life));
      g.addColorStop(0.55, rgba(cols[sp.c], 0.3 * sp.life));
      g.addColorStop(1, rgba(cols[sp.c], 0));
      ctx.fillStyle = g;
      ctx.fillRect(sp.x - sp.r, sp.y - sp.r, sp.r * 2, sp.r * 2);
    }
    // Drips run down and slowly fade.
    ctx.lineCap = 'round';
    for (const d of st.drips) {
      d.len = Math.min(d.max, d.len + f.dt * s * 0.12 * (1 - d.len / d.max + 0.15));
      d.life -= f.dt * 0.28;
      if (d.life <= 0) continue;
      ctx.strokeStyle = rgba(cols[d.c], 0.85 * d.life);
      ctx.lineWidth = d.wd;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.len);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(d.x, d.y + d.len, d.wd * 0.9, 0, TAU);
      ctx.fill();
    }
    // Dots fly out, stop on the wall, then fade.
    const damp = Math.exp(-f.dt * 7);
    for (let i = 0; i < st.px.length; i++) {
      if (st.life[i] <= 0) continue;
      st.px[i] += st.vx[i] * f.dt;
      st.py[i] += st.vy[i] * f.dt;
      st.vx[i] *= damp; st.vy[i] *= damp;
      st.life[i] -= f.dt * 0.3;
      ctx.fillStyle = rgba(cols[st.pc[i]], clamp(st.life[i] * 1.2));
      ctx.beginPath();
      ctx.arc(st.px[i], st.py[i], st.pr[i], 0, TAU);
      ctx.fill();
    }

    // The photo, pasted up as a torn poster that thumps with the kick.
    const ar = clamp(f.photo.sharp.width / f.photo.sharp.height, 0.72, 1.35);
    let ph = L.ph, pw = ph * ar;
    const maxW = f.portrait || f.square ? w * 0.84 : w * 0.5;
    if (pw > maxW) { pw = maxW; ph = pw / ar; }
    ctx.save();
    ctx.translate(L.px, L.py);
    ctx.rotate(-0.035 + a.kick * 0.012);
    const sc = 1 + a.kick * 0.045;
    ctx.scale(sc, sc);
    const path = (pts, inset) => {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = -pw / 2 + inset * pw + p[0] * pw * (1 - inset * 2);
        const y = -ph / 2 + inset * pw + p[1] * (ph - inset * pw * 2);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
    };
    withGlow(ctx, 'rgba(0,0,0,0.6)', s * 0.03, () => {
      ctx.shadowOffsetY = s * 0.01;
      path(st.outer, 0);
      ctx.fillStyle = '#ece6d6';
      ctx.fill();
    });
    ctx.save();
    path(st.edge, 0.035);
    ctx.clip();
    drawCover(ctx, f.photo.sharp, -pw / 2, -ph / 2, pw, ph, 1.02 + a.beat * 0.02);
    // Paper creases and a little wear.
    ctx.fillStyle = 'rgba(255,240,210,0.08)';
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-pw * 0.02, -ph / 2, pw * 0.006, ph);
    ctx.fillRect(-pw / 2, -ph * 0.02, pw, pw * 0.006);
    ctx.restore();
    // Tape on the top corners.
    ctx.fillStyle = 'rgba(232,222,190,0.8)';
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * pw * 0.44, -ph * 0.48);
      ctx.rotate(sx * 0.6);
      ctx.fillRect(-pw * 0.09, -pw * 0.025, pw * 0.18, pw * 0.05);
      ctx.restore();
    }
    ctx.restore();

    // Spray-paint level bars along the bottom.
    const n = f.portrait ? 12 : 20;
    const raw = spectrum(f, n, st.raw.subarray(0, n));
    const base = h - s * 0.05;
    const slot = w * 0.9 / n;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const v = clamp(raw[i] + (i < 3 ? a.kick * 0.25 : 0));
      st.bars[i] = v > st.bars[i] ? v : Math.max(v, st.bars[i] - f.dt * 1.5);
      const x = w * 0.05 + slot * (i + 0.5);
      const top = base - st.bars[i] * s * (f.portrait ? 0.1 : f.square ? 0.09 : 0.13);
      const c = i % 2 ? f.color.accent : f.color.accent2;
      ctx.strokeStyle = rgba(c, 0.25);
      ctx.lineWidth = slot * 0.75;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top); ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = slot * 0.45;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top); ctx.stroke();
    }
    grit(ctx, f, 0.08);
  },
};

// ---------- 6. Speakers ----------
function speakerLayout(f) {
  const { w, h, s } = f;
  if (f.portrait) {
    const cw = w * 0.92, ch = h * 0.24;
    return {
      horiz: true, cw, ch, r: ch * 0.42,
      boxes: [[w / 2, h * 0.145], [w / 2, h * 0.855]],
      photo: [w / 2, h * 0.425, w * 0.5],
    };
  }
  if (f.square) {
    const cw = s * 0.25, ch = s * 0.66;
    return {
      horiz: false, cw, ch, r: cw * 0.38,
      boxes: [[w * 0.145, h * 0.44], [w * 0.855, h * 0.44]],
      photo: [w / 2, h * 0.4, s * 0.4],
    };
  }
  const cw = w * 0.25, ch = h * 0.84;
  return {
    horiz: false, cw, ch, r: cw * 0.41,
    boxes: [[w * 0.14, h * 0.5], [w * 0.86, h * 0.5]],
    photo: [w / 2, h * 0.41, h * 0.5],
  };
}

function drawCone(ctx, f, x, y, r, push) {
  // Metal basket with screws.
  ctx.fillStyle = '#26262a';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6a6a70';
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * TAU + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(x + Math.cos(an) * r * 1.04, y + Math.sin(an) * r * 1.04, r * 0.025, 0, TAU);
    ctx.fill();
  }
  // Coloured ring that lights up with the bass.
  ctx.strokeStyle = rgba(f.color.accent, 0.35 + push * 0.65);
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.985, 0, TAU);
  ctx.stroke();
  // Rubber surround: a rolled edge that catches light when the cone pushes out.
  const sr = r * 0.95;
  const sg = ctx.createRadialGradient(x, y, sr * 0.8, x, y, sr);
  sg.addColorStop(0, '#0b0b0c');
  sg.addColorStop(0.45, mix('#2c2c30', '#77777f', push));
  sg.addColorStop(1, '#0b0b0c');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(x, y, sr, 0, TAU);
  ctx.fill();
  // Cone: grows and brightens as it moves towards you.
  const cr = sr * 0.8 * (1 + push * 0.1);
  const off = push * r * 0.05;
  const cg = ctx.createRadialGradient(x - off, y - off, cr * 0.1, x, y, cr);
  cg.addColorStop(0, mix('#3a3a40', '#8a8a94', push));
  cg.addColorStop(0.6, mix('#1a1a1e', '#34343a', push));
  cg.addColorStop(1, '#070708');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(x, y, cr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = Math.max(1, r * 0.01);
  for (const k of [0.45, 0.65, 0.85]) {
    ctx.beginPath();
    ctx.arc(x, y, cr * k, 0, TAU);
    ctx.stroke();
  }
  // Light catching the top edge of the cone as it pushes out.
  if (push > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * push})`;
    ctx.lineWidth = r * 0.025;
    ctx.beginPath();
    ctx.arc(x, y, cr * 0.97, Math.PI * 1.05, Math.PI * 1.7);
    ctx.stroke();
  }
  // Dust cap.
  const dr = cr * 0.34 * (1 + push * 0.3);
  const dg = ctx.createRadialGradient(x - dr * 0.35, y - dr * 0.35, dr * 0.1, x, y, dr);
  dg.addColorStop(0, mix('#55555c', '#d0d0d8', push * 0.8));
  dg.addColorStop(1, '#101012');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(x, y, dr, 0, TAU);
  ctx.fill();
}

function drawTweeter(ctx, x, y, r) {
  ctx.fillStyle = '#26262a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.05, x, y, r * 0.7);
  g.addColorStop(0, '#9a9aa2');
  g.addColorStop(1, '#101012');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, TAU);
  ctx.fill();
}

const speakers = {
  id: 'speakers',
  name: 'Speakers',
  ne: 'स्पिकर',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.64, size: 0.11, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.692, size: 0.05, font: 'bebas', upper: true, style: 'tag', color: 'accent' } }
    : f.square
      ? { title: { y: 0.76, size: 0.07, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.83, size: 0.034, font: 'bebas', upper: true, style: 'tag', color: 'accent' } }
      : { title: { y: 0.79, size: 0.08, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.875, size: 0.036, font: 'bebas', upper: true, style: 'tag', color: 'accent' } }),
  setup: () => ({ push: 0, rings: [], beats: -1 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    ctx.drawImage(layer(st, 'bg', w, h, idOf(f.photo.blur), (g) => {
      drawCover(g, f.photo.blur, 0, 0, w, h, 1.1);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, 0, w, h);
      vignette(g, f, 0.5);
    }), 0, 0);
    const L = speakerLayout(f);

    // Cone pushes out fast on the kick and settles back slower.
    const target = clamp(a.kick * 1.1 + a.bass * 0.15);
    st.push += (target - st.push) * (1 - Math.exp(-f.dt * (target > st.push ? 40 : 10)));
    if (a.beats !== st.beats) {
      st.beats = a.beats;
      for (const [bx, by] of L.boxes) st.rings.push({ x: bx, y: by, t: 0 });
      while (st.rings.length > 12) st.rings.shift();
    }

    // Glow from the speakers onto the room.
    for (const [bx, by0] of L.boxes) {
      const by = L.horiz ? by0 : by0 + L.ch * 0.1;
      const R = L.r * 2.5;
      const g = ctx.createRadialGradient(bx, by, L.r * 0.5, bx, by, R);
      g.addColorStop(0, rgba(f.color.accent, 0.3 * st.push + 0.06));
      g.addColorStop(1, rgba(f.color.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(bx - R, by - R, R * 2, R * 2);
    }

    // Cabinets.
    const shake = st.push * s * 0.004;
    L.boxes.forEach(([bx, by], i) => {
      const jx = noise1(f.t * 40, i * 3 + 1) * shake, jy = noise1(f.t * 40, i * 3 + 2) * shake;
      const x = bx - L.cw / 2 + jx, y = by - L.ch / 2 + jy;
      const cab = ctx.createLinearGradient(x, y, x + (L.horiz ? 0 : L.cw), y + (L.horiz ? L.ch : 0));
      cab.addColorStop(0, '#1d1d21');
      cab.addColorStop(0.5, '#141417');
      cab.addColorStop(1, '#0c0c0e');
      ctx.fillStyle = cab;
      roundRect(ctx, x, y, L.cw, L.ch, s * 0.02);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = Math.max(1, s * 0.003);
      ctx.stroke();
      const wx = bx + jx, wy = by + jy;
      if (L.horiz) {
        drawCone(ctx, f, wx, wy, L.r, st.push);
        drawTweeter(ctx, wx - L.cw * 0.36, wy, L.r * 0.3);
        drawTweeter(ctx, wx + L.cw * 0.36, wy, L.r * 0.3);
      } else {
        drawTweeter(ctx, wx, y + L.ch * 0.17, L.r * 0.3);
        drawCone(ctx, f, wx, y + L.ch * 0.6, L.r, st.push);
      }
    });

    // Bass ripples rolling out of the woofers.
    ctx.lineWidth = Math.max(1.5, s * 0.006);
    for (const rg of st.rings) {
      rg.t += f.dt;
      if (rg.t > 0.9) continue;
      const p = rg.t / 0.9;
      const cy = L.horiz ? rg.y : rg.y - L.ch / 2 + L.ch * 0.6;
      ctx.strokeStyle = rgba(f.color.accent, (1 - p) * 0.6);
      ctx.beginPath();
      ctx.arc(rg.x, cy, L.r * (1.12 + p * 1.6), 0, TAU);
      ctx.stroke();
    }

    // Photo in the middle.
    const [pcx, pcy, ps] = L.photo;
    const sz = ps * (1 + a.kick * 0.03);
    withGlow(ctx, 'rgba(0,0,0,0.7)', s * 0.04, () => {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, pcx - sz / 2 - s * 0.008, pcy - sz / 2 - s * 0.008, sz + s * 0.016, sz + s * 0.016, s * 0.022);
      ctx.fill();
    });
    ctx.save();
    roundRect(ctx, pcx - sz / 2, pcy - sz / 2, sz, sz, s * 0.016);
    ctx.clip();
    drawCover(ctx, f.photo.sharp, pcx - sz / 2, pcy - sz / 2, sz, sz, 1.04);
    ctx.restore();
    grit(ctx, f, 0.07);
  },
};

export default [street, bassPunch, mixtape, glitch, graffiti, speakers];
