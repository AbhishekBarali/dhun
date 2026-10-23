// Audio: decodes the song, plays it through Web Audio, and turns the sound
// into simple numbers templates can react to (f.a):
//   bands  Float32Array(64)  spectrum, bass on the left, 0..1
//   wave   Float32Array(1024) waveform, -1..1
//   bass, mid, high, level   0..1 smoothed loudness of each range
//   kick   0..1 sharp bass hit envelope (jumps on each kick, falls fast)
//   beat   0..1 pulse that jumps to 1 on each detected beat and fades
//   beatHit true only on the frame a beat lands     beats  count so far
//   energy 0..1 slow average loudness (verse vs chorus)
import { clamp, smooth } from './helpers.js';

export const NBANDS = 64;

export function makeFeatures() {
  return {
    bands: new Float32Array(NBANDS),
    wave: new Float32Array(1024),
    bass: 0, mid: 0, high: 0, level: 0, kick: 0,
    beat: 0, beatHit: false, beats: 0, energy: 0,
  };
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.source = null;
    this.playing = false;
    this.offset = 0;      // song position when paused
    this.startedAt = 0;   // ctx time the song started (minus offset)
    this.a = makeFeatures();
    this._st = { agc: 0.45, avgBass: 0.3, fastBass: 0, lastBeat: -1, energy: 0, prevBass: 0 };
    this.onended = null;
  }

  // Must run inside a tap (iPhone only allows sound after a user gesture).
  async ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'playback' });
      const ctx = this.ctx;
      // Play even when the iPhone ring/silent switch is on silent.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.songGain = ctx.createGain();
      this.songGain.connect(this.master);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.6;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -20;
      this.beatAnalyser = ctx.createAnalyser();
      this.beatAnalyser.fftSize = 1024;
      this.beatAnalyser.smoothingTimeConstant = 0;
      this.beatAnalyser.minDecibels = -80;
      this.beatAnalyser.maxDecibels = -20;
      this.master.connect(this.analyser);
      this.master.connect(this.beatAnalyser);
      this._freq = new Uint8Array(this.analyser.frequencyBinCount);
      this._bfreq = new Uint8Array(this.beatAnalyser.frequencyBinCount);
      this._time = new Float32Array(this.analyser.fftSize);
      this._edges = this._bandEdges();
    }
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (e) { /* resumed on next tap */ }
    }
    return this.ctx;
  }

  _bandEdges() {
    const sr = this.ctx.sampleRate;
    const bins = this.analyser.frequencyBinCount;
    const hz = (b) => (b * sr) / (2 * bins);
    const lo = 32, hi = 14000;
    const edges = [];
    for (let i = 0; i <= NBANDS; i++) {
      const f = lo * Math.pow(hi / lo, i / NBANDS);
      edges.push(Math.max(1, Math.round(f / hz(1))));
    }
    // Make every band at least one bin wide.
    for (let i = 1; i < edges.length; i++) if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
    return edges;
  }

  // A recording output that carries everything the speaker plays.
  get recordStream() {
    if (!this.recDest) {
      this.recDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.recDest);
    }
    return this.recDest.stream;
  }

  async loadSong(file) {
    await this.ensure();
    const data = await file.arrayBuffer();
    const buffer = await new Promise((resolve, reject) => {
      // Older Safari only has the callback form.
      const p = this.ctx.decodeAudioData(data, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
    this.stop();
    this.buffer = buffer;
    this.offset = 0;
    return buffer;
  }

  get duration() { return this.buffer ? this.buffer.duration : 0; }

  get time() {
    if (!this.playing) return this.offset;
    return this.ctx.currentTime - this.startedAt;
  }

  // Preview playback from `offset` seconds.
  play(offset = this.offset) {
    if (!this.buffer) return;
    this.stop();
    this.source = this._makeSource();
    this.startedAt = this.ctx.currentTime - offset;
    this.source.start(0, offset);
    this.playing = true;
    this.source.onended = () => {
      if (this.source && this.playing && this.time >= this.duration - 0.05) {
        this.playing = false;
        this.offset = 0;
        this.onended && this.onended();
      }
    };
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.time;
    this.stop();
  }

  stop() {
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch (e) { /* already stopped */ }
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
    if (this.songGain) {
      this.songGain.gain.cancelScheduledValues(0);
      this.songGain.gain.value = 1;
    }
  }

  _makeSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.songGain);
    return src;
  }

  // For recording: start the song at ctx time `when`, from `offset`, for
  // `length` seconds, fading out over `fade` seconds at the end.
  scheduleSong(when, offset, length, fade = 0) {
    this.stop();
    this.source = this._makeSource();
    const g = this.songGain.gain;
    g.cancelScheduledValues(0);
    g.setValueAtTime(1, when);
    if (fade > 0) {
      g.setValueAtTime(1, when + Math.max(0, length - fade));
      g.linearRampToValueAtTime(0.0001, when + length);
    }
    this.source.start(when, offset, length);
    this.playing = true;
    this.startedAt = when - offset;
  }

  // Route an intro/outro video's sound into the same mix (once per element).
  attachMedia(el) {
    if (el._dhunNode || !this.ctx) return;
    try {
      el._dhunNode = this.ctx.createMediaElementSource(el);
      el._dhunNode.connect(this.master);
    } catch (e) {
      el._dhunNode = null;
    }
  }

  resetFeatures() {
    const a = this.a;
    a.bands.fill(0); a.wave.fill(0);
    a.bass = a.mid = a.high = a.level = a.kick = a.beat = a.energy = 0;
    a.beats = 0; a.beatHit = false;
    Object.assign(this._st, { agc: 0.45, avgBass: 0.3, fastBass: 0, lastBeat: -1, energy: 0, prevBass: 0 });
  }

  // Read the analysers and update this.a. t = clock in seconds, dt = frame gap.
  update(t, dt) {
    const a = this.a, st = this._st;
    if (!this.ctx) return a;
    dt = clamp(dt, 0.001, 0.1);
    this.analyser.getByteFrequencyData(this._freq);
    this.beatAnalyser.getByteFrequencyData(this._bfreq);
    this.analyser.getFloatTimeDomainData(this._time);

    // Spectrum bands with adaptive gain so quiet and loud songs both move.
    const raw = new Float32Array(NBANDS);
    let mean = 0;
    for (let i = 0; i < NBANDS; i++) {
      const b0 = this._edges[i], b1 = this._edges[i + 1];
      let m = 0;
      for (let b = b0; b < b1 && b < this._freq.length; b++) m = Math.max(m, this._freq[b]);
      let x = clamp((m / 255 - 0.22) / 0.72);
      x *= 0.9 + 0.5 * Math.pow(i / (NBANDS - 1), 1.3); // lift the quieter highs
      raw[i] = x;
      mean += x;
    }
    mean /= NBANDS;
    st.agc = Math.max(mean, st.agc - dt * 0.04);
    const gain = clamp(0.5 / Math.max(st.agc, 0.18), 0.85, 1.9);
    for (let i = 0; i < NBANDS; i++) {
      const target = clamp(raw[i] * gain);
      const cur = a.bands[i];
      a.bands[i] = smooth(cur, target, dt, target > cur ? 28 : 7);
    }

    // Waveform (first 1024 samples).
    for (let i = 0; i < a.wave.length; i++) a.wave[i] = this._time[i] || 0;

    const avgBands = (lo, hi) => {
      let s = 0;
      for (let i = lo; i < hi; i++) s += a.bands[i];
      return s / (hi - lo);
    };
    a.bass = avgBands(0, 10);
    a.mid = avgBands(18, 40);
    a.high = avgBands(44, 60);
    let rms = 0;
    for (let i = 0; i < this._time.length; i += 2) rms += this._time[i] * this._time[i];
    rms = Math.sqrt(rms / (this._time.length / 2));
    a.level = smooth(a.level, clamp(rms * 3.2 * gain), dt, 10);
    st.energy = smooth(st.energy, a.level, dt, 0.4);
    a.energy = st.energy;

    // Beat detection on the low end of an unsmoothed analyser.
    const sr = this.ctx.sampleRate, bins = this._bfreq.length;
    const hzPerBin = sr / (2 * bins);
    const b0 = Math.max(1, Math.floor(40 / hzPerBin)), b1 = Math.ceil(140 / hzPerBin);
    let bass = 0;
    for (let b = b0; b <= b1; b++) bass += this._bfreq[b];
    bass = bass / ((b1 - b0 + 1) * 255);
    const rise = bass - st.prevBass;
    st.prevBass = bass;
    st.avgBass = smooth(st.avgBass, bass, dt, 1.5);
    a.beatHit = false;
    if (bass > 0.3 && bass > st.avgBass * 1.1 + 0.03 && rise > 0.015 && t - st.lastBeat > 0.24) {
      st.lastBeat = t;
      a.beat = 1;
      a.beats++;
      a.beatHit = true;
    } else {
      a.beat *= Math.exp(-dt * 5);
    }
    const punch = clamp((bass - st.avgBass * 0.95) * 4);
    a.kick = punch > a.kick ? punch : a.kick * Math.exp(-dt * 9);
    return a;
  }
}

