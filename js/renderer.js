// Builds the frame object templates receive, runs the chosen template, and
// strings intro -> song -> outro together on one timeline.
import { drawCover, drawContain, clamp } from './helpers.js';
import { drawItems } from './text.js';

export function makeFrame(w, h) {
  return {
    w, h, s: Math.min(w, h),
    portrait: h > w * 1.1, square: Math.abs(w - h) < w * 0.1,
    t: 0, dt: 1 / 30, dur: 180, progress: 0,
    photo: null, a: null,
    color: { accent: '#ff5d5d', accent2: '#ffb347', light: '#ffffff', dark: '#0b0b10' },
    motion: true,
    preview: true,
  };
}

export function resizeFrame(f, w, h) {
  f.w = w; f.h = h; f.s = Math.min(w, h);
  f.portrait = h > w * 1.1;
  f.square = Math.abs(w - h) < w * 0.1;
}

// Runs one template and keeps its state. A template that throws never
// breaks the video: the photo is drawn instead.
export class Scene {
  constructor() { this.tpl = null; this.state = null; this.key = ''; this.failed = false; }

  setTemplate(tpl) { this.tpl = tpl; this.key = ''; this.failed = false; }

  draw(ctx, f) {
    const key = `${this.tpl && this.tpl.id}:${f.w}x${f.h}`;
    if (key !== this.key) {
      this.key = key;
      try { this.state = this.tpl && this.tpl.setup ? this.tpl.setup(f) || {} : {}; } catch (e) { console.error(e); this.state = {}; }
    }
    ctx.save();
    try {
      if (!this.tpl || this.failed) throw new Error('no template');
      this.tpl.draw(ctx, f, this.state);
    } catch (e) {
      if (!this.failed && this.tpl) console.error(`Template ${this.tpl.id} failed`, e);
      this.failed = !!this.tpl;
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, f.w, f.h);
      drawCover(ctx, f.photo.sharp, 0, 0, f.w, f.h);
    }
    ctx.restore();
  }
}

// ---------- timeline ----------
export const FADE = 0.45;

// media: { type: 'image'|'video', img|el, dur }
export function buildTimeline(intro, songLen, outro) {
  const segs = [];
  let t = 0;
  if (intro) { segs.push({ kind: 'intro', start: t, dur: intro.dur, media: intro }); t += intro.dur; }
  segs.push({ kind: 'main', start: t, dur: songLen }); t += songLen;
  if (outro) { segs.push({ kind: 'outro', start: t, dur: outro.dur, media: outro }); t += outro.dur; }
  return { segs, total: t, main: segs.find((s) => s.kind === 'main') };
}

export function segmentAt(tl, t) {
  for (const s of tl.segs) if (t < s.start + s.dur) return s;
  return tl.segs[tl.segs.length - 1];
}

function fadeAlpha(local, dur, fadeIn, fadeOut) {
  let a = 1;
  if (fadeIn) a = Math.min(a, clamp(local / FADE));
  if (fadeOut) a = Math.min(a, clamp((dur - local) / FADE));
  return a;
}

// Intro / outro picture or clip: fills the frame. A clip with a different
// shape (e.g. a tall phone video in a wide frame) sits on a dimmed copy of itself.
export function drawMedia(ctx, f, media, local) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, f.w, f.h);
  const src = media.type === 'video' ? media.el : media.img;
  const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
  if (!sw || !sh) return;
  const close = Math.abs(sw / sh - f.w / f.h) < 0.15 * (f.w / f.h);
  if (media.type === 'image') {
    const z = 1.02 + 0.06 * clamp(local / Math.max(1, media.dur));
    if (close) drawCover(ctx, src, 0, 0, f.w, f.h, z);
    else {
      ctx.globalAlpha = 0.35;
      drawCover(ctx, src, 0, 0, f.w, f.h, 1.2);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(f.w / 2, f.h / 2);
      ctx.scale(z, z);
      ctx.translate(-f.w / 2, -f.h / 2);
      drawContain(ctx, src, 0, 0, f.w, f.h);
      ctx.restore();
    }
  } else if (close) {
    drawCover(ctx, src, 0, 0, f.w, f.h);
  } else {
    ctx.globalAlpha = 0.3;
    drawCover(ctx, src, 0, 0, f.w, f.h, 1.2);
    ctx.globalAlpha = 1;
    drawContain(ctx, src, 0, 0, f.w, f.h);
  }
}

// Draw the whole video at timeline time t.
// opts: { scene, items, beatText, tl, fadeOutEnd }
export function drawTimeline(ctx, f, t, opts) {
  const { scene, items, beatText, tl } = opts;
  const seg = segmentAt(tl, t);
  const local = t - seg.start;
  const isFirst = seg === tl.segs[0];
  const isLast = seg === tl.segs[tl.segs.length - 1];
  let alpha;
  if (seg.kind === 'main') {
    scene.draw(ctx, f);
    drawItems(ctx, f, items, { alpha: clamp(local / 0.8), beatText });
    alpha = fadeAlpha(local, seg.dur, !isFirst, true);
  } else {
    drawMedia(ctx, f, seg.media, local);
    // Intro fades out into the song; the ending fades in and out.
    alpha = fadeAlpha(local, seg.dur, seg.kind === 'outro', !isLast || seg.kind === 'outro');
  }
  if (alpha < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
    ctx.fillRect(0, 0, f.w, f.h);
  }
  return seg;
}
