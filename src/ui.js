/**
 * ui.js – Canvas overlay renderer for all screens.
 *
 * Handles:
 *   - Start screen (Daily Challenge / Practice / Power-Up Shop)
 *   - Shop screen (Consumables: Slow Time, Bonus Stones, Streak Shield)
 *   - HUD (rocks left, score, combo, streak, Slow Time button, Shield status)
 *   - Clutch screen (Second Chance offer with escalating price & Finish Run choice)
 *   - Results screen (score, accuracy, streak, assists disclosure, play again)
 *   - Leaderboard overlay
 *   - Pause overlay
 */

import { TOTAL_ROCKS, CLR_UI_BG, CLR_UI_TEXT, CLR_ACCENT, PRODUCTS } from './constants.js';

export default class UI {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.screen = 'start';  // 'start' | 'game' | 'shop' | 'clutch' | 'results' | 'leaderboard' | 'paused'

    // Callbacks set by Game
    this.onDailyChallenge  = () => {};
    this.onPractice        = () => {};
    this.onRematch         = () => {};
    this.onLeaderboard     = () => {};
    this.onResume          = () => {};
    this.onOpenShop        = () => {};
    this.onCloseShop       = () => {};
    this.onBuyProduct      = (id) => {};
    this.onUseSlowTime     = () => {};
    this.onUseBonusStones  = () => {};
    this.onBuySecondChance = () => {};
    this.onDeclineSecondChance = () => {};

    // Data passed in
    this.hud             = { rocksLeft: TOTAL_ROCKS, score: 0, combo: 0, multiplier: 1, streak: 0 };
    this.results         = null;
    this.player          = { name: 'Player', avatar: null };
    this.bestDaily       = 0;
    this.leaderboardData = null;

    // Power-up state passed from PowerUpManager
    this.powerUpState = {
      inventory: {},
      slowTimeActive: false,
      slowTimeRemaining: 0,
      streakShieldActive: false,
      secondChancePrice: 500,
      canBuySecondChance: true,
      secondChancesUsed: 0,
      assistsSummary: { hasAssists: false, list: [], tag: '🎯 Pure Run' },
    };

    // Hit flash text
    this._flashes = [];   // [{ text, x, y, life, maxLife }]

