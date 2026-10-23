// Nepali looks: hills, mountains, temples, prayer flags, lali gurans, diyo,
// mandala, madal, sarangi, dhaka and tihar. Made for lok geet, dohori,
// adhunik love songs and bhajans.
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

// Fast rise, slow fall: things jump with a hit and settle gently.
const follow = (cur, target, up = 0.55, down = 0.16) => lerp(cur, target, target > cur ? up : down);

// Spectrum shaped for a bottom wave: bass in the middle, quiet at both ends.
function waveShape(f, out, phase = 0) {
  const n = out.length;
  const m = mirrored(f.a.bands, n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const flow = 0.8 + 0.2 * Math.sin(i * 0.5 - f.t * 2.4 + phase);
    out[i] = clamp(m[i] * flow) * Math.pow(Math.sin(Math.PI * x), 0.9);
  }
  return out;
}

function wavePts(arr, w, y, amp) {
  const n = arr.length, pts = [];
  for (let i = 0; i < n; i++) pts.push([(i / (n - 1)) * w, y - arr[i] * amp]);
  return pts;
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
      const low = li < st.layers.length - 1 ? st.layers[li + 1].base * h + 2 : h * (f.portrait ? 0.9 : 0.97) - s * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, low);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(w, low);
      ctx.closePath();
      // rock darkens downward, then mist gathers at the foot
      const fill = ctx.createLinearGradient(0, top, 0, by);
      fill.addColorStop(0, L.col);
      fill.addColorStop(0.55, shade(L.col, -0.25));
      fill.addColorStop(1, mix(L.col, '#d9deea', 0.45));
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
      const foot = low;
      for (const [pi, lv, rv] of L.peaks) {
        const side = pts[pi][0] < sx ? -1 : 1;
        const v = side < 0 ? lv : rv;
        ctx.moveTo(pts[pi][0], pts[pi][1]);
        for (let i = pi; i !== v; i += side) ctx.lineTo(pts[i + side][0], pts[i + side][1]);
        ctx.lineTo(pts[v][0], foot);
        ctx.lineTo(pts[pi][0] - side * Math.abs(pts[v][0] - pts[pi][0]) * 0.35, foot);
        ctx.closePath();
      }
      const shadow = ctx.createLinearGradient(0, top, 0, by);
      shadow.addColorStop(0, 'rgba(20,28,58,0.28)');
      shadow.addColorStop(1, 'rgba(20,28,58,0)');
      ctx.fillStyle = shadow;
      ctx.fill();
    }

    // front ridge: the sound itself
    const fn = st.fn, fb = h * (f.portrait ? 0.9 : 0.97), fk = f.portrait ? 1.3 : 1;
    const fp = [];
    for (let i = 0; i < fn; i++) {
      const x = i / (fn - 1);
      const v = fromCentre(st.front, x, 0.42, 2) * (0.85 + 0.15 * Math.sin(i * 0.6 - f.t * 2));
      fp.push([x * w, fb - s * fk * (0.06 + 0.06 * st.frontProf[i] + 0.2 * v * (1 + a.kick * 0.18))]);
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
    ? { title: { y: 0.7, font: 'baloo' }, sub: { y: 0.745 } }
    : { title: { y: 0.66, font: 'baloo' }, sub: { y: 0.74 } }),
  setup(f) {
    const { w, h, s } = f;
    const r = rng(5);
    // two strings that never cross: a small one far away, a big one in front
    const defs = f.portrait ? [
      { x0: -0.05 * w, y0: 0.05 * h, x1: 1.05 * w, y1: 0.08 * h, cy: 0.22 * h, size: 0.8, dark: 0.25 },
      { x0: -0.05 * w, y0: 0.19 * h, x1: 1.05 * w, y1: 0.17 * h, cy: 0.38 * h, size: 1, dark: 0 },
    ] : [
      { x0: -0.05 * w, y0: 0.04 * h, x1: 1.05 * w, y1: 0.1 * h, cy: 0.24 * h, size: 0.75, dark: 0.25 },
      { x0: -0.05 * w, y0: 0.21 * h, x1: 1.05 * w, y1: 0.16 * h, cy: 0.5 * h, size: 1, dark: 0 },
    ];
    const strings = defs.map((d, j) => {
      const fw = s * (f.portrait ? 0.095 : 0.075) * d.size, gap = fw * 0.5;
      const len = w * 1.12;
      const count = Math.max(5, Math.floor(len / (fw + gap)));
      const dt = fw / len;
      const flags = [];
      let ci = j * 2;
      for (let i = 0; i < count; i++) {
        const t0 = (i + 0.5) / count - dt / 2;
        const fh = fw * (1.15 + r() * 0.12);
        // keep every flag inside the frame, even when the wind lifts it
        const A = quad(d.x0, d.y0, (d.x0 + d.x1) / 2, d.cy, d.x1, d.y1, t0);
        const B = quad(d.x0, d.y0, (d.x0 + d.x1) / 2, d.cy, d.x1, d.y1, t0 + dt);
        if (A[0] < w * 0.015 || B[0] + fh * 0.95 > w * 0.985) continue;
        flags.push({ t0, t1: t0 + dt, ph: r() * TAU, col: shade(FLAG_COLORS[ci % 5], -d.dark), white: ci % 5 === 1, fh });
        ci++;
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
    return { strings, ink, wind: 0.3, gustT: -10, tmp: new Float32Array(48), threads: FLAG_COLORS.map(() => new Float32Array(48)) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.08 });
    fadeEdge(ctx, f, 'top', 0.45, 0.32);
    fadeEdge(ctx, f, 'bottom', 0.45, 0.72);

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

    // five threads in the flag colours: one soft wave at the bottom.
    // The top thread follows the music fastest, each one below lags a little more.
    waveShape(f, st.tmp);
    const by = h * 0.92, amp = s * (f.portrait ? 0.12 : 0.1) * (1 + a.kick * 0.1), gap = s * 0.007;
    const lw = Math.max(1, s * 0.0028);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let j = st.threads.length - 1; j >= 0; j--) {
      const arr = st.threads[j], up = 0.5 / (1 + j * 0.6);
      for (let i = 0; i < arr.length; i++) arr[i] = follow(arr[i], st.tmp[i], up, up * 0.35);
      const pts = wavePts(arr, w, by + (j - 2) * gap, amp);
      const col = j === 0 ? '#4b8fe2' : FLAG_COLORS[j];
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.strokeStyle = rgba(col, 0.18);
      ctx.lineWidth = lw * 3.5;
      ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.92);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
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
    ? { title: { y: 0.7, font: 'yatra', color: '#ffd27a', style: 'glow' }, sub: { y: 0.745 } }
    : { title: { y: 0.64, font: 'yatra', color: '#ffd27a', style: 'glow' }, sub: { y: 0.72 } }),
  setup(f) {
    const { s } = f;
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
      wave: new Float32Array(56), echo: new Float32Array(56), tmp: new Float32Array(56),
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
    // garlands hang from points inside the frame, so no flower is cut in half
    const K = st.K, D = st.D, hy = D * 0.6, mx0 = D * 0.75;
    const hx = (k) => mx0 + (k / K) * (w - mx0 * 2);

    // fairy lights: two deeper drapes behind the flowers
    const lights = [];
    for (let k = 0; k < K; k++) {
      lights.push([hx(k), hy, hx(k + 1), hy, s * 0.24]);
    }
    lights.push([hx(0), hy + s * 0.02, hx(K), hy + s * 0.02, s * (f.portrait ? 0.42 : 0.33)]);
    if (f.portrait) lights.push([hx(0), s * 0.3, hx(K), s * 0.3, s * 0.5]);
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

    // a string of lights along the bottom that rides the music
    waveShape(f, st.tmp);
    const n = st.wave.length;
    for (let i = 0; i < n; i++) {
      st.wave[i] = follow(st.wave[i], st.tmp[i]);
      st.echo[i] = lerp(st.echo[i], st.wave[i], 0.07);
    }
    const by = h * 0.94, amp = s * (f.portrait ? 0.13 : 0.11) * (1 + a.kick * 0.1);
    const pts = wavePts(st.wave, w, by, amp), ech = wavePts(st.echo, w, by, amp * 1.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    smoothLine(ctx, pts);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const wg = ctx.createLinearGradient(0, by - amp, 0, h);
    wg.addColorStop(0, `rgba(255,150,40,${0.2 + a.beat * 0.12})`);
    wg.addColorStop(1, 'rgba(255,120,30,0.02)');
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    smoothLine(ctx, ech);
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = 'rgba(255,200,120,0.35)';
    ctx.stroke();
    glowLine(ctx, pts, 'rgba(255,170,60,1)', 'rgba(255,236,190,0.95)', Math.max(1.2, s * 0.0035));
    const nb = Math.max(9, Math.round(w / (s * 0.06)));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < nb; i++) {
      const u = i / nb, p = u * (n - 1), j = Math.floor(p);
      const v = lerp(st.wave[j], st.wave[Math.min(n - 1, j + 1)], p - j);
      const g = s * (0.03 + v * 0.05 + (i % 3 === a.beats % 3 ? a.beat * 0.025 : 0));
      ctx.globalAlpha = 0.45 + v * 0.55;
      ctx.drawImage(st.glows[i % 4], u * w - g / 2, by - v * amp - g / 2, g, g);
    }
    ctx.restore();
  },
};

