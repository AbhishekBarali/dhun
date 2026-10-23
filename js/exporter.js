// Fast export: builds the video frame by frame as fast as the phone can draw
// and encode it (WebCodecs + an MP4 muxer), instead of playing the song in
// real time while recording. Phones without WebCodecs use the real-time
// recorder in recorder.js instead.
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.mjs';
import { decodeAudio } from './audio.js';

const SAMPLE_RATE = 48000;
const VIDEO_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640033', 'avc1.4d0033'];
const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
  || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Can this browser do the fast export at this size? Returns the encoder
// settings to use, or null.
export async function fastExportConfig(width, height, fps) {
  if (!('VideoEncoder' in window) || !('AudioEncoder' in window) || !('VideoFrame' in window) || !('AudioData' in window)) return null;
  const bitrate = width * height >= 1900000 ? 8e6 : 6e6;
  let video = null;
  const tryVideo = async (codec, muxCodec, extra = {}) => {
    const cfg = { codec, width, height, bitrate, framerate: fps, ...extra };
    try {
      const r = await VideoEncoder.isConfigSupported(cfg);
      if (r.supported) video = { cfg, muxCodec };
    } catch (e) { /* not this one */ }
  };
  for (const codec of VIDEO_CODECS) {
    await tryVideo(codec, 'avc', { avc: { format: 'avc' } });
    if (video) break;
  }
  // Without H.264, VP9 in MP4 still works on YouTube and Android.
  if (!video && !isApple()) await tryVideo('vp09.00.40.08', 'vp9');
  if (!video) return null;
  let audio = null;
  const aac = { codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192000 };
  try { if ((await AudioEncoder.isConfigSupported(aac)).supported) audio = { cfg: aac, muxCodec: 'aac' }; } catch (e) { /* no AAC */ }
  if (!audio && !isApple()) {
    // Opus in MP4 plays on YouTube and most phones; Apple's Photos app is
    // fussier, so Apple devices without AAC use the real-time recorder.
    const opus = { codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 160000 };
    try { if ((await AudioEncoder.isConfigSupported(opus)).supported) audio = { cfg: opus, muxCodec: 'opus' }; } catch (e) { /* no Opus */ }
  }
  if (!audio) return null;
  return { video, audio, fps };
}

// The whole soundtrack (intro clip sound, the song part with its fade, the
// ending clip sound) mixed into one AudioBuffer.
export async function mixSoundtrack({ song, part, tl }) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const length = Math.max(1, Math.ceil(tl.total * SAMPLE_RATE));
  const ctx = new OAC(2, length, SAMPLE_RATE);
  const play = (buffer, when, offset, dur, fade) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(1, when);
    if (fade > 0) {
      g.gain.setValueAtTime(1, when + Math.max(0, dur - fade));
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
    }
    src.start(when, offset, dur);
  };
  play(song, tl.main.start, part.start, part.len, part.fade);
  for (const seg of tl.segs) {
    if (!seg.media || seg.media.type !== 'video' || !seg.media.file) continue;
    try {
      const buf = await decodeAudio(ctx, await seg.media.file.arrayBuffer());
      play(buf, seg.start, 0, Math.min(seg.dur, buf.duration), 0.15);
    } catch (e) { /* clip without sound, or a format the phone can't decode */ }
  }
  return ctx.startRendering ? await new Promise((resolve, reject) => {
    ctx.oncomplete = (e) => resolve(e.renderedBuffer);
    const p = ctx.startRendering();
    if (p && p.then) p.then(resolve, reject);
  }) : null;
}

const nextTick = () => new Promise((r) => setTimeout(r, 0));

// Encode the video. drawFrame(t, dt) must draw timeline time t on `canvas`
// (it may be async). onProgress(done, total) is called now and then.
// Returns a Blob, or throws. Cancel with job.cancelled = true.
export async function exportVideo({ canvas, config, soundtrack, total, drawFrame, onProgress, job }) {
  const { fps } = config;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: config.video.muxCodec, width: canvas.width, height: canvas.height, frameRate: fps },
    audio: { codec: config.audio.muxCodec, numberOfChannels: 2, sampleRate: SAMPLE_RATE },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure = null;
  const venc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = failure || e; },
  });
  venc.configure(config.video.cfg);
  const aenc = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => { failure = failure || e; },
  });
  aenc.configure(config.audio.cfg);

  try {
    // Sound first: it is quick.
    const chunk = 4800;
    const chans = [soundtrack.getChannelData(0), soundtrack.getChannelData(Math.min(1, soundtrack.numberOfChannels - 1))];
    const frames = Math.min(soundtrack.length, Math.round(total * SAMPLE_RATE));
    for (let i = 0; i < frames; i += chunk) {
      const n = Math.min(chunk, frames - i);
      const data = new Float32Array(n * 2);
      data.set(chans[0].subarray(i, i + n), 0);
      data.set(chans[1].subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SAMPLE_RATE) * 1e6), data });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 20) await nextTick();
      if (failure) throw failure;
    }
    await aenc.flush();

    // Then every picture.
    const count = Math.ceil(total * fps);
    const dt = 1 / fps;
    const frameDur = Math.round(1e6 / fps);
    const stats = job.stats = { draw: 0, wait: 0, frames: count };
    for (let i = 0; i < count; i++) {
      if (job.cancelled) throw new Error('cancelled');
      if (failure) throw failure;
      while (document.hidden && !job.cancelled) await new Promise((r) => setTimeout(r, 250));
      const d0 = performance.now();
      await drawFrame(i * dt, dt);
      const vf = new VideoFrame(canvas, { timestamp: i * frameDur, duration: frameDur });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      const d1 = performance.now();
      stats.draw += d1 - d0;
      while (venc.encodeQueueSize > 6) {
        if (failure) throw failure;
        await new Promise((r) => setTimeout(r, 2));
      }
      stats.wait += performance.now() - d1;
      if (i % 3 === 0) {
        onProgress && onProgress(i + 1, count);
        await nextTick(); // let the screen update
      }
    }
    await venc.flush();
    if (failure) throw failure;
    muxer.finalize();
    onProgress && onProgress(count, count);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    try { if (venc.state !== 'closed') venc.close(); } catch (e) { /* closed */ }
    try { if (aenc.state !== 'closed') aenc.close(); } catch (e) { /* closed */ }
  }
}

// Move a clip to time t and wait until that picture is ready.
export function seekVideo(el, t) {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - t) < 0.001 && el.readyState >= 2) { resolve(); return; }
    const done = () => { clearTimeout(timer); el.removeEventListener('seeked', done); resolve(); };
    const timer = setTimeout(done, 1500);
    el.addEventListener('seeked', done);
    el.currentTime = t;
  });
}