    this._buttons = [];   // clickable regions for current screen
    this.canvas.addEventListener('pointerdown', (e) => this._handleClick(e));
  }

  // ── Public setters ─────────────────────────────────────────────────────────

  setScreen(name)        { this.screen = name; this._buttons = []; }
  setHUD(data)           { Object.assign(this.hud, data); }
  setResults(r)          { this.results = r; }
  setPlayer(p)           { this.player  = p; }
  setBestDaily(n)        { this.bestDaily = n; }
  setLeaderboard(d)      { this.leaderboardData = d; }
  setPowerUpState(state) { Object.assign(this.powerUpState, state); }

  addFlash(text, worldX, worldY, ppu, offX, offY) {
    const px = offX + worldX * ppu;
    const py = offY + worldY * ppu;
    this._flashes.push({ text, x: px, y: py, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    this._flashes = this._flashes.filter(f => { f.life -= dt; return f.life > 0; });
  }

  // ── Main render ────────────────────────────────────────────────────────────

  render() {
    switch (this.screen) {
      case 'start':       this._renderStart();        break;
      case 'game':        this._renderHUD();          break;
      case 'shop':        this._renderShop();         break;
      case 'clutch':      this._renderClutch();       break;
      case 'results':     this._renderResults();      break;
      case 'leaderboard': this._renderLeaderboard();  break;
      case 'paused':      this._renderPaused();       break;
    }
    this._renderFlashes();
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  _renderStart() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    // Dark overlay
    ctx.fillStyle = 'rgba(10,10,20,0.88)';
    ctx.fillRect(0, 0, cw, ch);

    // Title
    ctx.fillStyle = CLR_ACCENT;
    ctx.font      = `bold ${Math.round(cw * 0.14)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LONG SHOT', cw / 2, ch * 0.20);

    ctx.fillStyle = '#aaa';
    ctx.font      = `${Math.round(cw * 0.042)}px sans-serif`;
    ctx.fillText('Slingshot Arcade · Lagos Life', cw / 2, ch * 0.255);

    // Best daily score
    if (this.bestDaily > 0) {
      ctx.fillStyle = '#fff8';
      ctx.font = `${Math.round(cw * 0.038)}px sans-serif`;
      ctx.fillText(`Best today: ${this.bestDaily}`, cw / 2, ch * 0.30);
    }

    // Buttons
    const btnW = cw * 0.72, btnH = ch * 0.072;
    const dailyY = ch * 0.37;
    const practY = ch * 0.47;
    const shopY  = ch * 0.57;
    const lbY    = ch * 0.67;

    this._drawButton(cw / 2 - btnW / 2, dailyY, btnW, btnH, '📅  Daily Challenge', CLR_ACCENT, '#000');
    this._registerButton(cw / 2 - btnW / 2, dailyY, btnW, btnH, () => this.onDailyChallenge());

    this._drawButton(cw / 2 - btnW / 2, practY, btnW, btnH, '🎯  Practice', '#4caf50', '#fff');
    this._registerButton(cw / 2 - btnW / 2, practY, btnW, btnH, () => this.onPractice());

    this._drawButton(cw / 2 - btnW / 2, shopY, btnW, btnH, '🛍️  Power-Up Shop', '#9c27b0', '#fff');
    this._registerButton(cw / 2 - btnW / 2, shopY, btnW, btnH, () => this.onOpenShop());

    this._drawButton(cw / 2 - btnW / 2, lbY, btnW, btnH, '🏆  Leaderboard', '#1565c0', '#fff');
    this._registerButton(cw / 2 - btnW / 2, lbY, btnW, btnH, () => this.onLeaderboard());

    // Rules hint
    ctx.fillStyle = '#666';
    ctx.font      = `${Math.round(cw * 0.033)}px sans-serif`;
    ctx.fillText('Drag back the slingshot · Release to fire', cw / 2, ch * 0.81);
    ctx.fillText('15 rocks standard · Hit bottles to score', cw / 2, ch * 0.85);
  }

  _renderShop() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    ctx.fillStyle = CLR_UI_BG;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = CLR_ACCENT;
    ctx.font      = `bold ${Math.round(cw * 0.08)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🛍️ Power-Up Shop', cw / 2, ch * 0.10);

    ctx.fillStyle = '#aaa';
    ctx.font      = `${Math.round(cw * 0.036)}px sans-serif`;
    ctx.fillText('Use in Practice & Daily · Assist tracked', cw / 2, ch * 0.14);

    const items = [
      { id: 'slow_time',      prod: PRODUCTS.slow_time },
      { id: 'bonus_stones_3', prod: PRODUCTS.bonus_stones_3 },
      { id: 'streak_shield',  prod: PRODUCTS.streak_shield },
    ];

    const cardW = cw * 0.86;
    const cardH = ch * 0.16;
    const startY = ch * 0.18;

    items.forEach((item, index) => {
      const p = item.prod;
      const count = this.powerUpState.inventory[item.id] || 0;
      const y = startY + index * (cardH + ch * 0.02);

      // Card background
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(cw / 2 - cardW / 2, y, cardW, cardH, 12);
      ctx.fill();

      // Emoji & Name
      ctx.fillStyle = '#fff';
      ctx.font      = `bold ${Math.round(cw * 0.046)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`${p.emoji} ${p.name}`, cw / 2 - cardW / 2 + 16, y + cardH * 0.32);

      // Inventory badge
      ctx.fillStyle = count > 0 ? '#4caf50' : '#888';
      ctx.font      = `bold ${Math.round(cw * 0.034)}px sans-serif`;
      ctx.fillText(`Owned: ${count}`, cw / 2 - cardW / 2 + 16, y + cardH * 0.54);

      // Description
      ctx.fillStyle = '#aaa';
      ctx.font      = `${Math.round(cw * 0.032)}px sans-serif`;
      ctx.fillText(p.desc, cw / 2 - cardW / 2 + 16, y + cardH * 0.80);

      // Buy button on right
      const buyBtnW = cardW * 0.34;
      const buyBtnH = cardH * 0.44;
      const buyX = cw / 2 + cardW / 2 - buyBtnW - 12;
      const buyY = y + cardH * 0.28;

      this._drawButton(buyX, buyY, buyBtnW, buyBtnH, `Buy ₦${p.price}`, CLR_ACCENT, '#000');
      this._registerButton(buyX, buyY, buyBtnW, buyBtnH, () => this.onBuyProduct(item.id));
    });

    // Close button
    const closeBtnW = cw * 0.6;
    const closeBtnH = ch * 0.065;
    const closeY = ch * 0.86;
    this._drawButton(cw / 2 - closeBtnW / 2, closeY, closeBtnW, closeBtnH, '← Back to Menu', '#333', '#fff');
    this._registerButton(cw / 2 - closeBtnW / 2, closeY, closeBtnW, closeBtnH, () => this.onCloseShop());
  }

  _renderHUD() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const { rocksLeft, score, multiplier, streak } = this.hud;
    this._buttons = [];

    // Top bar background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cw, ch * 0.085);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${Math.round(cw * 0.06)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(score, cw * 0.04, ch * 0.062);

    // Multiplier
    if (multiplier > 1) {
      ctx.fillStyle = CLR_ACCENT;
      ctx.font      = `bold ${Math.round(cw * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`×${multiplier.toFixed(2)}`, cw * 0.5, ch * 0.062);
    }

    // Rocks left (right side)
    ctx.fillStyle = '#fff';
    ctx.font      = `${Math.round(cw * 0.042)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`🪨 ${rocksLeft}`, cw * 0.96, ch * 0.062);

    // Streak indicator (flame)
    if (streak >= 3) {
      ctx.fillStyle = '#ff5722';
      ctx.font      = `bold ${Math.round(cw * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 ${streak}`, cw * 0.5, ch * 0.115);
    }

    // ── In-Game Power-Up Shortcuts ───────────────────────────────────────────
    const slowCount = this.powerUpState.inventory.slow_time || 0;
    const shieldActive = this.powerUpState.streakShieldActive;
    const shieldCount = this.powerUpState.inventory.streak_shield || 0;
    const isSlow = this.powerUpState.slowTimeActive;

    // Slow Time Button / Active Status Bar
    const slowBtnW = cw * 0.38;
    const slowBtnH = ch * 0.048;
    const slowX = cw * 0.04;
    const slowY = ch * 0.095;

    if (isSlow) {
      // Pulsing active bar
      ctx.fillStyle = 'rgba(0, 188, 212, 0.85)';
      ctx.beginPath();
      ctx.roundRect(slowX, slowY, slowBtnW, slowBtnH, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(cw * 0.034)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`🐢 Slow ${this.powerUpState.slowTimeRemaining.toFixed(1)}s`, slowX + slowBtnW / 2, slowY + slowBtnH * 0.68);
    } else {
      const bgCol = slowCount > 0 ? '#00838f' : 'rgba(255,255,255,0.15)';
      const textCol = slowCount > 0 ? '#fff' : '#888';
      this._drawButton(slowX, slowY, slowBtnW, slowBtnH, `🐢 Slow (${slowCount})`, bgCol, textCol);
      if (slowCount > 0) {
        this._registerButton(slowX, slowY, slowBtnW, slowBtnH, () => this.onUseSlowTime());
      }
    }

    // Streak Shield Badge / Activation button
    const shieldW = cw * 0.38;
    const shieldH = ch * 0.048;
    const shieldX = cw * 0.58;
    const shieldY = ch * 0.095;

    if (shieldActive) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
      ctx.beginPath();
      ctx.roundRect(shieldX, shieldY, shieldW, shieldH, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(cw * 0.034)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🛡 Shield ON', shieldX + shieldW / 2, shieldY + shieldH * 0.68);
    } else if (shieldCount > 0) {
      this._drawButton(shieldX, shieldY, shieldW, shieldH, `🛡 Use Shield (${shieldCount})`, '#2e7d32', '#fff');
      this._registerButton(shieldX, shieldY, shieldW, shieldH, () => this.onUseBonusStones('shield'));
    }
  }

  // ── Clutch Screen: Second Chance Offer ───────────────────────────────────────
  _renderClutch() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    // Dark backdrop
    ctx.fillStyle = 'rgba(10,10,25,0.92)';
    ctx.fillRect(0, 0, cw, ch);

    // Title
    ctx.fillStyle = CLR_ACCENT;
    ctx.font      = `bold ${Math.round(cw * 0.09)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ SECOND CHANCE', cw / 2, ch * 0.22);

    ctx.fillStyle = '#ddd';
    ctx.font      = `${Math.round(cw * 0.042)}px sans-serif`;
    ctx.fillText('Standard ammo exhausted!', cw / 2, ch * 0.29);

    // Explanation & transparent price escalation disclosure
    ctx.fillStyle = '#aaa';
    ctx.font      = `${Math.round(cw * 0.036)}px sans-serif`;
    ctx.fillText('Get 1 extra shot to extend your run.', cw / 2, ch * 0.36);
    ctx.fillText('Price increases with each Second Chance in this run.', cw / 2, ch * 0.40);

    const price = this.powerUpState.secondChancePrice;
    const tierNum = this.powerUpState.secondChancesUsed + 1;
    const canBuy = this.powerUpState.canBuySecondChance;

    if (canBuy) {
      // Price badge
      ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
      ctx.beginPath();
      ctx.roundRect(cw * 0.15, ch * 0.46, cw * 0.7, ch * 0.08, 12);
      ctx.fill();

      ctx.fillStyle = CLR_ACCENT;
      ctx.font      = `bold ${Math.round(cw * 0.052)}px sans-serif`;
      ctx.fillText(`Next price (Use ${tierNum}/4): ₦${price}`, cw / 2, ch * 0.515);

      // Buy button
      const btnW = cw * 0.76;
      const btnH = ch * 0.075;
      const buyY = ch * 0.59;
      this._drawButton(cw / 2 - btnW / 2, buyY, btnW, btnH, `⚡ Buy for ₦${price}`, CLR_ACCENT, '#000');
      this._registerButton(cw / 2 - btnW / 2, buyY, btnW, btnH, () => this.onBuySecondChance());
    } else {
      ctx.fillStyle = '#ff5252';
      ctx.font      = `bold ${Math.round(cw * 0.045)}px sans-serif`;
      ctx.fillText('Maximum 4 Second Chances reached for this run.', cw / 2, ch * 0.48);
    }

    // Equal "Finish Run" button
    const finishW = cw * 0.76;
    const finishH = ch * 0.075;
    const finishY = ch * 0.71;
    this._drawButton(cw / 2 - finishW / 2, finishY, finishW, finishH, '🏁 Finish Run & View Results', '#444', '#fff');
    this._registerButton(cw / 2 - finishW / 2, finishY, finishW, finishH, () => this.onDeclineSecondChance());
  }

  _renderResults() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const r  = this.results || {};
    this._buttons = [];

    ctx.fillStyle = CLR_UI_BG;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = CLR_ACCENT;
    ctx.font      = `bold ${Math.round(cw * 0.09)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Round Over!', cw / 2, ch * 0.12);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${Math.round(cw * 0.14)}px "Segoe UI", sans-serif`;
    ctx.fillText(r.score || 0, cw / 2, ch * 0.24);

    // Assists tag
    const assistSummary = this.powerUpState.assistsSummary || { hasAssists: false, tag: '🎯 Pure Run' };
    ctx.fillStyle = assistSummary.hasAssists ? '#ffd54f' : '#81c784';
    ctx.font      = `bold ${Math.round(cw * 0.038)}px sans-serif`;
    ctx.fillText(assistSummary.tag, cw / 2, ch * 0.29);

    // Stats grid
    const stats = [
      ['Accuracy',    `${r.accuracy || 0}%`],
      ['Best Streak', `${r.bestStreak || 0} hits`],
      ['Hits / Misses', `${r.hits || 0} / ${r.misses || 0}`],
    ];
    ctx.font = `${Math.round(cw * 0.038)}px sans-serif`;
    stats.forEach(([label, val], i) => {
      const y = ch * (0.34 + i * 0.055);
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'left';
      ctx.fillText(label, cw * 0.12, y);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(val, cw * 0.88, y);
    });

    // Assists breakdown if used
    if (assistSummary.hasAssists && assistSummary.list?.length > 0) {
      ctx.fillStyle = '#888';
      ctx.font      = `${Math.round(cw * 0.032)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`Assists used: ${assistSummary.list.join(' · ')}`, cw / 2, ch * 0.54);
    }

    // Personal best notice
    if (r.isPersonalBest) {
      ctx.fillStyle = CLR_ACCENT;
      ctx.font      = `bold ${Math.round(cw * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🏆 New Personal Best!', cw / 2, ch * 0.60);
    }

    // Buttons
    const btnW = cw * 0.72, btnH = ch * 0.07;
    const rematchY = ch * 0.68;
    const lbY      = ch * 0.77;
    const shopY    = ch * 0.86;

    this._drawButton(cw / 2 - btnW / 2, rematchY, btnW, btnH, '🔁  Play Again', CLR_ACCENT, '#000');
    this._registerButton(cw / 2 - btnW / 2, rematchY, btnW, btnH, () => this.onRematch());

    this._drawButton(cw / 2 - btnW / 2, lbY, btnW, btnH, '🏆  Leaderboard', '#1565c0', '#fff');
    this._registerButton(cw / 2 - btnW / 2, lbY, btnW, btnH, () => this.onLeaderboard());

    this._drawButton(cw / 2 - btnW / 2, shopY, btnW, btnH, '🛍️  Power-Up Shop', '#9c27b0', '#fff');
    this._registerButton(cw / 2 - btnW / 2, shopY, btnW, btnH, () => this.onOpenShop());
  }

  _renderLeaderboard() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    ctx.fillStyle = CLR_UI_BG;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = CLR_ACCENT;
    ctx.font      = `bold ${Math.round(cw * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🏆 Leaderboard', cw / 2, ch * 0.1);

    const entries = this.leaderboardData?.entries || [];
    if (entries.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = `${Math.round(cw * 0.045)}px sans-serif`;
      ctx.fillText('No scores yet. Be first!', cw / 2, ch * 0.5);
    } else {
      entries.slice(0, 10).forEach((e, i) => {
        const y = ch * (0.18 + i * 0.065);
        const isMe = e.playerId === this.player?.id;
        ctx.fillStyle = isMe ? CLR_ACCENT : (i < 3 ? '#fff' : '#aaa');
        ctx.font = `${isMe ? 'bold ' : ''}${Math.round(cw * 0.038)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}. ${e.name}`, cw * 0.08, y);
        ctx.textAlign = 'right';
        ctx.fillText(e.score, cw * 0.92, y);
      });
    }

    // Back button
    const btnW = cw * 0.5, btnH = ch * 0.07;
    const backY = ch * 0.88;
    this._drawButton(cw / 2 - btnW / 2, backY, btnW, btnH, '← Back', '#333', '#fff');
    this._registerButton(cw / 2 - btnW / 2, backY, btnW, btnH, () => this.onRematch());
  }

  _renderPaused() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${Math.round(cw * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Paused', cw / 2, ch * 0.42);

    const btnW = cw * 0.5, btnH = ch * 0.07;
    const resumeY = ch * 0.55;
    this._drawButton(cw / 2 - btnW / 2, resumeY, btnW, btnH, '▶ Resume', CLR_ACCENT, '#000');
    this._registerButton(cw / 2 - btnW / 2, resumeY, btnW, btnH, () => this.onResume());
  }

  _renderFlashes() {
    const { ctx } = this;
    for (const f of this._flashes) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle   = CLR_ACCENT;
      ctx.font        = `bold ${Math.round(this.canvas.width * 0.05)}px sans-serif`;
      ctx.textAlign   = 'center';
      const drift = (1 - f.life / f.maxLife) * 20;
      ctx.fillText(f.text, f.x, f.y - drift);
    }
    ctx.globalAlpha = 1;
  }

  // ── Button helpers ─────────────────────────────────────────────────────────

  _drawButton(x, y, w, h, label, bg, fg) {
    const { ctx } = this;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h * 0.25);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font      = `bold ${Math.round(h * 0.42)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h * 0.65);
  }

  _registerButton(x, y, w, h, callback) {
    this._buttons.push({ x, y, w, h, callback });
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const bx = (clientX - rect.left) * scaleX;
    const by = (clientY - rect.top) * scaleY;

    for (const btn of this._buttons) {
      if (bx >= btn.x && bx <= btn.x + btn.w && by >= btn.y && by <= btn.y + btn.h) {
        btn.callback();
        break;
      }
    }
  }
}