// ---------- Pahad (misty hills) ----------

const pahad = {
  id: 'pahad',
  name: 'Pahad',
  ne: 'पहाड',
  cat: 'nepali',
  text: (f) => ({
    title: { y: f.portrait ? 0.14 : 0.13, font: 'kalam', size: 0.08 },
    sub: { y: f.portrait ? 0.185 : 0.215 },
  }),
  setup(f) {
    const P = f.portrait;
    // back to front: the far hills take the high notes and move slowly,
    // the near hill takes the bass and moves fast
    const defs = [
      { base: P ? 0.66 : 0.66, hill: 0.22, mus: 0.06, lo: 0.5, hi: 0.9, up: 0.1, down: 0.035, drift: 0.006, roll: 2.2, alpha: 0.82 },
      { base: P ? 0.74 : 0.75, hill: 0.17, mus: 0.07, lo: 0.28, hi: 0.55, up: 0.2, down: 0.06, drift: 0.01, roll: 2.6, alpha: 0.94 },
      { base: P ? 0.83 : 0.85, hill: 0.13, mus: 0.08, lo: 0.1, hi: 0.32, up: 0.35, down: 0.1, drift: 0.016, roll: 3, alpha: 0.97 },
      { base: P ? 0.93 : 0.96, hill: 0.09, mus: 0.11, lo: 0, hi: 0.15, up: 0.6, down: 0.15, drift: 0.025, roll: 3.4, alpha: 1 },
    ];
    const layers = defs.map((d, k) => ({ ...d, seed: k * 7 + 3, v: new Float32Array(24) }));
    const r = rng(41);
    const birds = [];
    for (let i = 0; i < 5; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      birds.push({ dx: -row * (1.6 + r() * 0.8), dy: side * row * (0.9 + r() * 0.5), ph: r() * TAU, sz: 0.8 + r() * 0.35 });
    }
    return { layers, n: 64, birds };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.05, zoom: 0.07 });
    // dusk grade: cool sky above, warm light near the hills
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgba(14,18,46,0.55)');
    sky.addColorStop(0.35, 'rgba(60,46,96,0.22)');
    sky.addColorStop(0.6, 'rgba(255,170,130,0.28)');
    sky.addColorStop(1, 'rgba(40,30,60,0.3)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const back = st.layers[0];
    const lx = w * 0.5, ly = h * back.base - s * 0.12;
    const lr = s * (0.7 + a.bass * 0.15);
    const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    light.addColorStop(0, `rgba(255,214,170,${0.32 + a.beat * 0.1})`);
    light.addColorStop(1, 'rgba(255,190,150,0)');
    ctx.fillStyle = light;
    // the hills cover what is below, so light only the sky
    const ly0 = Math.max(0, ly - lr);
    ctx.fillRect(0, ly0, w, back.base * h - ly0);

    // a few birds glide across now and then
    const ph = (f.t + 3) % 18;
    if (ph < 10) {
      const fx = -0.1 * w + (ph / 10) * w * 1.25;
      const fy = h * (f.portrait ? 0.34 : 0.3) + Math.sin(ph * 0.5) * s * 0.015;
      const fade = clamp(Math.min(ph, 10 - ph) * 1.5);
      const bw = s * 0.011;
      ctx.strokeStyle = `rgba(22,20,38,${0.65 * fade})`;
      ctx.lineWidth = Math.max(1, s * 0.0022);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const b of st.birds) {
        const x = fx + b.dx * bw * 2 + Math.sin(f.t * 0.9 + b.ph) * bw * 0.4;
        const y = fy + b.dy * bw * 2 + Math.cos(f.t * 0.7 + b.ph) * bw * 0.4;
        const z = bw * b.sz, fl = Math.sin(f.t * 4.5 + b.ph) * z * 0.5;
        ctx.moveTo(x - z, y - fl);
        ctx.quadraticCurveTo(x - z * 0.4, y - z * 0.25, x, y);
        ctx.quadraticCurveTo(x + z * 0.4, y - z * 0.25, x + z, y - fl);
      }
      ctx.stroke();
    }

    const n = st.n, aspect = w / s;
    const haze = mix(f.photo.palette.light || '#e8d6e6', '#c99aa8', 0.7);
    const navy = '#121428';
    const rim = mix(f.color.accent, '#ffd8a8', 0.45);
    for (let k = 0; k < st.layers.length; k++) {
      const L = st.layers[k];
      const i0 = Math.floor(L.lo * 64), i1 = Math.max(i0 + 2, Math.ceil(L.hi * 64));
      const m = mirrored(f.a.bands.subarray(i0, i1), L.v.length);
      const lift = 1 + (k === 3 ? a.kick * 0.25 : 0);
      for (let i = 0; i < L.v.length; i++) L.v[i] = follow(L.v[i], m[i] * lift, L.up, L.down);
      const by = L.base * h;
      const off = f.t * L.drift;
      const pts = [];
      let top = h;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1), u = x * aspect;
        const nz = 0.6 * noise1(u * L.roll + off * L.roll, L.seed) + 0.3 * noise1(u * L.roll * 2.3 + off * 2, L.seed + 1) + 0.1 * noise1(u * L.roll * 5.1, L.seed + 2);
        const prof = clamp(0.5 + 0.7 * nz);
        const p = x * (L.v.length - 1), j = Math.floor(p);
        const v = lerp(L.v[j], L.v[Math.min(L.v.length - 1, j + 1)], p - j);
        const flow = 0.75 + 0.25 * Math.sin(x * TAU * 1.3 - f.t * (0.5 + k * 0.35) + L.seed);
        const y = by - s * (L.hill * prof + L.mus * v * flow);
        pts.push([x * w, y]);
        if (y < top) top = y;
      }
      // fill only down to where the next hill is sure to cover it
      const low = k < st.layers.length - 1 ? st.layers[k + 1].base * h + 2 : h;
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w, low);
      ctx.lineTo(0, low);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, by + s * 0.1);
      // far hills fade into the haze, near ones are almost night
      const col = mix(haze, navy, 0.42 + 0.58 * Math.pow(k / 3, 1.1));
      g.addColorStop(0, rgba(col, L.alpha));
      g.addColorStop(1, rgba(mix(col, haze, k < 3 ? 0.3 : 0.08), L.alpha));
      ctx.fillStyle = g;
      ctx.fill();
      // light catching the ridge
      if (k < 3) {
        ctx.beginPath();
        smoothLine(ctx, pts);
        ctx.lineWidth = Math.max(1, s * 0.002);
        ctx.strokeStyle = rgba(rim, 0.18 + k * 0.08 + a.beat * 0.08);
        ctx.stroke();
        // mist gathers at the foot of each hill
        const my = by + s * 0.02;
        const mg = ctx.createLinearGradient(0, my - s * 0.09, 0, my + s * 0.05);
        mg.addColorStop(0, rgba(haze, 0));
        mg.addColorStop(0.7, rgba(haze, 0.2 - k * 0.04));
        mg.addColorStop(1, rgba(haze, 0));
        ctx.fillStyle = mg;
        ctx.fillRect(0, my - s * 0.09, w, s * 0.14);
      } else {
        glowLine(ctx, pts, rgba(rim, 0.9), rgba(shade(rim, 0.5), 0.75 + a.beat * 0.25), Math.max(1.2, s * 0.0035 * (1 + a.beat * 0.25)));
      }
    }
  },
};

