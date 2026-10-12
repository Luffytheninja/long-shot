/**
 * game.js – authoritative top-level game controller.
 *
 * Coordinates:
 * - Single authoritative RAF render & tick loop.
 * - Engine physics and Lagos environment drawing.
 * - Seeded spawn lifecycle & distance tiers.
 * - Scoring, combo multiplier, and 'Gbam!' feedback.
 * - Audio synthesis & persistent sound toggle.
 * - Power-up assists & clutch Second Chance purchase flow.
 */

import Engine          from './engine.js';
import SpawnManager    from './spawnManager.js';
import Scoring         from './scoring.js';
import AudioEngine     from './audio.js';
import UI              from './ui.js';
import PowerUpManager  from './powerups.js';
import { boot }        from './sdk.js';
import { makeRng, dailySeed, practiceSeed } from './rng.js';
import { PRODUCTS, MAX_TOTAL_SHOTS } from './constants.js';

const BEST_KEY_DAILY    = 'longshot_best_daily';
const BEST_KEY_PRACTICE = 'longshot_best_practice';

export default class Game {
  constructor(canvas) {
    this.canvas   = canvas;
    this.engine   = new Engine(canvas, {
      onHit:   (tier) => this._onHit(tier),
      onMiss:  ()     => this._onMiss(),
      onShoot: ()     => this._onShoot(),
    });
    this.scoring  = new Scoring();
    this.audio    = new AudioEngine();
    this.powerups = new PowerUpManager();
    this.ui       = new UI(canvas);
    this.spawn    = null;   // created per round

    this.player   = null;
    this.sdk      = null;
    this.live     = false;

    this.mode     = 'daily';   // 'daily' | 'practice'
    this._audioUnlocked = false;
    this._roundEnded    = false;
    this._clutchTimer   = null;

    // UI event wiring
    this.ui.onDailyChallenge      = () => { this.audio.playTap(); this._startRound('daily'); };
    this.ui.onPractice            = () => { this.audio.playTap(); this._startRound('practice'); };
    this.ui.onRematch             = () => { this.audio.playTap(); this._startRound(this.mode); };
    this.ui.onLeaderboard         = () => { this.audio.playTap(); this._showLeaderboard(); };
    this.ui.onResume              = () => { this.audio.playTap(); this._resume(); };
    this.ui.onOpenShop            = () => { this.audio.playTap(); this._openShop(); };
    this.ui.onCloseShop           = () => { this.audio.playTap(); this.ui.setScreen('start'); };
    this.ui.onBuyProduct          = (id) => this._handleProductPurchase(id);
    this.ui.onUseSlowTime         = () => this._activateSlowTime();
    this.ui.onUseBonusStones      = (type) => this._activateInGameAssist(type);
    this.ui.onBuySecondChance     = () => this._handleSecondChancePurchase();
    this.ui.onDeclineSecondChance = () => { this.audio.playTap(); this._finalizeRound(); };
    this.ui.onToggleSound         = () => this._toggleSound();

    // Set initial sound mute state in UI
    this.ui.setSoundMuted(this.audio.muted);

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

    // Single Authoritative RAF loop
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
    this.ui.setSoundMuted(this.audio.muted);
    this._syncPowerUpState();

    // Register platform pause/resume
    sdk.onPause(()  => this._pause());
    sdk.onResume(() => this._resume());

    // Show start screen
    this.ui.setScreen('start');
    this._startLoop();
  }

  _toggleSound() {
    const muted = this.audio.toggleMute();
    this.ui.setSoundMuted(muted);
    if (!muted) this.audio.playTap();
  }

  _syncPowerUpState() {
    this.ui.setPowerUpState({
      inventory:          { ...this.powerups.inventory },
      slowTimeActive:     this.powerups.isSlowTimeActive,
      slowTimeRemaining:  this.powerups.slowTimeRemaining,
      streakShieldActive: this.powerups.streakShieldActive,
      secondChancePrice:  this.powerups.nextSecondChancePrice,
      canBuySecondChance: this.powerups.canBuySecondChance,
      secondChancesUsed:  this.powerups.secondChancesUsed,
      assistsSummary:     this.powerups.getAssistsSummary(),
    });
  }

