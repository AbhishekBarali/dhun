// Nepali looks: mountains, prayer flags, lali gurans, diyo, dhaka, tihar and
// village terraces. Made for lok geet, dohori, adhunik love songs and bhajans.
import {
  TAU, clamp, lerp, smooth, rng, noise1, rgba, mix, shade,
  resample, mirrored, smoothLine, band,
  photoBackground, drawCover, slowZoom, circlePhoto, fadeEdge, vignette,
} from '../helpers.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Soft round light, drawn once and stamped with 'lighter'.
function glowSprite(rgb, size = 96) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.25, `rgba(${rgb},0.55)`);
  gr.addColorStop(0.6, `rgba(${rgb},0.15)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

// A line with a soft halo, drawn as layered strokes (cheaper than shadowBlur).
function glowLine(ctx, pts, halo, core, lw) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  smoothLine(ctx, pts);
  ctx.strokeStyle = halo;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = lw * 6;
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = lw * 2.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = core;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
}

// Point on a quadratic curve p0 -> p2 with control p1.
function quad(x0, y0, x1, y1, x2, y2, t) {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2];
}

// Value from a half spectrum (bass first) by distance from a centre x.
function fromCentre(arr, x, c, spread = 2.2) {
  const n = arr.length - 1;
  const d = clamp(Math.abs(x - c) * spread) * n;
  const j = Math.floor(d), fr = d - j;
  return lerp(arr[j], arr[Math.min(n, j + 1)], fr);
}

// ---------- Himalaya ----------

// A mountain skyline: overlapping peaks with concave slopes.
function ridgeProfile(r, n, w, s, widthK, seed) {
  const p = new Float32Array(n);
  const count = Math.max(3, Math.round(w / (s * 0.3 * widthK)));
  const peaks = [];
  for (let k = 0; k < count; k++) {
    peaks.push({
      x: (k + 0.15 + r() * 0.7) / count,
      h: 0.45 + r() * 0.55,
      w: (s * widthK * (0.24 + r() * 0.22)) / w,
    });
  }
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let v = 0.12;
    for (const pk of peaks) {
      const d = Math.abs(x - pk.x) / pk.w;
      if (d < 1) v = Math.max(v, pk.h * Math.pow(1 - d, 1.5));
    }
    p[i] = v + noise1(x * (w / s) * 14, seed) * 0.025;
  }
  return p;
}

// Peaks of a profile, each with the lowest point to its left and right.
function findPeaks(p) {
  const n = p.length, tops = [];
  for (let i = 1; i < n - 1; i++) {
    let top = true;
    for (let k = Math.max(0, i - 5); k <= Math.min(n - 1, i + 5); k++) if (p[k] > p[i]) top = false;
    if (top) tops.push(i);
  }
  const low = (a, b) => {
    let m = a;
    for (let i = a; i <= b; i++) if (p[i] < p[m]) m = i;
    return m;
  };
  return tops.map((t, k) => [t, low(k ? tops[k - 1] : 0, t), low(t, k < tops.length - 1 ? tops[k + 1] : n - 1)]);
}

const himalaya = {
  id: 'himalaya',
  name: 'Himalaya',
  ne: 'हिमाल',
  cat: 'nepali',
  text: (f) => ({
    title: { y: 0.12, font: 'martel' },
    sub: { y: f.portrait ? 0.165 : 0.195 },
  }),
  setup(f) {
    const r = rng(11);
    const n = 120;
    const P = f.portrait;
    const defs = [
      { base: P ? 0.6 : 0.6, amp: 0.26, k: 1.25, c: 0.3, snow: 0.55, col: '#a3b2c8', speed: 0.025, push: 0.3 },
      { base: P ? 0.7 : 0.73, amp: 0.18, k: 1.0, c: 0.72, snow: 0.82, col: '#61769a', speed: 0.05, push: 0.4 },
      { base: P ? 0.8 : 0.84, amp: 0.12, k: 0.8, c: 0.45, snow: 9, col: '#35465f', speed: 0.1, push: 0.5 },
    ];
    const layers = defs.map((d, li) => {
      if (P) d.amp *= 1.3;
      const prof = ridgeProfile(r, n, f.w, f.s, d.k, li + 3);
      return { ...d, prof, peaks: findPeaks(prof), echo: new Float32Array(24) };
    });
    const fn = 40;
    const frontProf = new Float32Array(fn);
    for (let i = 0; i < fn; i++) frontProf[i] = 0.5 + 0.5 * noise1((i / (fn - 1)) * (f.w / f.s) * 2.2, 9);
    return { layers, n, fn, frontProf, front: new Float32Array(24), tmp: new Float32Array(24) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.06, zoom: 0.06 });
    // dusk tint over the sky
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
    sky.addColorStop(0, 'rgba(16,24,54,0.55)');
    sky.addColorStop(0.55, 'rgba(60,52,100,0.22)');
    sky.addColorStop(1, 'rgba(255,170,120,0.3)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // the sun, its glow breathes with the bass
    const sx = w * (f.portrait ? 0.7 : 0.75), sy = h * (f.portrait ? 0.3 : 0.25);
    const sr = s * 0.062 * (1 + a.kick * 0.04);
    const gr = s * (0.22 + a.bass * 0.14 + a.beat * 0.05);
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.7, sx, sy, gr);
    halo.addColorStop(0, `rgba(255,214,150,${0.5 + a.beat * 0.25})`);
    halo.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - gr, sy - gr, gr * 2, gr * 2);
    const disc = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
    disc.addColorStop(0, '#fffaf0');
    disc.addColorStop(1, '#ffd38a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();

    // music: smoothed half spectrum, back ridges follow it more slowly
    resample(a.bands.subarray(0, 48), 24, st.tmp);
    for (let i = 0; i < 24; i++) {
      st.front[i] = lerp(st.front[i], st.tmp[i], 0.45);
      for (const L of st.layers) L.echo[i] = lerp(L.echo[i], st.front[i], L.speed);
    }

    const n = st.n;
    for (let li = 0; li < st.layers.length; li++) {
      const L = st.layers[li];
      const by = L.base * h, amp = L.amp * s;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        pts.push([x * w, by - amp * (L.prof[i] + L.push * fromCentre(L.echo, x, L.c))]);
      }
      let top = h;
      for (const p of pts) top = Math.min(top, p[1]);
      const low = li < st.layers.length - 1 ? st.layers[li + 1].base * h + 2 : h * 0.97 - s * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, low);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(w, low);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, top, 0, by + amp * 0.3);
      fill.addColorStop(0, L.col);
      fill.addColorStop(1, shade(L.col, -0.35));
      ctx.fillStyle = fill;
      ctx.fill();

      // snow above the snow line
      const ys = by - amp * L.snow;
      if (top < ys) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        for (let i = n - 1; i >= 0; i--) {
          const jag = noise1(i * 0.45, li) * amp * 0.07;
          ctx.lineTo(pts[i][0], Math.max(pts[i][1], ys + jag));
        }
        ctx.closePath();
        const sn = ctx.createLinearGradient(0, top, 0, ys);
        sn.addColorStop(0, li ? 'rgba(236,240,248,0.85)' : 'rgba(250,251,255,0.95)');
        sn.addColorStop(1, 'rgba(210,220,236,0.75)');
        ctx.fillStyle = sn;
        ctx.fill();
      }

      // shade the face of each peak turned away from the sun
      ctx.beginPath();
      const foot = by + amp * 0.4;
      for (const [pi, lv, rv] of L.peaks) {
        const side = pts[pi][0] < sx ? -1 : 1;
        const v = side < 0 ? lv : rv;
        ctx.moveTo(pts[pi][0], pts[pi][1]);
        for (let i = pi; i !== v; i += side) ctx.lineTo(pts[i + side][0], pts[i + side][1]);
        ctx.lineTo(pts[v][0], foot);
        ctx.lineTo(pts[pi][0] - side * Math.abs(pts[v][0] - pts[pi][0]) * 0.35, foot);
        ctx.closePath();
      }
      ctx.fillStyle = 'rgba(20,28,58,0.24)';
      ctx.fill();

      // mist at the foot of each range
      const mist = ctx.createLinearGradient(0, by - amp * 0.55, 0, by);
      mist.addColorStop(0, 'rgba(225,228,240,0)');
      mist.addColorStop(1, 'rgba(225,228,240,0.3)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, by - amp * 0.55, w, low - by + amp * 0.55);
      ctx.fillStyle = 'rgba(225,228,240,0.3)';
      ctx.fillRect(0, by, w, low - by);
    }

    // front ridge: the sound itself
    const fn = st.fn, fb = h * 0.97;
    const fp = [];
    for (let i = 0; i < fn; i++) {
      const x = i / (fn - 1);
      const v = fromCentre(st.front, x, 0.42, 2) * (0.85 + 0.15 * Math.sin(i * 0.6 - f.t * 2));
      fp.push([x * w, fb - s * (0.06 + 0.06 * st.frontProf[i] + 0.2 * v * (1 + a.kick * 0.18))]);
    }
    ctx.beginPath();
    smoothLine(ctx, fp);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const ff = ctx.createLinearGradient(0, fb - s * 0.3, 0, h);
    ff.addColorStop(0, '#1c2638');
    ff.addColorStop(1, '#090c14');
    ctx.fillStyle = ff;
    ctx.fill();
    glowLine(ctx, fp, `rgba(255,190,120,${0.7 + a.beat * 0.3})`, `rgba(255,232,196,${0.75 + a.beat * 0.25})`, Math.max(1.2, s * 0.004 * (1 + a.beat * 0.3)));
  },
};

// ---------- Prayer flags ----------

// Traditional order: blue, white, red, green, yellow.
const FLAG_COLORS = ['#1f5aa8', '#f2eee2', '#c42f2a', '#2e8a4d', '#efc12f'];

const prayerFlags = {
  id: 'prayer-flags',
  name: 'Prayer Flags',
  ne: 'लुङ्टा',
  cat: 'nepali',
  text: (f) => (f.portrait
    ? { title: { y: 0.74, font: 'baloo' }, sub: { y: 0.785 } }
    : { title: { y: 0.78, font: 'baloo' }, sub: { y: 0.86 } }),
  setup(f) {
    const { w, s } = f;
    const r = rng(5);
    const k = f.portrait ? 1.35 : 1;
    const defs = [
      { x0: -0.04 * w, y0: -0.03 * s * k, x1: 1.04 * w, y1: 0.1 * s * k, cy: 0.27 * s * k, size: 0.78, dark: 0.22 },
      { x0: -0.04 * w, y0: 0.06 * s * k, x1: 1.04 * w, y1: 0.0 * s, cy: 0.37 * s * k, size: 1, dark: 0 },
    ];
    const strings = defs.map((d, j) => {
      const fw = s * (f.portrait ? 0.095 : 0.075) * d.size, gap = fw * 0.3;
      const len = w * 1.12;
      const count = Math.max(5, Math.floor(len / (fw + gap)));
      const dt = fw / len;
      const flags = [];
      for (let i = 0; i < count; i++) {
        const t0 = (i + 0.5) / count - dt / 2;
        flags.push({ t0, t1: t0 + dt, ph: r() * TAU, col: shade(FLAG_COLORS[(i + j * 2) % 5], -d.dark), white: (i + j * 2) % 5 === 1, fh: fw * (1.15 + r() * 0.12) });
      }
      return { ...d, flags, seed: j };
    });
    // printed prayers on a unit flag: rows of short dashes and a small box in the middle
    const ink = new Path2D();
    for (let row = 0; row < 7; row++) {
      const y = 0.16 + row * 0.1;
      let x = 0.12;
      while (x < 0.86) {
        const len = 0.08 + r() * 0.2;
        const inBox = y > 0.33 && y < 0.62 && x + len > 0.36 && x < 0.64;
        if (!inBox) ink.rect(x, y, Math.min(len, 0.88 - x), 0.028);
        x += len + 0.04;
      }
    }
    ink.rect(0.38, 0.33, 0.24, 0.025);
    ink.rect(0.38, 0.6, 0.24, 0.025);
    ink.rect(0.38, 0.33, 0.035, 0.295);
    ink.rect(0.585, 0.33, 0.035, 0.295);
    ink.rect(0.45, 0.42, 0.1, 0.11);
    return { strings, ink, wind: 0.3, gustT: -10 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.08 });
    fadeEdge(ctx, f, 'top', 0.4, 0.3);
    fadeEdge(ctx, f, 'bottom', 0.5, 0.65);

    st.wind = smooth(st.wind, 0.2 + a.level * 0.6 + a.energy * 0.3, f.dt, 2.5);
    if (a.beatHit) st.gustT = f.t;

    for (const S of st.strings) {
      const sway = Math.sin(f.t * 0.7 + S.seed * 2) * s * 0.006 + a.kick * s * 0.008;
      const cx = (S.x0 + S.x1) / 2, cy = S.cy + sway;
      for (const fl of S.flags) {
        const A = quad(S.x0, S.y0, cx, cy, S.x1, S.y1, fl.t0);
        const B = quad(S.x0, S.y0, cx, cy, S.x1, S.y1, fl.t1);
        const p = A[0] / w;
        // a gust runs along the string on each beat
        const gust = Math.exp(-Math.pow((f.t - st.gustT) * 2.4 - p * 1.4, 2) * 5) * (0.5 + a.level);
        const flick = noise1(f.t * (1.1 + st.wind * 2) + fl.ph * 3, 2);
        const ang = clamp(0.1 + st.wind * 0.5 + gust * 0.5 + flick * 0.12, -0.3, 1.25);
        const vx = Math.sin(ang) * fl.fh, vy = Math.cos(ang) * fl.fh;
        const ph = f.t * (3 + st.wind * 6) + fl.ph;
        const amp = 0.035 + st.wind * 0.09 + gust * 0.08;
        const q1 = Math.sin(ph) * amp, q2 = Math.sin(ph + 1.3) * amp, q3 = Math.sin(ph + 2.4) * amp;

        ctx.save();
        ctx.transform(B[0] - A[0], B[1] - A[1], vx, vy, A[0], A[1]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(1, 0);
        ctx.quadraticCurveTo(1 + q1, 0.5, 1 + q2 * 1.4, 1 + q2 * 0.4);
        ctx.quadraticCurveTo(0.5 + q3 * 0.4, 1 + q3 * 1.3, q1 * 1.2, 1 + q1 * 0.4);
        ctx.quadraticCurveTo(q2, 0.5, 0, 0);
        ctx.closePath();
        ctx.fillStyle = fl.col;
        ctx.fill();
        // soft folds in the cloth
        const fold = ctx.createLinearGradient(0, 0, 1, 0);
        for (let k = 0; k <= 4; k++) {
          fold.addColorStop(k / 4, `rgba(0,0,0,${0.03 + 0.13 * (0.5 + 0.5 * Math.sin(ph * 0.8 + k * 1.7))})`);
        }
        ctx.fillStyle = fold;
        ctx.fill();
        ctx.fillStyle = fl.white ? 'rgba(40,40,70,0.3)' : 'rgba(0,0,0,0.2)';
        ctx.fill(st.ink);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, 1, 0.07);
        ctx.restore();
      }
      // the cord
      ctx.beginPath();
      ctx.moveTo(S.x0, S.y0);
      ctx.quadraticCurveTo(cx, cy, S.x1, S.y1);
      ctx.lineWidth = Math.max(1, s * 0.0028);
      ctx.strokeStyle = S.dark ? 'rgba(200,190,170,0.7)' : 'rgba(235,225,205,0.9)';
      ctx.stroke();
    }
  },
};

// ---------- Lali Gurans ----------

function petalPath(g, cx, by, ty, wd) {
  const len = by - ty;
  g.beginPath();
  g.moveTo(cx, by);
  g.bezierCurveTo(cx - wd, by - len * 0.3, cx - wd, ty + len * 0.08, cx - wd * 0.38, ty);
  g.quadraticCurveTo(cx, ty + len * 0.1, cx + wd * 0.38, ty);
  g.bezierCurveTo(cx + wd, ty + len * 0.08, cx + wd, by - len * 0.3, cx, by);
  g.closePath();
}

function petalSprite(P, base) {
  const c = makeCanvas(P, P), g = c.getContext('2d');
  const cx = P / 2, by = P * 0.96, ty = P * 0.05;
  petalPath(g, cx, by, ty, P * 0.48);
  const gr = g.createRadialGradient(cx, by, P * 0.04, cx, by - P * 0.25, P * 0.8);
  gr.addColorStop(0, shade(base, -0.4));
  gr.addColorStop(0.5, base);
  gr.addColorStop(1, shade(base, 0.22));
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = rgba(shade(base, -0.45), 0.35);
  g.lineWidth = Math.max(0.6, P * 0.016);
  g.beginPath();
  g.moveTo(cx, by - P * 0.04);
  g.quadraticCurveTo(cx + P * 0.02, P * 0.5, cx, ty + P * 0.2);
  g.stroke();
  return c;
}

// One five-petal rhododendron flower, painted onto g.
function drawFlower(g, x, y, R, base, rot, r) {
  for (let k = 0; k < 5; k++) {
    g.save();
    g.translate(x, y);
    g.rotate(rot + (k / 5) * TAU);
    petalPath(g, 0, 0, -R, R * 0.62);
    const gr = g.createRadialGradient(0, 0, R * 0.05, 0, -R * 0.4, R);
    gr.addColorStop(0, shade(base, -0.45));
    gr.addColorStop(0.45, base);
    gr.addColorStop(1, shade(base, 0.2));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = rgba(shade(base, -0.5), 0.35);
    g.lineWidth = Math.max(0.6, R * 0.015);
    g.stroke();
    // dark spots on the upper petal, as on real lali gurans
    if (k === 0) {
      g.fillStyle = rgba(shade(base, -0.6), 0.55);
      for (let d = 0; d < 7; d++) {
        g.beginPath();
        g.arc((r() - 0.5) * R * 0.3, -R * (0.18 + r() * 0.25), R * 0.025, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }
  // stamens
  g.lineWidth = Math.max(0.6, R * 0.018);
  for (let k = 0; k < 10; k++) {
    const an = rot + (k / 10) * TAU + 0.3;
    const len = R * (0.45 + r() * 0.15);
    const ex = x + Math.cos(an) * len, ey = y + Math.sin(an) * len;
    g.strokeStyle = 'rgba(255,225,230,0.8)';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(an + 0.3) * len * 0.5, y + Math.sin(an + 0.3) * len * 0.5, ex, ey);
    g.stroke();
    g.fillStyle = '#3a1410';
    g.beginPath();
    g.arc(ex, ey, R * 0.03, 0, TAU);
    g.fill();
  }
  g.fillStyle = shade(base, -0.55);
  g.beginPath();
  g.arc(x, y, R * 0.1, 0, TAU);
  g.fill();
}

function leaf(g, x, y, len, wd, ang) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -wd, len, 0);
  g.quadraticCurveTo(len * 0.45, wd, 0, 0);
  const gr = g.createLinearGradient(0, -wd, 0, wd);
  gr.addColorStop(0, '#3f6b34');
  gr.addColorStop(1, '#1d3a1f');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(170,200,140,0.45)';
  g.lineWidth = Math.max(0.6, wd * 0.08);
  g.beginPath();
  g.moveTo(len * 0.05, 0);
  g.lineTo(len * 0.92, 0);
  g.stroke();
  g.restore();
}

// A cluster of blooms with leaves behind, drawn once.
function bloomSprite(C, r) {
  const c = makeCanvas(C, C), g = c.getContext('2d');
  const m = C / 2;
  for (let k = 0; k < 7; k++) {
    const an = (k / 7) * TAU + r() * 0.4;
    leaf(g, m, m, C * (0.36 + r() * 0.1), C * 0.065, an);
  }
  drawFlower(g, m - C * 0.13, m - C * 0.08, C * 0.13, '#c81e3a', 0.4, r);
  drawFlower(g, m + C * 0.12, m - C * 0.1, C * 0.12, '#b3152f', 1.1, r);
  drawFlower(g, m + C * 0.02, m + C * 0.12, C * 0.13, '#d42c47', 0.1, r);
  drawFlower(g, m, m - C * 0.01, C * 0.15, '#dd3550', 0.7, r);
  return c;
}

const laliGurans = {
  id: 'lali-gurans',
  name: 'Lali Gurans',
  ne: 'लालीगुराँस',
  cat: 'nepali',
  text: (f) => ({
    title: { y: f.portrait ? 0.2 : 0.14, font: 'yatra', size: 0.08 },
    sub: { y: f.portrait ? 0.245 : 0.22 },
  }),
  setup(f) {
    const P = Math.max(12, Math.round(f.s * 0.055));
    const cols = ['#b5172f', '#cf2742', '#e0476a', '#ee8099', '#a3122a'];
    const sprites = cols.map((c) => petalSprite(P, c));
    const r = rng(21);
    const ps = [];
    for (let i = 0; i < 130; i++) {
      const p = { burst: i >= 90, on: i < 90 };
      resetPetal(p, r, f, true);
      ps.push(p);
    }
    const C = Math.round(f.s * 0.5);
    // the same cluster, turned three ways
    const one = bloomSprite(C, rng(8));
    const blooms = [0.5, 2.6, 4.2].map((rot) => {
      const c = makeCanvas(C, C), g = c.getContext('2d');
      g.translate(C / 2, C / 2);
      g.rotate(rot);
      g.drawImage(one, -C / 2, -C / 2);
      return c;
    });
    return { sprites, P, r, ps, blooms, C, wave: new Float32Array(40), echo: new Float32Array(40), gust: 0 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.12 });
    ctx.fillStyle = 'rgba(80,4,28,0.22)';
    ctx.fillRect(0, 0, w, h);
    vignette(ctx, f, 0.45);

    // blooms in two corners, gently swaying, swelling with the bass
    const C = st.C * (f.portrait ? 0.85 : 1);
    const bloom = (img, x, y, k, ph) => {
      const sc = (1 + a.bass * 0.06 + a.beat * 0.04) * k;
      const z = C * sc;
      x += Math.sin(f.t * 0.6 + ph) * s * 0.006;
      y += Math.cos(f.t * 0.5 + ph) * s * 0.004;
      ctx.drawImage(img, x - z / 2, y - z / 2, z, z);
    };
    bloom(st.blooms[0], w - s * 0.06, s * 0.04, 1, 0);
    bloom(st.blooms[1], s * 0.05, h - s * 0.06, 1.1, 2);
    bloom(st.blooms[2], w + s * 0.02, h - s * 0.2, 0.6, 4);

    // soft wave line along the bottom
    const n = st.wave.length;
    const m = mirrored(a.bands, n);
    const pts = [], ech = [];
    for (let i = 0; i < n; i++) {
      st.wave[i] = lerp(st.wave[i], m[i], 0.5);
      st.echo[i] = lerp(st.echo[i], st.wave[i], 0.08);
      const x = (i / (n - 1)) * w;
      const taper = Math.sin((Math.PI * i) / (n - 1));
      pts.push([x, h * 0.95 - st.wave[i] * taper * s * 0.08]);
      ech.push([x, h * 0.95 - st.echo[i] * taper * s * 0.11]);
    }
    ctx.beginPath();
    smoothLine(ctx, ech);
    ctx.lineWidth = Math.max(1, s * 0.0025);
    ctx.strokeStyle = 'rgba(255,170,190,0.35)';
    ctx.stroke();
    glowLine(ctx, pts, 'rgba(255,90,130,1)', 'rgba(255,220,228,0.9)', Math.max(1.2, s * 0.004));

    // petals: more and bigger on each beat
    if (a.beatHit) {
      let added = 0;
      for (const p of st.ps) {
        if (p.burst && !p.on && added < 6) {
          resetPetal(p, st.r, f, false);
          p.on = true;
          p.size = 1 + st.r() * 0.6;
          p.push = (st.r() - 0.5) * s * 0.5;
          added++;
        }
      }
    }
    st.gust = smooth(st.gust, a.kick, f.dt, 8);
    const fall = s * 0.075 * (1 + a.energy * 0.6);
    const grow = 1 + a.beat * 0.18;
    const P = st.P;
    for (const p of st.ps) {
      if (!p.on) continue;
      p.push *= Math.exp(-f.dt * 1.2);
      const drift = noise1(f.t * 0.35 + p.seed, 3) * s * 0.1 + s * 0.03;
      p.x += (drift + p.push + st.gust * s * 0.3 * Math.sin(p.seed + f.t * 0.5)) * f.dt;
      p.y += fall * p.fall * (0.7 + 0.4 * p.size) * (1 + st.gust * 0.6) * f.dt;
      p.rot += p.spin * f.dt * (1 + a.kick * 2);
      p.flip += p.flipV * f.dt;
      if (p.y > h + P * 2 || p.x > w + P * 3 || p.x < -P * 3) {
        if (p.burst) { p.on = false; continue; }
        resetPetal(p, st.r, f, false);
      }
      const sz = P * p.size * grow;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(0.25 + 0.75 * Math.abs(Math.cos(p.flip)), 1);
      ctx.globalAlpha = p.size < 0.75 ? 0.8 : 1;
      ctx.drawImage(st.sprites[p.spr], -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  },
};

function resetPetal(p, r, f, anywhere) {
  p.x = r() * f.w * 1.1 - f.w * 0.15;
  p.y = anywhere ? r() * f.h : -r() * f.s * 0.15 - f.s * 0.05;
  p.size = 0.5 + r() * 0.6;
  p.rot = r() * TAU;
  p.spin = (r() - 0.5) * 2.4;
  p.flip = r() * TAU;
  p.flipV = 1 + r() * 2.5;
  p.spr = Math.floor(r() * 5);
  p.fall = 0.7 + r() * 0.6;
  p.seed = r() * 100;
  p.push = 0;
}

// ---------- Diyo ----------

const GOLD = '#f2c14e';
const SAFFRON = '#ff9933';

function polar(r, an) { return [Math.cos(an) * r, Math.sin(an) * r]; }

function petalRing(g, count, r0, r1, R, off = 0, fat = 0.5) {
  for (let k = 0; k < count; k++) {
    const a0 = (k / count) * TAU + off, hw = (TAU / count) * fat;
    const L = polar(r0 * R, a0 - hw), Rt = polar(r0 * R, a0 + hw), tip = polar(r1 * R, a0);
    const c1 = polar((r0 + (r1 - r0) * 0.7) * R, a0 - hw * 0.95), c2 = polar((r0 + (r1 - r0) * 0.7) * R, a0 + hw * 0.95);
    g.beginPath();
    g.moveTo(L[0], L[1]);
    g.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]);
    g.quadraticCurveTo(c2[0], c2[1], Rt[0], Rt[1]);
    g.stroke();
  }
}

function ring(g, r) {
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.stroke();
}

function dots(g, count, r, dr, off = 0) {
  g.beginPath();
  for (let k = 0; k < count; k++) {
    const [x, y] = polar(r, (k / count) * TAU + off);
    g.moveTo(x + dr, y);
    g.arc(x, y, dr, 0, TAU);
  }
  g.fill();
}

// Line-drawn mandala around a photo of radius pr, drawn once.
function mandalaSprite(pr) {
  const R = pr / 0.55;
  const size = Math.ceil(R * 2 + 4);
  const c = makeCanvas(size, size), g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.strokeStyle = GOLD;
  g.fillStyle = GOLD;
  g.lineWidth = Math.max(1, R * 0.006);
  g.lineJoin = 'round';
  ring(g, R * 0.6);
  petalRing(g, 16, 0.62, 0.8, R);
  g.globalAlpha = 0.6;
  petalRing(g, 16, 0.64, 0.75, R, 0, 0.3);
  petalRing(g, 16, 0.61, 0.72, R, Math.PI / 16, 0.45);
  g.globalAlpha = 1;
  ring(g, R * 0.815);
  dots(g, 64, R * 0.835, R * 0.006);
  petalRing(g, 32, 0.855, 0.93, R, 0, 0.55);
  for (let k = 0; k < 48; k++) {
    const an = (k / 48) * TAU;
    g.beginPath();
    g.arc(...polar(R * 0.955, an), R * 0.018, an - Math.PI / 2, an + Math.PI / 2);
    g.stroke();
  }
  ring(g, R * 0.99);
  return { c, size };
}

// Clay lamp body, drawn once. Returns the sprite and where the wick sits.
function lampSprite(lw) {
  const H = lw * 0.5, ry = lw * 0.12, top = ry + 2;
  const c = makeCanvas(lw, top + H + 2), g = c.getContext('2d');
  const cx = lw / 2, rx = lw * 0.48;
  g.beginPath();
  g.moveTo(cx - rx, top);
  g.bezierCurveTo(cx - rx * 0.95, top + H * 0.6, cx - rx * 0.4, top + H, cx, top + H);
  g.bezierCurveTo(cx + rx * 0.4, top + H, cx + rx * 0.95, top + H * 0.6, cx + rx, top);
  g.closePath();
  const body = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
  body.addColorStop(0, '#4e1f0c');
  body.addColorStop(0.3, '#b9592b');
  body.addColorStop(0.55, '#a14a22');
  body.addColorStop(1, '#40180a');
  g.fillStyle = body;
  g.fill();
  // painted dots on the clay
  g.fillStyle = 'rgba(255,214,140,0.7)';
  for (let k = 1; k < 9; k++) {
    const x = cx - rx * 0.75 + (k / 9) * rx * 1.5;
    const y = top + H * 0.32 + Math.pow((x - cx) / rx, 2) * -H * 0.12;
    g.beginPath();
    g.arc(x, y, Math.max(0.6, lw * 0.012), 0, TAU);
    g.fill();
  }
  // rim and oil
  g.fillStyle = '#c96d3a';
  g.beginPath();
  g.ellipse(cx, top, rx, ry, 0, 0, TAU);
  g.fill();
  const oil = g.createLinearGradient(0, top - ry, 0, top + ry);
  oil.addColorStop(0, '#2c1206');
  oil.addColorStop(1, '#8a4a16');
  g.fillStyle = oil;
  g.beginPath();
  g.ellipse(cx, top + ry * 0.1, rx * 0.85, ry * 0.7, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#3a1406';
  g.lineWidth = Math.max(1, lw * 0.025);
  g.beginPath();
  g.moveTo(cx + rx * 0.05, top + ry * 0.2);
  g.lineTo(cx + rx * 0.12, top - ry * 0.25);
  g.stroke();
  return { c, wx: cx + rx * 0.12, wy: top - ry * 0.25 };
}

const diyo = {
  id: 'diyo',
  name: 'Diyo',
  ne: 'दियो',
  cat: 'nepali',
  text: (f) => (f.portrait
    ? { title: { y: 0.67, font: 'yatra', color: '#ffd27a', style: 'glow' }, sub: { y: 0.71, color: '#ffe9c2' } }
    : { title: { y: 0.735, font: 'yatra', color: '#ffd27a', style: 'glow', size: 0.07 }, sub: { y: 0.805, color: '#ffe9c2', size: 0.034 } }),
  setup(f) {
    const N = f.portrait ? 5 : f.square ? 7 : 9;
    const pr = f.s * (f.portrait ? 0.24 : 0.2);
    const sp = f.w / N;
    const lw = Math.round(Math.min(sp * 0.62, f.s * 0.13));
    return {
      N, pr, lw,
      lamp: lampSprite(lw),
      man: mandalaSprite(pr),
      glow: glowSprite('255,180,80'),
      fl: new Float32Array(N),
      embers: Array.from({ length: 30 }, () => ({ life: 0, x: 0, y: 0, vx: 0 })),
      r: rng(3),
      spin: 0,
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.45, zoom: 0.05 });
    ctx.fillStyle = 'rgba(60,18,3,0.6)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h * (f.portrait ? 0.37 : 0.4);
    const pr = st.pr * (1 + a.kick * 0.03);
    // golden glow behind the photo
    const gr = st.pr * (2 + a.bass * 0.6);
    const halo = ctx.createRadialGradient(cx, cy, st.pr * 0.8, cx, cy, gr);
    halo.addColorStop(0, `rgba(255,170,60,${0.35 + a.beat * 0.2})`);
    halo.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

    // turning mandala
    st.spin += f.dt * (0.04 + a.energy * 0.05);
    const ms = st.man.size;
    ctx.save();
    ctx.globalAlpha = 0.55 + a.beat * 0.25;
    ctx.translate(cx, cy);
    ctx.rotate(st.spin);
    ctx.drawImage(st.man.c, -ms / 2, -ms / 2);
    // a ring of beads turning the other way
    ctx.rotate(-st.spin * 2.5);
    ctx.globalAlpha = 0.7 + a.bass * 0.3;
    ctx.fillStyle = GOLD;
    dots(ctx, 36, st.pr * 1.075, Math.max(1, s * 0.0035) * (1 + a.beat * 0.4));
    ctx.restore();

    ctx.fillStyle = 'rgba(255,190,80,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, pr + s * 0.02, 0, TAU);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(cx, cy, pr + s * 0.006, 0, TAU);
    ctx.fill();
    circlePhoto(ctx, f, cx, cy, pr, 1.05 + a.beat * 0.02);

    // floor glow
    const by = h * 0.965;
    const floor = ctx.createLinearGradient(0, by - s * 0.15, 0, h);
    floor.addColorStop(0, 'rgba(255,150,50,0)');
    floor.addColorStop(1, `rgba(255,150,50,${0.18 + a.level * 0.12})`);
    ctx.fillStyle = floor;
    ctx.fillRect(0, by - s * 0.15, w, h);

    // lamps
    const N = st.N, sp = w / N, L = st.lamp, lw = st.lw;
    const lh = L.c.height;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const k = Math.abs(i - (N - 1) / 2) / Math.max(1, (N - 1) / 2);
      st.fl[i] = smooth(st.fl[i], band(f, k * 0.45, k * 0.45 + 0.1), f.dt, 10);
      const x = (i + 0.5) * sp;
      ctx.globalAlpha = 0.25 + st.fl[i] * 0.3;
      ctx.drawImage(st.glow, x - lw, by - lw * 0.15, lw * 2, lw * 0.4);
    }
    ctx.restore();
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * sp, ly = by - lh;
      ctx.drawImage(L.c, x - lw / 2, ly);
      const v = st.fl[i];
      const fh = lw * (0.4 + 0.65 * v + 0.25 * a.beat) * (1 + 0.1 * noise1(f.t * 7 + i * 3, 4));
      const fw = lw * 0.12 * (1 + 0.3 * v);
      const wx = x - lw / 2 + L.wx, wy = ly + L.wy;
      const tip = noise1(f.t * 3 + i * 5, 6) * fw * 0.9;
      // flame halo
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + v * 0.4;
      const g = fh * 2.4;
      ctx.drawImage(st.glow, wx - g / 2, wy - fh * 0.45 - g / 2, g, g);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(wx + tip, wy - fh);
      ctx.bezierCurveTo(wx + fw + tip * 0.3, wy - fh * 0.45, wx + fw * 0.8, wy, wx, wy);
      ctx.bezierCurveTo(wx - fw * 0.8, wy, wx - fw + tip * 0.3, wy - fh * 0.45, wx + tip, wy - fh);
      const fg = ctx.createRadialGradient(wx, wy - fh * 0.22, 0, wx, wy - fh * 0.3, fh * 0.8);
      fg.addColorStop(0, '#fffbea');
      fg.addColorStop(0.25, '#ffe28a');
      fg.addColorStop(0.6, SAFFRON);
      fg.addColorStop(1, 'rgba(255,90,20,0.2)');
      ctx.fillStyle = fg;
      ctx.fill();
    }

    // embers rise on the beat
    if (a.beatHit) {
      let added = 0;
      for (const e of st.embers) {
        if (e.life <= 0 && added < 3) {
          const i = Math.floor(st.r() * N);
          e.x = (i + 0.5) * sp + (st.r() - 0.5) * lw * 0.2;
          e.y = by - lh - lw * 0.4;
          e.vx = (st.r() - 0.5) * s * 0.04;
          e.life = 1;
          added++;
        }
      }
    }
    ctx.fillStyle = '#ffcf70';
    for (const e of st.embers) {
      if (e.life <= 0) continue;
      e.life -= f.dt * 0.5;
      e.y -= s * 0.09 * f.dt;
      e.x += (e.vx + noise1(f.t * 2 + e.y * 0.01, 7) * s * 0.03) * f.dt;
      ctx.globalAlpha = clamp(e.life) * 0.9;
      ctx.beginPath();
      ctx.arc(e.x, e.y, Math.max(0.8, s * 0.0028), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

// ---------- Dhaka ----------

const DHAKA = { black: '#161212', white: '#f3ead6', red: '#c41e2a', orange: '#ef8a1c', green: '#1d8a4a', yellow: '#f2c230' };

// One woven tile: stepped diamonds on a thread grid, like a dhaka topi.
function dhakaTile(cell, lit) {
  const G = 20, T = G * cell;
  const c = makeCanvas(T, T), g = c.getContext('2d');
  const C = DHAKA;
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const d = Math.abs(i - 9.5) + Math.abs(j - 9.5);
      let col;
      if (d <= 1) col = C.black;
      else if (d <= 3) col = C.white;
      else if (d <= 4) col = C.green;
      else if (d <= 6) col = C.orange;
      else if (d <= 7) col = C.black;
      else if (d <= 9) col = (i - j) % 4 === 0 ? C.white : C.red;
      else if (d <= 10) col = C.white;
      else {
        const dc = 20 - d;
        if (dc <= 1) col = C.yellow;
        else if (dc <= 3) col = C.red;
        else if (dc <= 4) col = C.white;
        else if (dc <= 6) col = C.green;
        else if (dc <= 7) col = C.orange;
        else col = (i + j) % 2 ? C.black : '#2a1d1a';
      }
      g.fillStyle = lit ? shade(col, 0.35) : col;
      g.fillRect(i * cell, j * cell, cell, cell);
    }
  }
  // thread texture
  for (let j = 0; j < G; j++) {
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, j * cell, T, Math.max(1, cell * 0.35));
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(0, j * cell + cell * 0.7, T, Math.max(1, cell * 0.3));
  }
  return c;
}

const dhaka = {
  id: 'dhaka',
  name: 'Dhaka',
  ne: 'ढाका',
  cat: 'nepali',
  text: (f) => (f.portrait
    ? { title: { y: 0.8, font: 'rozha' }, sub: { y: 0.845 } }
    : f.square
      ? { title: { y: 0.76, font: 'rozha' }, sub: { y: 0.82 } }
      : { title: { y: 0.74, font: 'rozha' }, sub: { y: 0.815 } }),
  setup(f) {
    const cell = Math.max(2, Math.round((f.s * 0.11) / 20));
    return { tile: dhakaTile(cell, false), lit: dhakaTile(cell, true), T: cell * 20, ctx: null, spec: new Float32Array(24) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    if (st.ctx !== ctx) {
      st.ctx = ctx;
      st.pat = ctx.createPattern(st.tile, 'repeat');
      st.patLit = ctx.createPattern(st.lit, 'repeat');
    }
    const T = st.T;
    const b = s * (f.portrait ? 0.1 : 0.115);
    const z = s * 0.022;
    const ix = b, iy = b, iw = w - b * 2, ih = h - b * 2;

    // fabric, aligned so a diamond sits in the middle
    const ox = ((w / 2 - T / 2) % T + T) % T, oy = ((h / 2 - T / 2) % T + T) % T;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = st.pat;
    ctx.fillRect(-ox, -oy, w, h);
    ctx.globalAlpha = clamp(0.05 + a.beat * 0.5 + a.bass * 0.15, 0, 0.75);
    ctx.fillStyle = st.patLit;
    ctx.fillRect(-ox, -oy, w, h);
    ctx.restore();

    // a slow sheen across the cloth
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(ix - z, iy - z, iw + z * 2, ih + z * 2);
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    const L = (((f.t * 0.2) % 1.6) - 0.3) * (w + h);
    const d = s * 0.35;
    const sh = ctx.createLinearGradient((L - d) / 2, (L - d) / 2, (L + d) / 2, (L + d) / 2);
    sh.addColorStop(0, 'rgba(255,240,210,0)');
    sh.addColorStop(0.5, `rgba(255,240,210,${0.16 + a.beat * 0.14})`);
    sh.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // photo
    const zm = slowZoom(f, 0.08);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    drawCover(ctx, f.photo.sharp, ix, iy, iw, ih, zm.zoom * (1 + a.beat * 0.012), zm.fx, zm.fy);
    const fade = ctx.createLinearGradient(0, iy + ih * 0.45, 0, iy + ih);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = fade;
    ctx.fillRect(ix, iy, iw, ih);

    // teeth along the inner edge show the spectrum
    resample(a.bands.subarray(0, 48), 24, st.spec);
    const sp = s * 0.034;
    const sides = [
      [ix, iy, 1, 0, iw, 0, 1], [ix + iw, iy, 0, 1, ih, -1, 0],
      [ix + iw, iy + ih, -1, 0, iw, 0, -1], [ix, iy + ih, 0, -1, ih, 1, 0],
    ];
    const cols = [DHAKA.red, DHAKA.black, DHAKA.white, DHAKA.orange, DHAKA.green];
    for (let ci = 0; ci < 5; ci++) {
      ctx.beginPath();
      let k = 0;
      for (const [x0, y0, dx, dy, len, nx, ny] of sides) {
        const cnt = Math.floor(len / sp);
        const off = (len - cnt * sp) / 2;
        for (let i = 0; i < cnt; i++, k++) {
          if (k % 5 !== ci) continue;
          const u = (i + 0.5) / cnt;
          const v = fromCentre(st.spec, u, 0.5, 2);
          const tl = s * (0.008 + 0.035 * v + 0.012 * a.beat);
          const p0 = off + i * sp, p1 = p0 + sp, pm = p0 + sp / 2;
          ctx.moveTo(x0 + dx * p0, y0 + dy * p0);
          ctx.lineTo(x0 + dx * p1, y0 + dy * p1);
          ctx.lineTo(x0 + dx * pm + nx * tl, y0 + dy * pm + ny * tl);
          ctx.closePath();
        }
      }
      ctx.fillStyle = cols[ci];
      ctx.fill();
    }
    ctx.restore();

    // black band with a running white zigzag
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix - z, iy - z, iw + z * 2, ih + z * 2);
    ctx.rect(ix, iy, iw, ih);
    ctx.fillStyle = DHAKA.black;
    ctx.fill('evenodd');
    ctx.beginPath();
    const per = z * 1.4, zamp = z * 0.28;
    const shift = (f.t * z * 1.5) % (per * 2);
    const zig = (x0, y0, dx, dy, len, nx, ny) => {
      for (let p = -shift; p <= len; p += per) {
        const q = clamp(p, 0, len);
        const up = Math.round((p + shift) / per) % 2 ? 1 : -1;
        const px = x0 + dx * q + nx * (z / 2 + up * zamp), py = y0 + dy * q + ny * (z / 2 + up * zamp);
        if (p <= -shift) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    };
    zig(ix - z, iy - z, 1, 0, iw + z * 2, 0, 1);
    zig(ix + iw + z, iy - z, 0, 1, ih + z * 2, -1, 0);
    zig(ix + iw + z, iy + ih + z, -1, 0, iw + z * 2, 0, -1);
    zig(ix - z, iy + ih + z, 0, -1, ih + z * 2, 1, 0);
    ctx.strokeStyle = DHAKA.white;
    ctx.lineWidth = Math.max(1, z * 0.18);
    ctx.lineJoin = 'miter';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.strokeStyle = DHAKA.yellow;
    ctx.strokeRect(ix - z, iy - z, iw + z * 2, ih + z * 2);
    ctx.restore();

    // diamond medallions at the corners
    const md = z * (1.5 + a.beat * 0.35);
    for (const [x, y] of [[ix, iy], [ix + iw, iy], [ix + iw, iy + ih], [ix, iy + ih]]) {
      const dia = (r, col) => {
        ctx.beginPath();
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      };
      dia(md, DHAKA.white);
      dia(md * 0.8, DHAKA.red);
      dia(md * 0.5, DHAKA.orange);
      dia(md * 0.22, DHAKA.black);
    }
  },
};

// ---------- Tihar ----------

function marigoldSprite(D, base, seed) {
  const c = makeCanvas(D, D), g = c.getContext('2d');
  const R = D / 2, r = rng(seed);
  g.translate(R, R);
  g.fillStyle = shade(base, -0.4);
  g.beginPath();
  g.arc(0, 0, R * 0.9, 0, TAU);
  g.fill();
  const rings = [[0.76, 20, 0.22], [0.58, 16, 0.2], [0.4, 12, 0.18], [0.2, 7, 0.16]];
  rings.forEach(([rr, n, ps], ri) => {
    for (let k = 0; k < n; k++) {
      const an = (k / n) * TAU + r() * 0.3 + ri;
      g.fillStyle = shade(base, -0.18 + r() * 0.3 + ri * 0.04);
      g.beginPath();
      g.ellipse(Math.cos(an) * rr * R, Math.sin(an) * rr * R, R * ps, R * ps * 0.7, an, 0, TAU);
      g.fill();
    }
  });
  const lt = g.createRadialGradient(-R * 0.35, -R * 0.4, 0, 0, 0, R);
  lt.addColorStop(0, 'rgba(255,250,220,0.35)');
  lt.addColorStop(0.6, 'rgba(255,255,255,0)');
  lt.addColorStop(1, 'rgba(60,10,0,0.35)');
  g.fillStyle = lt;
  g.beginPath();
  g.arc(0, 0, R * 0.95, 0, TAU);
  g.fill();
  return c;
}

const BULBS = [['255,214,130', '#fff0c8'], ['255,160,70', '#ffd3a0'], ['255,120,90', '#ffc0b0'], ['255,236,180', '#fffaf0']];

const tihar = {
  id: 'tihar',
  name: 'Tihar Lights',
  ne: 'तिहार',
  cat: 'nepali',
  text: (f) => (f.portrait
    ? { title: { y: 0.72, font: 'yatra', color: '#ffd27a', style: 'glow' }, sub: { y: 0.765 } }
    : { title: { y: 0.74, font: 'yatra', color: '#ffd27a', style: 'glow' }, sub: { y: 0.82 } }),
  setup(f) {
    const { w, s } = f;
    const D = Math.max(8, Math.round(s * 0.05));
    const K = f.portrait ? 2 : f.square ? 3 : 4;
    const r = rng(17);
    const bokeh = [];
    for (let i = 0; i < 16; i++) {
      bokeh.push({ x: r(), y: 0.3 + r() * 0.7, r: 0.04 + r() * 0.07, c: Math.floor(r() * 4), ph: r() * TAU });
    }
    const bulbPh = [];
    for (let i = 0; i < 200; i++) bulbPh.push(r() * TAU);
    return {
      D, K,
      flowers: [marigoldSprite(D, '#f27d12', 1), marigoldSprite(D, '#ffb51c', 2), marigoldSprite(D, '#e8600c', 3)],
      glows: BULBS.map((b) => glowSprite(b[0], 64)),
      bokeh, bulbPh,
      sway: 0,
      leafC: (() => {
        const c = makeCanvas(D * 3, D * 3), g = c.getContext('2d');
        leaf(g, D * 1.5, D * 0.3, D * 2.4, D * 0.38, Math.PI / 2 - 0.5);
        leaf(g, D * 1.5, D * 0.3, D * 2.4, D * 0.38, Math.PI / 2 + 0.5);
        leaf(g, D * 1.5, D * 0.3, D * 2.6, D * 0.4, Math.PI / 2);
        return c;
      })(),
      spacing: D * 0.7,
      wOld: w,
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.3 });
    ctx.fillStyle = 'rgba(110,40,0,0.14)';
    ctx.fillRect(0, 0, w, h);
    fadeEdge(ctx, f, 'top', 0.45, 0.55, '#280a00');
    fadeEdge(ctx, f, 'bottom', 0.4, 0.6, '#1e0800');

    // festive glow and soft out-of-focus lights
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of st.bokeh) {
      const r = b.r * s * (1 + a.bass * 0.25);
      ctx.globalAlpha = 0.1 + 0.08 * Math.sin(f.t * 0.8 + b.ph) + a.bass * 0.08;
      const x = (b.x + 0.02 * Math.sin(f.t * 0.1 + b.ph)) * w, y = b.y * h;
      ctx.drawImage(st.glows[b.c], x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    // warm festive glow rising from below
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 + a.energy * 0.18;
    ctx.drawImage(st.glows[1], w * 0.1, h * 0.55, w * 0.8, h * 0.9);
    ctx.restore();

    st.sway = smooth(st.sway, a.kick * 0.5 + a.level * 0.2, f.dt, 4);
    const K = st.K, D = st.D, hy = -s * 0.012;
    const hx = (k) => (k / K) * w;

    // fairy lights: two deeper drapes behind the flowers
    const lights = [];
    for (let k = 0; k < K; k++) {
      lights.push([hx(k), hy, hx(k + 1), hy, s * 0.24]);
    }
    lights.push([-0.02 * w, s * 0.02, 1.02 * w, s * 0.02, s * (f.portrait ? 0.42 : 0.36)]);
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.strokeStyle = 'rgba(30,20,10,0.7)';
    let bi = 0;
    const group = a.beats % 3;
    const bulbs = [];
    for (const [x0, y0, x1, y1, dep] of lights) {
      const mx = (x0 + x1) / 2 + Math.sin(f.t * 0.8 + x0) * s * 0.01, my = y0 + dep * 2 + Math.sin(f.t * 1.1 + x0) * s * 0.008;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx, my, x1, y1);
      ctx.stroke();
      const len = Math.hypot(x1 - x0, dep * 1.6);
      const n = Math.max(4, Math.round(len / (s * 0.045)));
      for (let i = 1; i < n; i++, bi++) {
        const [x, y] = quad(x0, y0, mx, my, x1, y1, i / n);
        let br = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(f.t * 2.2 + st.bulbPh[bi % 200]));
        if (bi % 3 === group) br += a.beat * 0.9;
        br += a.level * 0.15;
        bulbs.push(x, y, clamp(br), bi % 4);
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bulbs.length; i += 4) {
      const br = bulbs[i + 2], g = s * (0.035 + br * 0.045);
      ctx.globalAlpha = 0.3 + br * 0.7;
      ctx.drawImage(st.glows[bulbs[i + 3]], bulbs[i] - g / 2, bulbs[i + 1] - g / 2, g, g);
    }
    ctx.restore();
    const br = Math.max(1, s * 0.0045);
    for (let c = 0; c < 4; c++) {
      ctx.beginPath();
      for (let i = 0; i < bulbs.length; i += 4) {
        if (bulbs[i + 3] !== c) continue;
        ctx.moveTo(bulbs[i] + br, bulbs[i + 1]);
        ctx.arc(bulbs[i], bulbs[i + 1], br, 0, TAU);
      }
      ctx.fillStyle = BULBS[c][1];
      ctx.fill();
    }

    // marigold swags
    const step = st.spacing;
    for (let k = 0; k < K; k++) {
      const x0 = hx(k), x1 = hx(k + 1);
      const dep = s * 0.13 * (1 + a.kick * 0.05);
      const mx = (x0 + x1) / 2 + Math.sin(f.t * 0.9 + k * 1.3) * s * 0.02 * (1 + st.sway * 2);
      const my = hy + dep * 2;
      const len = Math.hypot(x1 - x0, dep * 1.6);
      const n = Math.ceil(len / step);
      const spr = st.flowers[k % 2];
      for (let i = 0; i <= n; i++) {
        const [x, y] = quad(x0, hy, mx, my, x1, hy, i / n);
        const fl = i % 9 === 4 ? st.flowers[2] : spr;
        ctx.drawImage(fl, x - D / 2, y - D / 2, D, D);
      }
    }
    // hanging strands at each joint, swinging on the beat
    for (let k = 0; k <= K; k++) {
      const x0 = hx(k);
      const len = s * (k % 2 ? 0.2 : 0.27);
      const n = Math.ceil(len / step);
      const th = 0.06 * Math.sin(f.t * 1.1 + k * 1.7) + st.sway * 0.12 * (k % 2 ? 1 : -1);
      const spr = st.flowers[(k + 1) % 2];
      let ex = x0, ey = hy;
      for (let i = 0; i <= n; i++) {
        const d = (i / n) * len;
        const an = th * (0.6 + 0.4 * (i / n));
        ex = x0 + Math.sin(an) * d;
        ey = hy + Math.cos(an) * d;
        ctx.drawImage(spr, ex - D / 2, ey - D / 2, D, D);
      }
      // a tassel of leaves at the end
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(-th);
      ctx.drawImage(st.leafC, -D, D * 0.05, D * 2, D * 2);
      ctx.restore();
    }
  },
};

// ---------- Gaun (village terraces) ----------

const FIELDS = ['#7d9b3c', '#a6ae45', '#5f8c33', '#c9ad4c', '#6e9a3a', '#93ab42', '#d4b452', '#5c8a31', '#86a43e', '#b8aa48', '#64903a', '#a8b04a'];

const terraces = {
  id: 'terraces',
  name: 'Gaun',
  ne: 'गाउँ',
  cat: 'nepali',
  text: () => ({ title: { y: 0.13, font: 'baloo' } }),
  setup(f) {
    const { w, h, s } = f;
    const K = f.portrait ? 12 : 10, n = 40;
    const y0 = h * (f.portrait ? 0.55 : 0.56);
    const bands = [];
    for (let k = 0; k < K; k++) {
      const base = y0 + (h * 1.02 - y0) * Math.pow(k / K, 1.3);
      const H = s * (f.portrait ? 0.3 : 0.24) * (1 - 0.7 * (k / K));
      const wd1 = (s * (0.45 + 0.08 * k)) / w, wd2 = (s * (0.32 + 0.06 * k)) / w;
      const ys = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        const g1 = Math.exp(-Math.pow((x - 0.33) / wd1, 2));
        const g2 = Math.exp(-Math.pow((x - 0.86) / wd2, 2));
        ys[i] = base - H * (g1 + 0.6 * g2) + noise1(x * (w / s) * 2.5 + k * 3.1, 2) * s * 0.008;
      }
      const haze = 0.5 * Math.pow(1 - k / (K - 1), 1.5);
      bands.push({ ys, rip: new Float32Array(n), col: mix(FIELDS[k % FIELDS.length], '#c8cfc2', haze), amp: s * 0.045 * (0.4 + k / K) });
    }
    return { bands, K, n, y0 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.04, zoom: 0.06 });
    const sky = ctx.createLinearGradient(0, 0, 0, st.y0);
    sky.addColorStop(0, 'rgba(25,35,70,0.3)');
    sky.addColorStop(1, 'rgba(255,205,145,0.35)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, st.y0 + 1);

    // an occasional small flock crossing the sky
    const ph = (f.t + 2) % 24;
    if (ph < 11) {
      const fx = -0.15 * w + (ph / 11) * w * 1.3;
      const fy = h * (f.portrait ? 0.3 : 0.28) + Math.sin(ph * 0.6) * s * 0.02;
      const bw = s * 0.018;
      ctx.strokeStyle = 'rgba(30,28,35,0.75)';
      ctx.lineWidth = Math.max(1, s * 0.0028);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const x = fx - row * bw * 2.2 + Math.sin(f.t * 1.3 + i) * bw * 0.3;
        const y = fy + side * row * bw * 1.4 + Math.cos(f.t * 1.1 + i * 2) * bw * 0.3;
        const fl = Math.sin(f.t * (7 + a.level * 4) + i * 1.3) * bw * 0.55;
        ctx.moveTo(x - bw, y - fl);
        ctx.quadraticCurveTo(x - bw * 0.4, y - bw * 0.2, x, y);
        ctx.quadraticCurveTo(x + bw * 0.4, y - bw * 0.2, x + bw, y - fl);
      }
      ctx.stroke();
    }

    // haze at the horizon
    const hz = ctx.createLinearGradient(0, st.y0 - s * 0.3, 0, st.y0 + s * 0.05);
    hz.addColorStop(0, 'rgba(255,230,195,0)');
    hz.addColorStop(1, 'rgba(255,230,195,0.4)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, st.y0 - s * 0.3, w, s * 0.35);

    // ripple flows down the hill from the back terrace
    const n = st.n, K = st.K, B = st.bands;
    const m = mirrored(a.bands, n);
    for (let k = K - 1; k > 0; k--) {
      for (let i = 0; i < n; i++) B[k].rip[i] = lerp(B[k].rip[i], B[k - 1].rip[i], 0.3);
    }
    for (let i = 0; i < n; i++) B[0].rip[i] = lerp(B[0].rip[i], m[i] * (1 + a.kick * 0.4), 0.4);

    const gleam = 0.2 + a.beat * 0.35;
    for (let k = 0; k < K; k++) {
      const bd = B[k];
      const pts = [];
      let top = h;
      for (let i = 0; i < n; i++) {
        const y = bd.ys[i] - bd.rip[i] * bd.amp;
        pts.push([(i / (n - 1)) * w, y]);
        if (y < top) top = y;
      }
      const next = k < K - 1 ? B[k + 1].ys[Math.floor(n / 2)] : h;
      const deep = Math.max(s * 0.04, (next - bd.ys[Math.floor(n / 2)]) * 1.6);
      // fill only down to where the next terrace covers it
      let low = h;
      if (k < K - 1) {
        low = 0;
        for (let i = 0; i < n; i++) low = Math.max(low, B[k + 1].ys[i]);
        low = Math.min(h, low + 2);
      }
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w, low);
      ctx.lineTo(0, low);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, top + deep + s * 0.12);
      g.addColorStop(0, shade(bd.col, 0.12));
      g.addColorStop(0.5, bd.col);
      g.addColorStop(1, shade(bd.col, -0.35));
      ctx.fillStyle = g;
      ctx.fill();
      // the earth wall under the field edge
      const wall = Math.max(1.5, s * (0.004 + 0.012 * (k / K)));
      ctx.save();
      ctx.translate(0, wall / 2);
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineWidth = wall;
      ctx.strokeStyle = rgba(mix(shade(bd.col, -0.45), '#5a4426', 0.35), 0.8);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineWidth = Math.max(1, s * (0.0015 + 0.002 * (k / K)));
      ctx.strokeStyle = `rgba(255,238,175,${gleam * (0.5 + k / K)})`;
      ctx.stroke();

      // a little house and trees up on the hill
      const at = (x) => {
        const p = x * (n - 1), j = Math.floor(p), fr = p - j;
        return lerp(pts[j][1], pts[Math.min(n - 1, j + 1)][1], fr);
      };
      if (k === 1) {
        tree(ctx, w * 0.22, at(0.22), s * 0.022);
        tree(ctx, w * 0.43, at(0.43), s * 0.018);
      }
      if (k === 2) house(ctx, w * 0.31, at(0.31), s * 0.034);
      if (k === 3) tree(ctx, w * 0.8, at(0.8), s * 0.02);
    }
  },
};

function tree(ctx, x, y, r) {
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(x - r * 0.08, y - r * 1.2, r * 0.16, r * 1.3);
  ctx.fillStyle = '#2e4a22';
  ctx.beginPath();
  ctx.arc(x, y - r * 1.5, r * 0.75, 0, TAU);
  ctx.arc(x - r * 0.45, y - r * 1.15, r * 0.55, 0, TAU);
  ctx.arc(x + r * 0.45, y - r * 1.15, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,190,90,0.35)';
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 1.75, r * 0.3, 0, TAU);
  ctx.fill();
}

// A two-tone village house: red mud below, white above, dark roof.
function house(ctx, x, y, wd) {
  const hh = wd * 0.7;
  const bx = x - wd / 2, by = y - hh + wd * 0.08;
  ctx.fillStyle = '#a5432a';
  ctx.fillRect(bx, by + hh * 0.5, wd, hh * 0.5);
  ctx.fillStyle = '#efe6d2';
  ctx.fillRect(bx, by, wd, hh * 0.5);
  ctx.fillStyle = '#3d2f28';
  ctx.beginPath();
  ctx.moveTo(bx - wd * 0.12, by);
  ctx.lineTo(bx + wd * 0.18, by - hh * 0.42);
  ctx.lineTo(bx + wd * 0.82, by - hh * 0.42);
  ctx.lineTo(bx + wd * 1.12, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a1e18';
  ctx.fillRect(bx + wd * 0.2, by + hh * 0.12, wd * 0.14, hh * 0.22);
  ctx.fillRect(bx + wd * 0.62, by + hh * 0.12, wd * 0.14, hh * 0.22);
  ctx.fillRect(bx + wd * 0.42, by + hh * 0.55, wd * 0.16, hh * 0.45);
}

export default [himalaya, prayerFlags, laliGurans, diyo, dhaka, tihar, terraces];