// ---------- Kathmandu (temple skyline) ----------

// A tiered pagoda roof: upturned eaves and a slope that sweeps inward.
function roof(g, x, y, rw, rh) {
  const tip = rh * 0.18;
  g.beginPath();
  g.moveTo(x - rw / 2, y - tip);
  g.quadraticCurveTo(x - rw * 0.45, y, x - rw * 0.36, y);
  g.lineTo(x + rw * 0.36, y);
  g.quadraticCurveTo(x + rw * 0.45, y, x + rw / 2, y - tip);
  g.quadraticCurveTo(x + rw * 0.27, y - rh * 0.32, x + rw * 0.15, y - rh);
  g.lineTo(x - rw * 0.15, y - rh);
  g.quadraticCurveTo(x - rw * 0.27, y - rh * 0.32, x - rw / 2, y - tip);
  g.closePath();
  g.fill();
}

function pagoda(g, x, by, W, tiers) {
  let y = by;
  for (let k = 0; k < 3; k++) {
    const pw = W * (0.98 - k * 0.12), ph = W * 0.07;
    g.fillRect(x - pw / 2, y - ph, pw, ph + 0.5);
    y -= ph;
  }
  let bw = W * 0.5, bh = W * 0.3, rw = W * 1.02;
  for (let k = 0; k < tiers; k++) {
    g.fillRect(x - bw / 2, y - bh, bw, bh + 0.5);
    y -= bh;
    const rh = rw * 0.24;
    roof(g, x, y + rh * 0.1, rw, rh);
    y -= rh * 0.9;
    bw *= 0.8;
    bh = bw * 0.46;
    rw *= 0.78;
  }
  // gajur: the gilded finial
  g.beginPath();
  g.ellipse(x, y - W * 0.03, W * 0.034, W * 0.03, 0, 0, TAU);
  g.ellipse(x, y - W * 0.09, W * 0.022, W * 0.012, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x - W * 0.016, y - W * 0.05);
  g.lineTo(x, y - W * 0.21);
  g.lineTo(x + W * 0.016, y - W * 0.05);
  g.closePath();
  g.fill();
}

