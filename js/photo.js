// Turns the chosen picture into the versions templates draw from:
//   sharp  - the photo itself (long side capped so phones stay fast)
//   blur   - a soft, blurred copy for backgrounds
//   gray   - a high-contrast black & white copy
//   palette- colours picked from the photo, so effects match the picture
import { clamp, rgbToHex, hexToRgb, mix } from './helpers.js';

const MAX_SIDE = 2048;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export async function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Keep the URL alive until decode finishes; the decoded image stays usable.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Shrink the photo, then blur its pixels directly (three box blurs, close to
// a Gaussian). Done once per photo. Safari can't be trusted to upscale a
// tiny image smoothly, so the blurred copy is kept at a decent size.
function boxBlur(data, w, h, r) {
  const tmp = new Uint8ClampedArray(data.length);
  const pass = (src, dst, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    const step = horizontal ? 4 : w * 4;
    const span = r * 2 + 1;
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * w * 4 : l * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[base + clampI(k, len) * step + c];
        for (let i = 0; i < len; i++) {
          dst[base + i * step + c] = sum / span;
          sum += src[base + clampI(i + r + 1, len) * step + c] - src[base + clampI(i - r, len) * step + c];
        }
      }
      for (let i = 0; i < len; i++) dst[base + i * step + 3] = 255;
    }
  };
  for (let n = 0; n < 3; n++) {
    pass(data, tmp, true);
    pass(tmp, data, false);
  }
}
const clampI = (i, len) => (i < 0 ? 0 : i >= len ? len - 1 : i);

function makeBlur(src) {
  let cur = src;
  const targetW = 480;
  while (cur.width > targetW * 2) {
    const c = canvas(cur.width / 2, cur.height / 2);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const scale = Math.min(1, targetW / cur.width);
  const out = canvas(cur.width * scale, cur.height * scale);
  const og = out.getContext('2d', { willReadFrequently: true });
  og.imageSmoothingQuality = 'high';
  og.drawImage(cur, 0, 0, out.width, out.height);
  const d = og.getImageData(0, 0, out.width, out.height);
  boxBlur(d.data, out.width, out.height, Math.max(2, Math.round(Math.max(out.width, out.height) * 0.035)));
  og.putImageData(d, 0, 0);
  return out;
}

function makeGray(src) {
  const scale = Math.min(1, 1280 / Math.max(src.width, src.height));
  const c = canvas(src.width * scale, src.height * scale);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let v = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
    v = clamp((v - 0.5) * 1.35 + 0.5); // more contrast
    v = v * v * (3 - 2 * v);
    p[i] = p[i + 1] = p[i + 2] = v * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// Lift a picked colour so it reads as a glowing accent on dark video.
function asAccent(hex) {
  const [r, g, b] = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.max(s, 0.65);
  l = clamp(l, 0.55, 0.68);
  return hslToHex(h, s, l);
}

export function pickPalette(src) {
  const c = canvas(24, 24);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, 24, 24);
  const p = g.getImageData(0, 0, 24, 24).data;
  const px = [];
  for (let i = 0; i < p.length; i += 4) {
    const [h, s, l] = rgbToHsl(p[i], p[i + 1], p[i + 2]);
    px.push({ r: p[i], g: p[i + 1], b: p[i + 2], h, s, l });
  }
  const avg = (list) => {
    const n = Math.max(1, list.length);
    return rgbToHex(
      list.reduce((a, q) => a + q.r, 0) / n,
      list.reduce((a, q) => a + q.g, 0) / n,
      list.reduce((a, q) => a + q.b, 0) / n,
    );
  };
  const byL = [...px].sort((a, b) => a.l - b.l);
  const q = Math.floor(px.length * 0.2);
  const dark = mix(avg(byL.slice(0, q)), '#000000', 0.35);
  const light = mix(avg(byL.slice(-q)), '#ffffff', 0.3);
  const mid = avg(px);
  const score = (q2) => q2.s * (1 - Math.abs(q2.l - 0.55) * 1.6);
  const vividPx = [...px].sort((a, b) => score(b) - score(a));
  const v1 = vividPx[0];
  let v2 = vividPx.find((q2) => {
    const d = Math.abs(q2.h - v1.h);
    return Math.min(d, 360 - d) > 50 && q2.s > 0.25;
  });
  let vivid = v1 && v1.s > 0.18 ? asAccent(rgbToHex(v1.r, v1.g, v1.b)) : '#e0473f';
  let vivid2 = v2 ? asAccent(rgbToHex(v2.r, v2.g, v2.b)) : null;
  if (!vivid2) {
    // No second colour in the photo: use a warm/cool partner of the first.
    const [h, s, l] = rgbToHsl(...hexToRgb(vivid));
    vivid2 = hslToHex((h + 40) % 360, s, l);
  }
  return { dark, mid, light, vivid, vivid2 };
}

export function preparePhoto(src) {
  const scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const sharp = canvas(src.width * scale, src.height * scale);
  const sg = sharp.getContext('2d');
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(src, 0, 0, sharp.width, sharp.height);
  return {
    sharp,
    blur: makeBlur(sharp),
    gray: makeGray(sharp),
    palette: pickPalette(sharp),
    aspect: sharp.width / sharp.height,
    placeholder: false,
  };
}

// A calm hills-at-dusk picture used until a photo is chosen,
// so every template always has something to show.
export function placeholderPhoto() {
  const w = 1600, h = 1000;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1d2350');
  sky.addColorStop(0.55, '#b4506a');
  sky.addColorStop(0.8, '#f2a55c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,236,200,0.9)';
  g.beginPath();
  g.arc(w * 0.68, h * 0.62, h * 0.09, 0, Math.PI * 2);
  g.fill();
  const ridge = (base, amp, seed, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = base - amp * (Math.sin(x / 210 + seed) * 0.5 + Math.sin(x / 83 + seed * 2) * 0.25 + Math.sin(x / 37 + seed * 3) * 0.08 + 0.5);
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.fill();
  };
  ridge(h * 0.66, h * 0.32, 1, '#3c2a4d');
  ridge(h * 0.78, h * 0.22, 4, '#291d38');
  ridge(h * 0.9, h * 0.16, 7, '#170f22');
  const p = preparePhoto(c);
  p.placeholder = true;
  return p;
}
