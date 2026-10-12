/**
 * game.js – top-level game controller.
 *
 * Wires together: Engine, SpawnManager, Scoring, AudioEngine, UI, and SDK.
 * Manages state transitions: start → playing → results → leaderboard → start.
 *
 * Usage (from main.js):
 *   import Game from './game.js';
 *   const game = new Game(canvasEl);
 *   await game.init();
 */

import Engine       from './engine.js';
import SpawnManager from './spawnManager.js';
import Scoring      from './scoring.js';
import AudioEngine  from './audio.js';
import UI           from './ui.js';
import { boot }     from './sdk.js';
import { makeRng, dailySeed, practiceSeed } from './rng.js';

const BEST_KEY_DAILY    = 'longshot_best_daily';
const BEST_KEY_PRACTICE = 'longshot_best_practice';

export default class Game {
  constructor(canvas) {
    this.canvas  = canvas;
    this.engine  = new Engine(canvas, {
      onHit:   (tier) => this._onHit(tier),
      onMiss:  ()     => this._onMiss(),
      onShoot: ()     => this._onShoot(),
    });
    this.scoring = new Scoring();
    this.audio   = new AudioEngine();
    this.ui      = new UI(canvas);
    this.spawn   = null;   // created per round

    this.player  = null;
    this.sdk     = null;
    this.live    = false;

    this.mode    = 'daily';   // 'daily' | 'practice'
    this._audioUnlocked = false;

    // UI event wiring
    this.ui.onDailyChallenge = () => { this.audio.playTap(); this._startRound('daily'); };
    this.ui.onPractice       = () => { this.audio.playTap(); this._startRound('practice'); };
    this.ui.onRematch        = () => { this.audio.playTap(); this._startRound(this.mode); };
    this.ui.onLeaderboard    = () => { this.audio.playTap(); this._showLeaderboard(); };
    this.ui.onResume         = () => { this.audio.playTap(); this._resume(); };

    // Unlock audio on first touch
    canvas.addEventListener('pointerdown', () => {
      if (!this._audioUnlocked) {
        this.audio.unlock();
        this._audioUnlocked = true;
      }
    }, { once: false });

    // Handle resize
    window.addEventListener('resize', () => this._resize());
    this._resize();

    // RAF loop (separate from engine fixed step – this handles UI + engine render)
    this._rafId = null;
    this._lastT = 0;
  }

  async init() {
    const { player, live, sdk } = await boot();
    this.player = player;
    this.live   = live;
    this.sdk    = sdk;

    this.ui.setPlayer(player);
    this.ui.setBestDaily(this._getBest(BEST_KEY_DAILY));

    // Register platform pause/resume
    sdk.onPause(()  => this._pause());
    sdk.onResume(() => this._resume());

    // Show start screen
    this.ui.setScreen('start');
    this._startLoop();
  }

  // ── Round lifecycle ────────────────────────────────────────────────────────

  _startRound(mode) {
    this.mode = mode;
    this.scoring.reset();
    this.engine.rocks    = [];
    this.engine.particles= [];
    this.engine.shotsFired = 0;

    const seed = mode === 'daily' ? dailySeed() : practiceSeed();
    const rand = makeRng(seed);

    this.spawn = new SpawnManager(rand, this.engine);
    this.spawn.start();

    this.ui.setScreen('game');
    this.engine.start();
    this._updateHUD();
  }

  _onShoot() {
    const over = this.scoring.onShoot();
    this._updateHUD();
    // If last rock just shot, wait for it to land before ending
    // (engine calls onHit/onMiss which decrements correctly)
    if (over) {
      // Give the last rock 3 s to land before forcing round end
      setTimeout(() => this._endRound(), 3000);
    }
  }

  _onHit(tier) {
    const { points, multiplier, bonus, comboText } = this.scoring.onHit(tier);
    this.audio.playHit(tier.id);
    if (this.scoring.combo >= 2) this.audio.playCombo(this.scoring.combo);

    // Flash text on canvas
    // We need a world position – use a rough centre of screen top
    const flashX = 50 + (Math.random() - 0.5) * 20;
    const flashY = 80;
    const comboLabel = bonus > 0 ? `+${points} BONUS!` : comboText ? `+${points} ${comboText}` : `+${points}`;
    this.ui.addFlash(comboLabel, flashX, flashY, this.engine.ppu, this.engine.offX, this.engine.offY);

    this._updateHUD();

    if (this.scoring.roundOver) this._endRound();
  }

  _onMiss() {
    this.scoring.onMiss();
    this.audio.playMiss();
    this._updateHUD();

    if (this.scoring.roundOver) this._endRound();
  }

  _endRound() {
    if (this._roundEnded) return;
    this._roundEnded = true;

    this.engine.stop();
    this.spawn?.stop();
    this.audio.playRoundEnd();

    const summary = this.scoring.summary();

    // Personal best
    const key = this.mode === 'daily' ? BEST_KEY_DAILY : BEST_KEY_PRACTICE;
    const prev = this._getBest(key);
    summary.isPersonalBest = summary.score > prev;
    if (summary.isPersonalBest) this._saveBest(key, summary.score);

    // Submit score to platform
    if (this.live) this.sdk.submitScore(summary.score);

    this.ui.setResults(summary);
    this.ui.setScreen('results');

    this._roundEnded = false;
  }

  async _showLeaderboard() {
    this.ui.setScreen('leaderboard');
    if (this.live) {
      const data = await this.sdk.leaderboard();
      if (data) this.ui.setLeaderboard(data);
    }
  }

  _pause() {
    this.engine.stop();
    this.spawn?.stop();
    this.audio.mute();
    this.ui.setScreen('paused');
  }

  _resume() {
    if (this.scoring.rocksLeft > 0 && !this.scoring.roundOver) {
      this.engine.start();
      if (this.spawn) this.spawn.running = true;
      this.audio.unmute();
      this.ui.setScreen('game');
    } else {
      this.ui.setScreen('start');
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  _updateHUD() {
    this.ui.setHUD({
      rocksLeft:  this.scoring.rocksLeft,
      score:      this.scoring.score,
      multiplier: this.scoring.multiplier,
      streak:     this.scoring.combo,
    });
  }

  // ── Local storage (best scores) ───────────────────────────────────────────

  _getBest(key) {
    try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; }
    catch (_) { return 0; }
  }

  _saveBest(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (_) { /* blocked */ }
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  _resize() {
    // Make canvas fill the viewport, respecting device pixel ratio
    const dpr  = window.devicePixelRatio || 1;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    this.canvas.width  = vw  * dpr;
    this.canvas.height = vh  * dpr;
    this.canvas.style.width  = `${vw}px`;
    this.canvas.style.height = `${vh}px`;
    this.engine.resize();
  }

  // ── Main RAF loop (render + UI update) ────────────────────────────────────

  _startLoop() {
    this._lastT = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - this._lastT) / 1000, 0.1);
      this._lastT = now;

      // Update spawn manager (engine fixed step is inside engine._loop)
      if (this.spawn && this.engine.running) this.spawn.update(dt);

      // Update UI (flash texts)
      this.ui.update(dt);

      // Render UI overlay on top of the game
      this.ui.render();

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}