  _openShop() {
    this._syncPowerUpState();
    this.ui.setScreen('shop');
  }

  // ── Round lifecycle ────────────────────────────────────────────────────────

  _startRound(mode) {
    if (this._clutchTimer) {
      clearTimeout(this._clutchTimer);
      this._clutchTimer = null;
    }

    this.mode = mode;
    this.scoring.reset();
    this.powerups.startNewRun();
    this._syncPowerUpState();

    this.engine.reset();

    const seed = mode === 'daily' ? dailySeed() : practiceSeed();
    const rand = makeRng(seed);

    this.spawn = new SpawnManager(rand, this.engine);
    this.spawn.start();

    this.ui.setScreen('game');
    this.engine.start();
    this._updateHUD();
  }

  _onShoot() {
    this.audio.playShoot();
    const over = this.scoring.onShoot();
    this._updateHUD();
    if (over) {
      // Last rock fired: give 2.5s for it to hit/miss before entering clutch check
      if (this._clutchTimer) clearTimeout(this._clutchTimer);
      this._clutchTimer = setTimeout(() => this._checkClutchOrEnd(), 2500);
    }
  }

  _onHit(tier) {
    const { points, bonus, comboText } = this.scoring.onHit(tier);
    this.audio.playHit(tier.id);
    if (this.scoring.combo >= 2) this.audio.playCombo(this.scoring.combo);

    const flashX = 50 + (Math.random() - 0.5) * 16;
    const flashY = 70;
    const comboLabel = bonus > 0 ? `+${points} STREAK BONUS!` : comboText ? `+${points} (${comboText})` : `+${points}`;
    this.ui.addFlash(comboLabel, flashX, flashY, this.engine.ppu, this.engine.offX, this.engine.offY);

    this._updateHUD();
    if (this.scoring.roundOver && this.engine.rocks.length === 0) {
      this._checkClutchOrEnd();
    }
  }