function stupa(g, x, by, W, body) {
  let y = by;
  for (let k = 0; k < 3; k++) {
    const pw = W * (1 - k * 0.1), ph = W * 0.045;
    g.fillRect(x - pw / 2, y - ph, pw, ph + 0.5);
    y -= ph;
  }
  const base = y;
  const dr = W * 0.36, dh = W * 0.3;
  g.beginPath();
  g.ellipse(x, y + 0.5, dr, dh, 0, Math.PI, TAU);
  g.closePath();
  g.fill();
  y -= dh * 0.97;
  g.fillRect(x - W * 0.085, y - W * 0.09, W * 0.17, W * 0.09 + 0.5);
  y -= W * 0.09;
  g.fillRect(x - W * 0.105, y - W * 0.025, W * 0.21, W * 0.025 + 0.5);
  y -= W * 0.025;
  // thirteen steps of the spire
  const n = 13, step = (W * 0.36) / n;
  const spireTop = y - W * 0.36;
  for (let k = 0; k < n; k++) {
    const rw = lerp(W * 0.15, W * 0.05, k / (n - 1));
    g.fillRect(x - rw / 2, y - step * 0.7, rw, step * 0.7 + 0.5);
    g.fillRect(x - rw * 0.38, y - step - 0.5, rw * 0.76, step + 1);
    y -= step;
  }
  g.beginPath();
  g.moveTo(x - W * 0.085, y + W * 0.012);
  g.quadraticCurveTo(x, y - W * 0.06, x + W * 0.085, y + W * 0.012);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(x - W * 0.014, y - W * 0.02);
  g.lineTo(x, y - W * 0.13);
  g.lineTo(x + W * 0.014, y - W * 0.02);
  g.closePath();
  g.fill();
  // prayer flag lines from the spire down to the ground
  const keep = g.fillStyle;
  g.lineWidth = Math.max(1, W * 0.006);
  g.strokeStyle = keep;
  for (const side of [-1, 1]) {
    const x0 = x, y0 = spireTop + W * 0.06, x2 = x + side * W * 1.05, y2 = base + W * 0.02;
    const x1 = x + side * W * 0.55, y1 = lerp(y0, y2, 0.75);
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x1, y1, x2, y2);
    g.stroke();
    const cnt = 14;
    for (let i = 2; i < cnt; i++) {
      const [fx, fy] = quad(x0, y0, x1, y1, x2, y2, i / cnt);
      if (body) g.fillStyle = shade(FLAG_COLORS[i % 5], -0.6);
      g.fillRect(fx - W * 0.014, fy, W * 0.028, W * 0.034);
    }
    g.fillStyle = keep;
  }
}

// Houses along the ground, then the temples. Drawn once per pass: the white
// mask (for the rim light) and the dark silhouette with a few lit windows.
function skylineArt(g, Wpx, Hpx, s, items, seed, houseK, body) {
  const r = rng(seed), rw = rng(seed + 99);
  let x = -s * 0.01;
  while (x < Wpx) {
    const ww = s * (0.035 + r() * 0.05), hh = s * (0.045 + r() * 0.06) * houseK;
    g.fillRect(x, Hpx - hh, ww + 1, hh + 1);
    g.fillRect(x - ww * 0.05, Hpx - hh - s * 0.004, ww * 1.1, s * 0.006);
    if (body && rw() < 0.5) {
      const keep = g.fillStyle;
      g.fillStyle = 'rgba(255,184,100,0.8)';
      const cnt = 1 + Math.floor(rw() * 2);
      for (let k = 0; k < cnt; k++) {
        g.fillRect(x + ww * (0.2 + rw() * 0.55), Hpx - hh * (0.3 + rw() * 0.5), s * 0.006, s * 0.008);
      }
      g.fillStyle = keep;
    }
    x += ww;
  }
  for (const it of items) {
    if (it.t === 'stupa') stupa(g, it.x * Wpx, Hpx, it.W * s, body);
    else pagoda(g, it.x * Wpx, Hpx, it.W * s, it.tiers);
  }
}

function buildSkyline(Wpx, Hpx, s, items, seed, houseK, color) {
  const mask = makeCanvas(Wpx, Hpx), mg = mask.getContext('2d');
  mg.fillStyle = '#ffffff';
  skylineArt(mg, Wpx, Hpx, s, items, seed, houseK, false);
  const body = makeCanvas(Wpx, Hpx), bg = body.getContext('2d');
  const grad = bg.createLinearGradient(0, Hpx * 0.3, 0, Hpx);
  grad.addColorStop(0, color[0]);
  grad.addColorStop(1, color[1]);
  bg.fillStyle = grad;
  skylineArt(bg, Wpx, Hpx, s, items, seed, houseK, true);
  return { mask, body };
}

function tintCanvas(dst, src, col) {
  const g = dst.getContext('2d');
  g.clearRect(0, 0, dst.width, dst.height);
  g.globalCompositeOperation = 'source-over';
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col;
  g.fillRect(0, 0, dst.width, dst.height);
  g.globalCompositeOperation = 'source-over';
}