// Made-up music for template thumbnails and the preview before a song is
// chosen: a steady 100 BPM pulse with a moving spectrum.
export function fakeFeatures(t, a = makeFeatures(), dt = 1 / 30) {
  const bpm = 100;
  const beatLen = 60 / bpm;
  const phase = (t % beatLen) / beatLen;
  const k = Math.exp(-phase * 7);
  const n = Math.floor(t / beatLen);
  a.beatHit = phase < dt / beatLen;
  a.beats = n;
  a.beat = Math.exp(-phase * beatLen * 5);
  a.kick = Math.exp(-phase * beatLen * 9);
  const swell = 0.75 + 0.25 * Math.sin(t * 0.4);
  for (let i = 0; i < NBANDS; i++) {
    const x = i / (NBANDS - 1);
    const shape = 0.85 - 0.45 * x + 0.12 * Math.sin(x * 9 + t * 1.7) + 0.08 * Math.sin(x * 23 - t * 3.1);
    const hit = x < 0.18 ? k * 0.35 * (1 - x / 0.18) : 0;
    const shimmer = x > 0.6 ? 0.1 * Math.max(0, Math.sin(t * 8.7 + x * 40)) : 0;
    a.bands[i] = clamp((shape * swell + hit + shimmer) * 0.8);
  }
  for (let i = 0; i < a.wave.length; i++) {
    const s = i / a.wave.length;
    a.wave[i] = 0.45 * swell * (Math.sin(s * 22 + t * 4) * 0.6 + Math.sin(s * 57 - t * 7) * 0.25 + Math.sin(s * 131 + t * 11) * 0.15) * (0.7 + 0.3 * k);
  }
  let s = 0;
  for (let i = 0; i < 10; i++) s += a.bands[i];
  a.bass = s / 10;
  s = 0;
  for (let i = 18; i < 40; i++) s += a.bands[i];
  a.mid = s / 22;
  s = 0;
  for (let i = 44; i < 60; i++) s += a.bands[i];
  a.high = s / 16;
  a.level = clamp(0.45 * swell + 0.25 * k);
  a.energy = 0.5 * swell;
  return a;
}