  _onMiss() {
    const protectedByShield = this.powerups.protectMiss();
    if (protectedByShield) {
      this.audio.playCombo(3);
      this.ui.addFlash('🛡 Streak Shielded!', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
    } else {
      this.audio.playMiss();
    }

    this.scoring.onMiss(protectedByShield);
    this._syncPowerUpState();
    this._updateHUD();

    if (this.scoring.roundOver && this.engine.rocks.length === 0) {
      this._checkClutchOrEnd();
    }
  }

  // Offer Second Chance if rocks ran out and player hasn't capped out
  _checkClutchOrEnd() {
    if (this._clutchTimer) {
      clearTimeout(this._clutchTimer);
      this._clutchTimer = null;
    }

    if (this._roundEnded || this.scoring.rocksLeft > 0) return;

    if (this.powerups.canBuySecondChance && this.engine.shotsFired < MAX_TOTAL_SHOTS) {
      this.engine.stop();
      this._syncPowerUpState();
      this.ui.setScreen('clutch');
    } else {
      this._finalizeRound();
    }
  }

  _finalizeRound() {
    if (this._roundEnded) return;
    this._roundEnded = true;

    this.engine.stop();
    this.spawn?.stop();
    this.spawn = null;
    this.audio.playRoundEnd();

    const summary = this.scoring.summary();
    const key = this.mode === 'daily' ? BEST_KEY_DAILY : BEST_KEY_PRACTICE;
    const prev = this._getBest(key);
    summary.isPersonalBest = summary.score > prev;
    if (summary.isPersonalBest) this._saveBest(key, summary.score);

    // Submit score to platform
    if (this.live) this.sdk.submitScore(summary.score);

    this._syncPowerUpState();
    this.ui.setResults(summary);
    this.ui.setScreen('results');

    this._roundEnded = false;
  }

  // ── Power-Up In-Game Actions ───────────────────────────────────────────────

  _activateSlowTime() {
    if (this.powerups.activateSlowTime()) {
      this.audio.playTap();
      this.ui.addFlash('🐢 Slow Time Active (4s)!', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
      this._syncPowerUpState();
    }
  }

  _activateInGameAssist(type) {
    if (type === 'shield' && this.powerups.activateStreakShield()) {
      this.audio.playTap();
      this.ui.addFlash('🛡 Shield Active!', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
      this._syncPowerUpState();
    }
  }

  // ── Purchase Handlers ──────────────────────────────────────────────────────

  async _handleProductPurchase(productId) {
    try {
      this.ui.addFlash('Connecting to Vatar Store…', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
      const res = await this.sdk.purchase(productId);
      if (res?.success) {
        this.audio.playCombo(4);
        this.powerups.grantItem(productId, 1);
        this._syncPowerUpState();
        this.ui.addFlash(`🎉 ${PRODUCTS[productId]?.name || 'Item'} Delivered!`, 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      this.ui.addFlash('Purchase cancelled', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
    }
  }

  async _handleSecondChancePurchase() {
    try {
      const price = this.powerups.nextSecondChancePrice;
      const tierId = `second_chance_${this.powerups.secondChancesUsed + 1}`;
      this.ui.addFlash(`Purchasing Second Chance (₦${price})…`, 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);

      const res = await this.sdk.purchase(tierId);
      if (res?.success) {
        this.audio.playCombo(5);
        this.powerups.recordSecondChanceDelivered();
        this.scoring.addRocks(1);
        this._syncPowerUpState();
        this.ui.addFlash('⚡ +1 Stone Granted! Resuming Run', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);

        this.ui.setScreen('game');
        this.engine.start();
        this._updateHUD();
      }
    } catch (err) {
      console.error('Second chance purchase failed:', err);
      this.ui.addFlash('Purchase cancelled', 50, 90, this.engine.ppu, this.engine.offX, this.engine.offY);
    }
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
    if (this.spawn !== null && this.ui.screen === 'game') {
      this.ui.setScreen('paused');
    }
  }

  _resume() {
    if (this.spawn !== null && this.scoring.rocksLeft > 0 && !this.scoring.roundOver) {
      this.engine.start();
      this.spawn.running = true;
      this.ui.setScreen('game');
    } else {
      this.ui.setScreen('start');
    }
  }

  _updateHUD() {
    this.ui.setHUD({
      rocksLeft:  this.scoring.rocksLeft,
      score:      this.scoring.score,
      multiplier: this.scoring.multiplier,
      streak:     this.scoring.combo,
      mode:       this.mode,
    });
  }

  _getBest(key) {
    try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; }
    catch (_) { return 0; }
  }

  _saveBest(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (_) {}
  }

  _resize() {
    const dpr  = window.devicePixelRatio || 1;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    this.canvas.width  = Math.round(vw * dpr);
    this.canvas.height = Math.round(vh * dpr);
    this.canvas.style.width  = `${vw}px`;
    this.canvas.style.height = `${vh}px`;
    this.engine.resize();
  }

  // ── Unified Authoritative Rendering & Tick Loop ────────────────────────────
  _startLoop() {
    this._lastT = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - this._lastT) / 1000, 0.1);
      this._lastT = now;

      // 1. Update power-up timers
      this.powerups.update(dt);
      if (this.powerups.isSlowTimeActive) {
        this._syncPowerUpState();
      }

      // 2. Update bottle spawning
      if (this.spawn && this.engine.running) {
        this.spawn.update(dt, this.powerups.slowFactor);
      }

      // 3. Update physics in engine
      if (this.engine.running) {
        this.engine.update(dt);
      }

      // 4. Update UI flashes
      this.ui.update(dt);

      // 5. Coordinated deterministic frame rendering:
      // (a) Clear canvas
      this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
      // (b) Render game environment, bottles, slingshot, projectiles & effects
      this.engine.render();
      // (c) Render UI overlay (menus, HUD, modals)
      this.ui.render();

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}