const kathmandu = {
  id: 'kathmandu',
  name: 'Kathmandu',
  ne: 'काठमाडौं',
  cat: 'nepali',
  text: (f) => ({
    title: { y: f.portrait ? 0.14 : 0.13, font: 'rozha', size: 0.08 },
    sub: { y: f.portrait ? 0.185 : 0.215 },
  }),
  setup(f) {
    const { w, s } = f;
    const narrow = w / s < 1.3;
    const front = narrow
      ? [{ t: 'stupa', x: 0.3, W: 0.34 }, { t: 'pagoda', x: 0.75, W: 0.22, tiers: 4 }]
      : [{ t: 'pagoda', x: 0.12, W: 0.14, tiers: 3 }, { t: 'stupa', x: 0.36, W: 0.28 }, { t: 'pagoda', x: 0.62, W: 0.17, tiers: 5 }, { t: 'pagoda', x: 0.87, W: 0.14, tiers: 2 }];
    const backItems = narrow
      ? [{ t: 'pagoda', x: 0.08, W: 0.1, tiers: 3 }, { t: 'pagoda', x: 0.55, W: 0.09, tiers: 2 }, { t: 'pagoda', x: 0.95, W: 0.1, tiers: 3 }]
      : [{ t: 'pagoda', x: 0.03, W: 0.09, tiers: 3 }, { t: 'pagoda', x: 0.25, W: 0.08, tiers: 2 }, { t: 'pagoda', x: 0.49, W: 0.1, tiers: 4 }, { t: 'pagoda', x: 0.75, W: 0.08, tiers: 3 }, { t: 'stupa', x: 0.97, W: 0.14 }];
    const H = Math.ceil(s * 0.48), W = Math.ceil(w);
    const fr = buildSkyline(W, H, s, front, 31, 1, ['#1a1530', '#06050b']);
    const bk = buildSkyline(W, H, s, backItems, 57, 1.25, ['#3a3360', '#2a2448']);
    // the rim: what is left of the mask after shifting it down and sideways
    const d = Math.max(1.5, s * 0.004);
    const rim = makeCanvas(W, H), rg = rim.getContext('2d');
    rg.drawImage(fr.mask, 0, 0);
    rg.globalCompositeOperation = 'destination-out';
    rg.drawImage(fr.mask, 0, d);
    rg.drawImage(fr.mask, d * 0.7, d * 0.7);
    rg.drawImage(fr.mask, -d * 0.7, d * 0.7);
    return {
      H, body: fr.body, back: bk.body, rim,
      rimT: makeCanvas(W, H), glowT: makeCanvas(W, H), rimFor: '',
      v: new Float32Array(64), echo: new Float32Array(64), tmp: new Float32Array(64),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const acc = f.color.accent;
    if (st.rimFor !== acc) {
      st.rimFor = acc;
      const col = mix(acc, '#ffe2b8', 0.3);
      tintCanvas(st.rimT, st.rim, col);
      const g = st.glowT.getContext('2d');
      g.clearRect(0, 0, st.glowT.width, st.glowT.height);
      g.save();
      g.shadowColor = col;
      g.shadowBlur = s * 0.03;
      g.drawImage(st.rimT, 0, 0);
      g.drawImage(st.rimT, 0, 0);
      g.restore();
    }
    photoBackground(ctx, f, { dim: 0.1, zoom: 0.06 });
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgba(18,16,52,0.6)');
    sky.addColorStop(0.45, 'rgba(90,50,100,0.3)');
    sky.addColorStop(0.8, 'rgba(255,140,90,0.35)');
    sky.addColorStop(1, 'rgba(255,120,70,0.3)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // the glowing wave rises behind the skyline
    waveShape(f, st.tmp);
    const n = st.v.length;
    for (let i = 0; i < n; i++) {
      st.v[i] = follow(st.v[i], st.tmp[i] * (1 + a.kick * 0.15));
      st.echo[i] = lerp(st.echo[i], st.v[i], 0.06);
    }
    const by = h - s * 0.1, amp = s * (f.portrait ? 0.42 : 0.34);
    const pts = wavePts(st.v, w, by, amp), ech = wavePts(st.echo, w, by, amp * 1.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    smoothLine(ctx, pts);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const wg = ctx.createLinearGradient(0, by - amp, 0, by);
    wg.addColorStop(0, rgba(acc, 0.36 + a.beat * 0.14));
    wg.addColorStop(1, rgba(acc, 0.06));
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    smoothLine(ctx, ech);
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = rgba(shade(acc, 0.4), 0.35);
    ctx.stroke();
    glowLine(ctx, pts, rgba(acc, 1), 'rgba(255,244,228,0.95)', Math.max(1.2, s * 0.004));

    // far temples in the haze, then the near skyline with its rim light
    const top = h - st.H;
    ctx.globalAlpha = 0.78;
    ctx.drawImage(st.back, 0, top);
    ctx.globalAlpha = 1;
    const hz = ctx.createLinearGradient(0, h - s * 0.2, 0, h);
    hz.addColorStop(0, 'rgba(255,190,150,0)');
    hz.addColorStop(1, 'rgba(255,190,150,0.22)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, h - s * 0.2, w, s * 0.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(0.35 + a.bass * 0.25 + a.beat * 0.3);
    ctx.drawImage(st.glowT, 0, top);
    ctx.restore();
    ctx.drawImage(st.body, 0, top);
    ctx.globalAlpha = clamp(0.7 + a.beat * 0.3);
    ctx.drawImage(st.rimT, 0, top);
    ctx.globalAlpha = 1;
  },
};

// ---------- Sarangi (plucked strings) ----------

const sarangi = {
  id: 'sarangi',
  name: 'Sarangi',
  ne: 'सारङ्गी',
  cat: 'nepali',
  text: (f) => ({
    title: { y: f.portrait ? 0.15 : 0.14, font: 'martel', color: '#f6dca0' },
    sub: { y: f.portrait ? 0.195 : 0.225, color: '#f3e6cc' },
  }),
  setup() {
    const N = 5, r = rng(29);
    const strings = [];
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1); // 0 = top string (high notes), 1 = bottom (bass)
      const lo = (1 - k) * 0.55;
      strings.push({ k, lo, hi: lo + 0.16, prev: 0, hum: 0, e: 0, ph: r() * TAU, ph2: r() * TAU, fr: 2 + (1 - k) * 1.3 + r() * 0.3 });
    }
    return { strings, N };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { dim: 0.12, zoom: 0.06 });
    ctx.fillStyle = 'rgba(80,38,8,0.26)';
    ctx.fillRect(0, 0, w, h);
    fadeEdge(ctx, f, 'bottom', 0.6, 0.82, '#120802');
    vignette(ctx, f, 0.5);

    const P = f.portrait;
    const y0 = h * (P ? 0.68 : 0.64), y1 = h * (P ? 0.85 : 0.86);
    const x0 = w * 0.03, x1 = w * 0.97, L = x1 - x0;
    const my = (y0 + y1) / 2;

    // warm lamp light behind the strings
    ctx.save();
    ctx.translate(w / 2, my);
    ctx.scale(1, (s * 0.32) / (w * 0.55));
    const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
    lg.addColorStop(0, `rgba(255,180,90,${0.16 + a.level * 0.12 + a.beat * 0.06})`);
    lg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-w * 0.55, -w * 0.55, w * 1.1, w * 1.1);
    ctx.restore();

    // pluck: a new note on a string's own band, and each beat picks a string
    const pick = a.beatHit ? a.beats % st.N : -1;
    for (let i = 0; i < st.N; i++) {
      const S = st.strings[i];
      const lv = band(f, S.lo, S.hi);
      const rise = lv - S.prev;
      S.prev = lv;
      if (rise > 0.025) S.e += rise * 4;
      if (a.beatHit && S.k > 0.7) S.e += 0.25 + a.bass * 0.25;
      if (i === pick) S.e += 0.4;
      S.e = Math.min(1.2, S.e * Math.exp(-f.dt * 2.2));
      S.hum = follow(S.hum, lv, 0.4, 0.08);
      S.ph += f.dt * TAU * S.fr;
      S.ph2 += f.dt * TAU * S.fr * 2.02;
    }

    const n = 44;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < st.N; i++) {
      const S = st.strings[i];
      const y = lerp(y0, y1, S.k);
      const A = s * (0.003 + 0.045 * S.e + 0.012 * S.hum) * (P ? 1.15 : 1);
      const c1 = Math.cos(S.ph), c2 = Math.cos(S.ph2) * 0.3;
      const pts = [], up = [], dn = [];
      for (let j = 0; j < n; j++) {
        const u = j / (n - 1), x = x0 + u * L;
        const m1 = Math.sin(Math.PI * u), m2 = Math.sin(TAU * u);
        pts.push([x, y + A * (m1 * c1 + m2 * c2)]);
        const env = A * (m1 + 0.3 * Math.abs(m2));
        up.push([x, y - env]);
        dn.push([x, y + env]);
      }
      // the blur a vibrating string leaves in the eye
      ctx.beginPath();
      smoothLine(ctx, up);
      smoothLine(ctx, dn.reverse(), false);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,205,120,${0.03 + S.e * 0.06})`;
      ctx.fill();

      const lw = Math.max(1.2, s * (0.0032 + 0.0026 * S.k));
      const sg = ctx.createLinearGradient(x0, 0, x1, 0);
      const hi = mix(mix('#ffe2a0', f.color.accent, 0.25), '#fff8e8', clamp(S.e));
      // the ends fade out softly instead of stopping hard
      sg.addColorStop(0, 'rgba(154,106,44,0)');
      sg.addColorStop(0.08, '#e0ad62');
      sg.addColorStop(0.5, hi);
      sg.addColorStop(0.92, '#e0ad62');
      sg.addColorStop(1, 'rgba(154,106,44,0)');
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + S.e * 0.35;
      ctx.strokeStyle = sg;
      ctx.lineWidth = lw * 5;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = sg;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  },
};

// ---------- Mandala ----------

// A pointed lotus petal outline from radius r0 to r1 around angle an.
function lotusPetal(g, r0, r1, an, hw) {
  const L = polar(r0, an - hw), Rt = polar(r0, an + hw), tip = polar(r1, an);
  const c1 = polar(r0 + (r1 - r0) * 0.8, an - hw * 1.05), c2 = polar(r0 + (r1 - r0) * 0.8, an + hw * 1.05);
  g.beginPath();
  g.moveTo(L[0], L[1]);
  g.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]);
  g.quadraticCurveTo(c2[0], c2[1], Rt[0], Rt[1]);
  g.stroke();
}

// Two fine line layers drawn once: an inner rosette of linked circles and an
// outer lotus. They turn in opposite directions.
function mandalaLayers(R) {
  const size = Math.ceil(R * 2.1 + 4);
  const lw = Math.max(1, R * 0.0055);
  const make = () => {
    const c = makeCanvas(size, size), g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.strokeStyle = GOLD;
    g.fillStyle = GOLD;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return [c, g];
  };
  const [inner, gi] = make();
  ring(gi, R * 0.585);
  gi.globalAlpha = 0.75;
  ring(gi, R * 0.605);
  for (let k = 0; k < 16; k++) {
    const [x, y] = polar(R * 0.705, (k / 16) * TAU);
    gi.beginPath();
    gi.arc(x, y, R * 0.1, 0, TAU);
    gi.stroke();
  }
  gi.globalAlpha = 1;
  dots(gi, 16, R * 0.705, R * 0.009, TAU / 32);
  ring(gi, R * 0.81);

  const [outer, go] = make();
  ring(go, R * 0.835);
  for (let k = 0; k < 12; k++) {
    const an = (k / 12) * TAU;
    lotusPetal(go, R * 0.835, R, an, TAU / 24 * 0.95);
    go.globalAlpha = 0.6;
    lotusPetal(go, R * 0.835, R * 0.93, an, TAU / 24 * 0.55);
    go.globalAlpha = 0.85;
    lotusPetal(go, R * 0.835, R * 0.9, an + TAU / 24, TAU / 24 * 0.5);
    go.globalAlpha = 1;
  }
  dots(go, 12, R * 1.025, R * 0.008);
  return { inner, outer, size };
}

const mandala = {
  id: 'mandala',
  name: 'Mandala',
  ne: 'मण्डल',
  cat: 'nepali',
  text: (f) => (f.portrait
    ? { title: { y: 0.7, font: 'yatra', color: '#ffd98a', style: 'glow' }, sub: { y: 0.745, color: '#f6e7c8' } }
    : { title: { y: 0.855, font: 'yatra', color: '#ffd98a', style: 'glow', size: 0.068 }, sub: { y: 0.93, color: '#f6e7c8', size: 0.034 } }),
  setup(f) {
    const pr = f.s * (f.portrait ? 0.18 : 0.145);
    const R = pr / 0.56;
    const n = f.portrait ? 100 : 120;
    return { pr, R, man: mandalaLayers(R), n, bars: new Float32Array(n), spin: 0 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.45, zoom: 0.08 });

    const cx = w / 2, cy = h * (f.portrait ? 0.4 : 0.41);
    const R = st.R, pr = st.pr;
    // one fill: gold glow round the mandala, a deep red wash, dark corners
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    const t1 = clamp((R * (1.5 + a.bass * 0.4) - pr) / (far - pr), 0.05, 0.85);
    const bg = ctx.createRadialGradient(cx, cy, pr, cx, cy, far);
    bg.addColorStop(0, `rgba(255,180,80,${0.3 + a.beat * 0.15})`);
    bg.addColorStop(t1, 'rgba(52,10,26,0.4)');
    bg.addColorStop(1, 'rgba(22,4,12,0.82)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // the spectrum ring, bass at the top
    const n = st.n, m = mirrored(a.bands, n);
    const r0 = R * 1.07;
    const lw = Math.max(1.2, ((TAU * r0) / n) * 0.34);
    const sg = ctx.createRadialGradient(cx, cy, r0, cx, cy, r0 + s * 0.075);
    sg.addColorStop(0, GOLD);
    sg.addColorStop(1, SAFFRON);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      st.bars[i] = follow(st.bars[i], m[i] * (1 + a.kick * 0.12), 0.6, 0.15);
      const an = (i / n) * TAU + Math.PI / 2;
      const len = s * (0.006 + 0.065 * st.bars[i]);
      const c = Math.cos(an), sn = Math.sin(an);
      ctx.moveTo(cx + c * r0, cy + sn * r0);
      ctx.lineTo(cx + c * (r0 + len), cy + sn * (r0 + len));
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = lw * 3;
    ctx.strokeStyle = 'rgba(255,170,70,0.12)';
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = sg;
    ctx.stroke();

    // the turning mandala
    st.spin += f.dt * (0.03 + a.energy * 0.03);
    const ms = st.man.size;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.85 + a.beat * 0.15;
    ctx.save();
    ctx.rotate(-st.spin * 0.7);
    ctx.drawImage(st.man.outer, -ms / 2, -ms / 2);
    ctx.restore();
    ctx.rotate(st.spin);
    ctx.drawImage(st.man.inner, -ms / 2, -ms / 2);
    ctx.restore();

    // the photo in a thin gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, pr + s * 0.004, 0, TAU);
    ctx.fillStyle = GOLD;
    ctx.fill();
    circlePhoto(ctx, f, cx, cy, pr, 1.05 + a.beat * 0.02);
  },
};

// ---------- Dhaka Band (woven border and a wave) ----------

// A strip of dhaka weave: a row of stepped diamonds between two borders.
function dhakaBandTile(cell) {
  const C = DHAKA, P = 12, G = 13;
  const c = makeCanvas(P * cell, G * cell), g = c.getContext('2d');
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < P; i++) {
      let col;
      if (j === 0 || j === G - 1) col = C.black;
      else if (j === 1 || j === G - 2) col = i % 2 ? C.white : C.red;
      else {
        const d = Math.abs(i - 6) + Math.abs(j - 6);
        if (d === 0) col = C.yellow;
        else if (d <= 1) col = C.black;
        else if (d <= 2) col = C.white;
        else if (d <= 3) col = C.red;
        else if (d <= 4) col = C.orange;
        else if (d <= 5) col = C.green;
        else if (d <= 6) col = C.white;
        else col = (i + j) % 2 ? C.black : '#2a1d1a';
      }
      g.fillStyle = col;
      g.fillRect(i * cell, j * cell, cell, cell);
    }
  }
  for (let j = 0; j < G; j++) {
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, j * cell, P * cell, Math.max(1, cell * 0.35));
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(0, j * cell + cell * 0.7, P * cell, Math.max(1, cell * 0.3));
  }
  return c;
}

const dhakaWave = {
  id: 'dhaka-wave',
  name: 'Dhaka Band',
  ne: 'ढाका पट्टी',
  cat: 'nepali',
  text: (f) => ({
    title: { y: f.portrait ? 0.14 : 0.13, font: 'baloo', size: 0.08 },
    sub: { y: f.portrait ? 0.185 : 0.215 },
  }),
  setup(f) {
    const cell = Math.max(2, Math.round((f.s * (f.portrait ? 0.05 : 0.055)) / 13));
    const n = 56;
    return {
      cell, tile: dhakaBandTile(cell), ctx: null,
      layers: [0, 1, 2].map(() => new Float32Array(n)), tmp: new Float32Array(n),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    if (st.ctx !== ctx) {
      st.ctx = ctx;
      st.pat = ctx.createPattern(st.tile, 'repeat');
    }
    photoBackground(ctx, f, { dim: 0.05 });
    fadeEdge(ctx, f, 'top', 0.3, 0.35);
    fadeEdge(ctx, f, 'bottom', 0.45, 0.6);

    const bandH = st.cell * 13, base = h - bandH;
    const amp = s * (f.portrait ? 0.19 : 0.16) * (1 + a.kick * 0.1);
    // back to front: green (slow), orange, red (fast)
    const defs = [
      [DHAKA.green, 1.45, 0.14, 0.04, 2.2],
      [DHAKA.orange, 1.2, 0.28, 0.08, 1.1],
      [DHAKA.red, 1, 0.55, 0.18, 0],
    ];
    ctx.save();
    ctx.lineJoin = 'round';
    for (let k = 0; k < 3; k++) {
      const [col, kk, up, down, phase] = defs[k];
      const arr = st.layers[k];
      waveShape(f, st.tmp, phase);
      for (let i = 0; i < arr.length; i++) arr[i] = follow(arr[i], st.tmp[i], up, down);
      const pts = wavePts(arr, w, base, amp * kk);
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w, base + 1);
      ctx.lineTo(0, base + 1);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp * kk, 0, base);
      g.addColorStop(0, rgba(shade(col, 0.15), 0.9));
      g.addColorStop(1, rgba(shade(col, -0.45), 0.35));
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      smoothLine(ctx, pts);
      if (k < 2) {
        ctx.strokeStyle = 'rgba(14,8,8,0.6)';
        ctx.lineWidth = Math.max(1, s * 0.003);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(14,8,8,0.5)';
        ctx.lineWidth = Math.max(2, s * 0.008);
        ctx.stroke();
        ctx.strokeStyle = DHAKA.white;
        ctx.lineWidth = Math.max(1.2, s * 0.0035);
        ctx.stroke();
      }
    }
    ctx.restore();

    // the woven band slides slowly along the bottom
    const T = st.tile.width;
    const shift = (f.t * s * 0.02) % T;
    ctx.save();
    ctx.translate(-shift, base);
    ctx.fillStyle = st.pat;
    ctx.fillRect(0, 0, w + T, bandH);
    ctx.restore();
    if (a.beat > 0.02) {
      ctx.fillStyle = `rgba(255,240,210,${a.beat * 0.14})`;
      ctx.fillRect(0, base, w, bandH);
    }
    ctx.fillStyle = DHAKA.white;
    ctx.fillRect(0, base - Math.max(1, s * 0.002), w, Math.max(1, s * 0.002));
  },
};

// ---------- Madal (drum skin ripples) ----------

const madal = {
  id: 'madal',
  name: 'Madal',
  ne: 'मादल',
  cat: 'nepali',
  text: (f) => (f.portrait
    ? { title: { y: 0.72, font: 'mukta', color: '#f7e2b8' }, sub: { y: 0.765, color: '#efdcc0' } }
    : { title: { y: 0.83, font: 'mukta', color: '#f7e2b8', size: 0.07 }, sub: { y: 0.905, color: '#efdcc0', size: 0.034 } }),
  setup(f) {
    const r = rng(13);
    const rings = Array.from({ length: 14 }, () => ({ age: 9, str: 0, k: 6, ph: 0, col: 0 }));
    return { pr: f.s * (f.portrait ? 0.22 : 0.18), rings, r, midPrev: 0, lastMid: -1, flex: 0, pts: 120 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.38, zoom: 0.08 });

    const cx = w / 2, cy = h * (f.portrait ? 0.4 : 0.42);
    st.flex = follow(st.flex, a.kick, 0.7, 0.15);
    const pr = st.pr * (1 + st.flex * 0.03);
    const rimW = s * 0.03;

    const spawn = (str, delay) => {
      let best = st.rings[0];
      for (const R of st.rings) if (R.age > best.age) best = R;
      best.age = -delay;
      best.str = str;
      best.k = 5 + Math.floor(st.r() * 4);
      best.ph = st.r() * TAU;
      best.col = Math.floor(st.r() * 3);
    };
    if (a.beatHit) {
      spawn(0.7 + a.bass * 0.3, 0);
      spawn(0.35, 0.14);
    }
    const rise = a.mid - st.midPrev;
    st.midPrev = a.mid;
    if (rise > 0.05 && f.t - st.lastMid > 0.2) {
      st.lastMid = f.t;
      spawn(0.3, 0);
    }

    // one fill: warm glow round the drum, earthy wash, dark corners
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    const t1 = clamp((pr * (2.6 + a.bass * 0.5) - pr) / (far - pr), 0.05, 0.85);
    const glow = ctx.createRadialGradient(cx, cy, pr, cx, cy, far);
    glow.addColorStop(0, `rgba(230,150,70,${0.34 + a.beat * 0.16})`);
    glow.addColorStop(t1, 'rgba(74,36,12,0.4)');
    glow.addColorStop(1, 'rgba(30,12,4,0.82)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // ripples spreading out from the drum
    const COLS = ['#f3d9a6', '#d98a4a', '#e9b872'];
    const dur = 2.4, np = st.pts;
    ctx.save();
    for (const R of st.rings) {
      R.age += f.dt;
      if (R.age < 0 || R.age > dur) continue;
      const p = R.age / dur;
      const rad = pr + rimW + (1 - Math.pow(1 - p, 2.4)) * s * (0.25 + 0.35 * R.str);
      const alpha = Math.pow(1 - p, 1.5) * R.str;
      const wob = s * 0.007 * (1 - p) * R.str;
      ctx.beginPath();
      for (let i = 0; i <= np; i++) {
        const an = (i / np) * TAU;
        const rr = rad + Math.sin(an * R.k + R.ph + f.t * 1.5) * wob;
        const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = rgba(COLS[R.col], alpha * 0.9);
      ctx.lineWidth = Math.max(1, s * 0.006 * (1 - p * 0.7) * (0.6 + R.str * 0.6));
      ctx.stroke();
    }
    ctx.restore();

    // the drum: leather rim with laced straps
    const r1 = pr + rimW;
    const lea = ctx.createRadialGradient(cx, cy, pr, cx, cy, r1);
    lea.addColorStop(0, '#2c180c');
    lea.addColorStop(0.5, '#6e3f1e');
    lea.addColorStop(1, '#3a2010');
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, TAU);
    ctx.fillStyle = lea;
    ctx.fill();
    const lace = 28;
    ctx.beginPath();
    for (let i = 0; i <= lace * 2; i++) {
      const an = (i / (lace * 2)) * TAU;
      const rr = i % 2 ? r1 - rimW * 0.15 : pr + rimW * 0.15;
      const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = '#e8d2a2';
    ctx.lineWidth = Math.max(1, s * 0.0028);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, TAU);
    ctx.strokeStyle = `rgba(240,190,120,${0.6 + a.beat * 0.4})`;
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.stroke();
    circlePhoto(ctx, f, cx, cy, pr, 1.05 + st.flex * 0.025);
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, TAU);
    ctx.strokeStyle = 'rgba(20,10,4,0.6)';
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.stroke();
  },
};

export default [himalaya, pahad, kathmandu, prayerFlags, laliGurans, diyo, mandala, madal, sarangi, dhaka, dhakaWave, tihar];
