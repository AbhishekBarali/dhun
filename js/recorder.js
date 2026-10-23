// Records the canvas + the sound into a video file, keeps the screen awake,
// and hands the file to the phone (share sheet -> Save Video, or download).

const TYPES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.4d0028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function canRecord() {
  return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
}

export function pickMime() {
  if (!window.MediaRecorder) return null;
  if (!MediaRecorder.isTypeSupported) return '';
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export const extFor = (mime) => (/mp4/.test(mime) ? 'mp4' : 'webm');

export class Recorder {
  constructor(canvas, audioStream, { fps = 30, videoBits = 8e6 } = {}) {
    this.canvas = canvas;
    this.audioStream = audioStream;
    this.fps = fps;
    this.videoBits = videoBits;
    this.chunks = [];
    this.mime = pickMime();
  }

  start() {
    const video = this.canvas.captureStream(this.fps);
    const tracks = [...video.getVideoTracks(), ...this.audioStream.getAudioTracks()];
    this.stream = new MediaStream(tracks);
    const opts = { videoBitsPerSecond: this.videoBits, audioBitsPerSecond: 192000 };
    if (this.mime) opts.mimeType = this.mime;
    try {
      this.mr = new MediaRecorder(this.stream, opts);
    } catch (e) {
      this.mr = new MediaRecorder(this.stream); // let the browser choose
    }
    this.mime = this.mr.mimeType || this.mime || 'video/mp4';
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.start(1000);
  }

  pause() { if (this.mr && this.mr.state === 'recording') this.mr.pause(); }
  resume() { if (this.mr && this.mr.state === 'paused') this.mr.resume(); }

  stop() {
    return new Promise((resolve) => {
      if (!this.mr || this.mr.state === 'inactive') { resolve(this._blob()); return; }
      this.mr.onstop = () => { this._end(); resolve(this._blob()); };
      this.mr.stop();
    });
  }

  cancel() {
    if (this.mr && this.mr.state !== 'inactive') {
      this.mr.onstop = null;
      try { this.mr.stop(); } catch (e) { /* already stopped */ }
    }
    this._end();
    this.chunks = [];
  }

  _end() {
    // Stop only the canvas track; the audio track belongs to the shared mix.
    if (this.stream) this.stream.getVideoTracks().forEach((t) => t.stop());
  }

  _blob() {
    const type = (this.mime || 'video/mp4').split(';')[0];
    return new Blob(this.chunks, { type });
  }
}

export class ScreenAwake {
  async on() {
    try {
      if ('wakeLock' in navigator) this.lock = await navigator.wakeLock.request('screen');
    } catch (e) { this.lock = null; }
  }
  off() {
    try { if (this.lock) this.lock.release(); } catch (e) { /* ignore */ }
    this.lock = null;
  }
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// iPhone: opens the share sheet, where "Save Video" puts it in Photos.
// Returns 'shared' | 'cancelled' | 'unsupported'.
export async function shareBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'video/mp4' });
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (e) {
    return e && e.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

export function safeFileName(name, ext) {
  const base = (name || '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${base || 'dhun-video'}.${ext}`;
}
