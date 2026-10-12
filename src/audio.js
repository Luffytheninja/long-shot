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

const MUTE_KEY = 'longshot_audio_muted';

export default class AudioEngine {
  constructor() {
    this._ctx    = null;
    this._muted  = this._loadMuteState();
    this._ready  = false;
    this._stretchNode = null;
  }

  _loadMuteState() {
    try {
      return localStorage.getItem(MUTE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  _saveMuteState() {
    try {
      localStorage.setItem(MUTE_KEY, String(this._muted));
    } catch (_) {}
  }

  unlock() {
    if (this._ready) return;
    try {
      this._ctx   = new (window.AudioContext || window.webkitAudioContext)();
      this._ready = true;
    } catch (_) { /* audio not available */ }
  }

  get ctx() { return this._ctx; }

  toggleMute() {
    this._muted = !this._muted;
    this._saveMuteState();
    return this._muted;
  }

  mute() {
    this._muted = true;
    this._saveMuteState();
  }

  unmute() {
    this._muted = false;
    this._saveMuteState();
  }

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

  /** Twang on release with snap. */
  playShoot() {
    if (!this._ready || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.22);
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.26);
    // Rubber band whip noise
    this._noise(0.2, 0.18, 2400);
  }

  /**
   * Iconic Lagos "Gbam!" bottle smash with resonant glass ring.
   * @param {number} tierId – 1..5
   */
  playGbam(tierId = 3) {
    if (!this._ready || this._muted) return;
    const base = 2800 + tierId * 600;
    // Deep tactile "Gbam" impact body
    this._osc('triangle', 180, 0.5, 0.22);
    this._noise(0.6, 0.28, base, 0);
    this._noise(0.4, 0.35, base * 0.65, 0.03);
    this._noise(0.25, 0.45, base * 0.4, 0.06);
    // Resonant glass ring
    this._osc('sine', 2200 + tierId * 250, 0.18, 0.28, 0.04);
  }

  /**
   * Glass shatter – 3 noise bursts at different pitches.
   * @param {number} tierId – 1..5, used to vary pitch
   */
  playHit(tierId = 3) {
    this.playGbam(tierId);
  }

  /** Tactile dust thud against compound concrete for a miss. */
  playMiss() {
    if (!this._ready || this._muted) return;
    this._osc('sine', 75, 0.45, 0.25);
    this._noise(0.25, 0.18, 180);
  }

  /**
   * Rising chime per streak step.
   * @param {number} streak – consecutive hit count
   */
  playCombo(streak) {
    if (!this._ready || this._muted) return;
    const semitones = Math.min(streak, 8);
    const freq = 440 * Math.pow(2, semitones / 12);
    this._osc('sine', freq,      0.32, 0.18);
    this._osc('sine', freq * 2,  0.14, 0.18, 0.05);
  }

  /** Round end fanfare. */
  playRoundEnd() {
    if (!this._ready || this._muted) return;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => this._osc('sine', freq, 0.25, 0.5, i * 0.18));
  }

  /** UI tap click. */
  playTap() {
    if (!this._ready || this._muted) return;
    this._osc('square', 1200, 0.08, 0.05);
  }
}
