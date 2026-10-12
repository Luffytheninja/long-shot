/**
 * audio.js – synthesised sound engine (Web Audio API).
 *
 * All sounds are synthesised; no audio files are loaded.
 * The AudioContext is created (and unlocked) on the first user gesture.
 *
 * Usage:
 *   import AudioEngine from './audio.js';
 *   const audio = new AudioEngine();
 *   audio.unlock();       // call on first pointerdown
 *   audio.playStretch(t); // 0..1 pull amount, call continuously while dragging
 *   audio.playShoot();
 *   audio.playHit(tierId);
 *   audio.playMiss();
 *   audio.playCombo(streak);
 *   audio.playRoundEnd();
 *   audio.mute() / audio.unmute();
 */

export default class AudioEngine {
  constructor() {
    this._ctx    = null;
    this._muted  = false;
    this._ready  = false;
    this._stretchNode = null;
  }

  unlock() {
    if (this._ready) return;
    try {
      this._ctx   = new (window.AudioContext || window.webkitAudioContext)();
      this._ready = true;
    } catch (_) { /* audio not available */ }
  }

  get ctx() { return this._ctx; }

  mute()   { this._muted = true; }
  unmute() { this._muted = false; }
  get muted() { return this._muted; }

  // ── Internal helpers ───────────────────────────────────────────────────────

  _osc(type, freq, gain, duration, when = 0) {
    if (!this._ready || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  _noise(gain, duration, filterFreq = 4000, when = 0) {
    if (!this._ready || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime + when;
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = filterFreq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(now);
  }

  // ── Public sounds ──────────────────────────────────────────────────────────

  /**
   * Band stretch – frequency rises with pull amount (0..1).
   * Restarts the oscillator each frame while dragging; call with throttle.
   */
  playStretch(amount) {
    if (!this._ready || this._muted) return;
    const freq = 100 + amount * 300;
    this._osc('sawtooth', freq, 0.04, 0.08);
  }

  /** Twang on release. */
  playShoot() {
    if (!this._ready || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.31);
    // Whoosh noise
    this._noise(0.15, 0.4, 2000);
  }

  /**
   * Glass shatter – 3 noise bursts at different pitches.
   * @param {number} tierId – 1..5, used to vary pitch
   */
  playHit(tierId = 3) {
    if (!this._ready || this._muted) return;
    const base = 3000 + tierId * 800;
    this._noise(0.5, 0.25, base,        0);
    this._noise(0.35, 0.3, base * 0.6,  0.03);
    this._noise(0.2,  0.4, base * 0.35, 0.07);
    // Melodic tinkle
    this._osc('sine', 2000 + tierId * 200, 0.1, 0.15, 0.05);
  }

  /** Dull thud for a miss. */
  playMiss() {
    this._osc('sine', 60, 0.4, 0.3);
    this._noise(0.2, 0.2, 100);
  }

  /**
   * Rising chime per streak step.
   * @param {number} streak – consecutive hit count
   */
  playCombo(streak) {
    const semitones = Math.min(streak, 8);
    const freq = 440 * Math.pow(2, semitones / 12);
    this._osc('sine', freq,      0.3, 0.15);
    this._osc('sine', freq * 2,  0.1, 0.15, 0.05);
  }

  /** Round end fanfare. */
  playRoundEnd() {
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => this._osc('sine', freq, 0.25, 0.5, i * 0.18));
  }

  /** UI tap click. */
  playTap() {
    this._osc('square', 1200, 0.08, 0.05);
  }
}
