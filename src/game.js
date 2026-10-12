/**
 * game.js – top-level game controller.
 *
 * Wires together: Engine, SpawnManager, Scoring, AudioEngine, UI, PowerUpManager, and SDK.
 * Manages state transitions: start ↔ shop ↔ playing ↔ clutch ↔ results ↔ leaderboard.
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

    // RAF loop
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
    this._syncPowerUpState();

    // Register platform pause/resume
    sdk.onPause(()  => this._pause());
    sdk.onResume(() => this._resume());

    // Show start screen
    this.ui.setScreen('start');
    this._startLoop();
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
    this.mode = mode;
    this.scoring.reset();
    this.powerups.startNewRun(); // Start new run with unique runId and clean Second Chance tier
    this._syncPowerUpState();

    this.engine.rocks      = [];
    this.engine.bottles    = [];
    this.engine.particles  = [];
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
    if (over) {
      // Last rock fired: give 2.5s for it to hit/miss before entering clutch check
      setTimeout(() => this._checkClutchOrEnd(), 2500);
    }
  }

  _onHit(tier) {
    const { points, bonus, comboText } = this.scoring.onHit(tier);
    this.audio.playHit(tier.id);
    if (this.scoring.combo >= 2) this.audio.playCombo(this.scoring.combo);

    const flashX = 50 + (Math.random() - 0.5) * 20;
    const flashY = 80;
    const comboLabel = bonus > 0 ? `+${points} BONUS!` : comboText ? `+${points} ${comboText}` : `+${points}`;
    this.ui.addFlash(comboLabel, flashX, flashY, this.engine.ppu, this.engine.offX, this.engine.offY);

    this._updateHUD();
    if (this.scoring.roundOver && this.engine.rocks.length === 0) {
      this._checkClutchOrEnd();
    }
  }

  _onMiss() {
    // Check if Streak Shield protects this miss
    const protectedByShield = this.powerups.protectMiss();
    if (protectedByShield) {
      this.audio.playCombo(3);
      this.ui.addFlash('🛡 Streak Shielded!', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
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
      this.ui.addFlash('🐢 Slow Time Active (4s)!', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
      this._syncPowerUpState();
    }
  }

  _activateInGameAssist(type) {
    if (type === 'shield' && this.powerups.activateStreakShield()) {
      this.audio.playTap();
      this.ui.addFlash('🛡 Shield Ready!', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
      this._syncPowerUpState();
    }
  }

  // ── Purchase Handlers ──────────────────────────────────────────────────────

  async _handleProductPurchase(productId) {
    try {
      this.ui.addFlash('Contacting Vatar Store…', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
      const res = await this.sdk.purchase(productId);
      if (res?.success) {
        this.audio.playCombo(4);
        this.powerups.grantItem(productId, 1);
        this._syncPowerUpState();
        this.ui.addFlash(`🎉 ${PRODUCTS[productId]?.name || 'Item'} Delivered!`, 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      this.ui.addFlash('Purchase cancelled', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
    }
  }

  async _handleSecondChancePurchase() {
    try {
      const price = this.powerups.nextSecondChancePrice;
      const tierId = `second_chance_${this.powerups.secondChancesUsed + 1}`;
      this.ui.addFlash(`Purchasing Second Chance (₦${price})…`, 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);

      // Trigger purchase via Vatar SDK
      const res = await this.sdk.purchase(tierId);
      if (res?.success) {
        this.audio.playCombo(5);
        this.powerups.recordSecondChanceDelivered();
        this.scoring.addRocks(1); // grant 1 extra shot
        this._syncPowerUpState();
        this.ui.addFlash('⚡ +1 Shot Granted! Back to Game', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);

        // Resume active gameplay
        this.ui.setScreen('game');
        this.engine.start();
        this._updateHUD();
      }
    } catch (err) {
      console.error('Second chance purchase failed:', err);
      this.ui.addFlash('Purchase cancelled', 50, 100, this.engine.ppu, this.engine.offX, this.engine.offY);
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
    this.audio.mute();
    if (this.spawn !== null && this.ui.screen === 'game') {
      this.ui.setScreen('paused');
    }
  }

  _resume() {
    if (this.spawn !== null && this.scoring.rocksLeft > 0 && !this.scoring.roundOver) {
      this.engine.start();
      this.spawn.running = true;
      this.audio.unmute();
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
    this.canvas.width  = vw  * dpr;
    this.canvas.height = vh  * dpr;
    this.canvas.style.width  = `${vw}px`;
    this.canvas.style.height = `${vh}px`;
    this.engine.resize();
  }

  _startLoop() {
    this._lastT = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - this._lastT) / 1000, 0.1);
      this._lastT = now;

      // Update power-up timers (Slow Time countdown)
      this.powerups.update(dt);
      if (this.powerups.isSlowTimeActive) {
        this._syncPowerUpState();
      }

      // Update spawn manager with slowFactor applied
      if (this.spawn && this.engine.running) {
        this.spawn.update(dt, this.powerups.slowFactor);
      }

      // Update UI (flash texts) & render overlay
      this.ui.update(dt);
      this.ui.render();

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }
}
