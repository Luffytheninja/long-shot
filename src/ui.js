/**
 * ui.js – Canvas overlay renderer for all screens.
 *
 * Implements Lagos street wooden visual identity:
 *   - Chunky Danfo display typography & Zilla Slab body text.
 *   - Compact 15-rock indicator grid.
 *   - High-contrast score, combo streak, mode indicator.
 *   - Dedicated sound toggle with persistent mute state.
 *   - Wooden signboard UI buttons & modals.
 */

import { TOTAL_ROCKS, PRODUCTS } from './constants.js';
import { THEME, drawWoodButton } from './woodTheme.js';

export default class UI {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.screen = 'start';  // 'start' | 'game' | 'shop' | 'clutch' | 'results' | 'leaderboard' | 'paused'

    // Callbacks set by Game
    this.onDailyChallenge      = () => {};
    this.onPractice            = () => {};
    this.onRematch             = () => {};
    this.onLeaderboard         = () => {};
    this.onResume              = () => {};
    this.onOpenShop            = () => {};
    this.onCloseShop           = () => {};
    this.onBuyProduct          = (id) => {};
    this.onUseSlowTime         = () => {};
    this.onUseBonusStones      = () => {};
    this.onBuySecondChance     = () => {};
    this.onDeclineSecondChance = () => {};
    this.onToggleSound         = () => {};

    // Data passed in
    this.hud             = { rocksLeft: TOTAL_ROCKS, score: 0, combo: 0, multiplier: 1, streak: 0, mode: 'daily' };
    this.results         = null;
    this.player          = { name: 'Player', avatar: null };
    this.bestDaily       = 0;
    this.leaderboardData = null;
    this.soundMuted      = false;

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
  setSoundMuted(muted)   { this.soundMuted = muted; }

  addFlash(text, worldX, worldY, ppu, offX, offY) {
    const px = offX + worldX * ppu;
    const py = offY + worldY * ppu;
    this._flashes.push({ text, x: px, y: py, life: 1.0, maxLife: 1.0 });
  }

  update(dt) {
    this._flashes = this._flashes.filter(f => { f.life -= dt; return f.life > 0; });
  }

  // ── Main render (overlays above game scene) ────────────────────────────────

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

    // Warm dusk translucent wooden scrim
    ctx.fillStyle = 'rgba(18, 12, 24, 0.88)';
    ctx.fillRect(0, 0, cw, ch);

    // Decorative wooden banner behind title
    const bannerW = cw * 0.88;
    const bannerH = ch * 0.16;
    const bannerX = cw / 2 - bannerW / 2;
    const bannerY = ch * 0.10;

    ctx.fillStyle = 'rgba(78, 46, 24, 0.9)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12);
    ctx.fill();
    ctx.strokeStyle = THEME.danfoYellow;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Title in Danfo typography
    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.13)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText('LONG SHOT', cw / 2, bannerY + bannerH * 0.58);

    ctx.fillStyle = '#ffeedd';
    ctx.font      = `600 ${Math.round(cw * 0.04)}px ${THEME.fontBody}`;
    ctx.fillText('Lagos Street Bottle-Shooting Arcade', cw / 2, bannerY + bannerH * 0.88);

    // Sound toggle at top right
    this._drawSoundToggle(cw * 0.84, ch * 0.03, cw * 0.12, cw * 0.12);

    // Best daily score badge
    if (this.bestDaily > 0) {
      ctx.fillStyle = 'rgba(245, 184, 0, 0.2)';
      ctx.beginPath();
      ctx.roundRect(cw * 0.25, ch * 0.28, cw * 0.5, ch * 0.045, 8);
      ctx.fill();

      ctx.fillStyle = THEME.danfoYellow;
      ctx.font = `bold ${Math.round(cw * 0.038)}px ${THEME.fontDisplay}`;
      ctx.fillText(`BEST TODAY: ${this.bestDaily}`, cw / 2, ch * 0.312);
    }

    // Menu Action Buttons (Wooden styled)
    const btnW = cw * 0.78, btnH = Math.min(ch * 0.075, 56);
    const dailyY = ch * 0.35;
    const practY = ch * 0.44;
    const shopY  = ch * 0.53;
    const lbY    = ch * 0.62;

    this._drawWoodBtn(cw / 2 - btnW / 2, dailyY, btnW, btnH, 'DAILY CHALLENGE', true, '📅');
    this._registerButton(cw / 2 - btnW / 2, dailyY, btnW, btnH, () => this.onDailyChallenge());

    this._drawWoodBtn(cw / 2 - btnW / 2, practY, btnW, btnH, 'PRACTICE WALL', false, '🎯');
    this._registerButton(cw / 2 - btnW / 2, practY, btnW, btnH, () => this.onPractice());

    this._drawWoodBtn(cw / 2 - btnW / 2, shopY, btnW, btnH, 'BOOST SHOP', false, '🛍️');
    this._registerButton(cw / 2 - btnW / 2, shopY, btnW, btnH, () => this.onOpenShop());

    this._drawWoodBtn(cw / 2 - btnW / 2, lbY, btnW, btnH, 'LAGOS LEADERBOARD', false, '🏆');
    this._registerButton(cw / 2 - btnW / 2, lbY, btnW, btnH, () => this.onLeaderboard());

    // Cultural street rules hint
    ctx.fillStyle = '#baa';
    ctx.font      = `italic ${Math.round(cw * 0.036)}px ${THEME.fontBody}`;
    ctx.fillText('Drag slingshot · 15 stones · Smash compound bottles', cw / 2, ch * 0.80);
    ctx.fillText('Pure runs earn clean bragging rights on the block.', cw / 2, ch * 0.84);
  }

  _renderShop() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    ctx.fillStyle = 'rgba(20, 14, 26, 0.94)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.08)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText('🛍️ BOOST SHOP', cw / 2, ch * 0.09);

    ctx.fillStyle = '#bbb';
    ctx.font      = `${Math.round(cw * 0.035)}px ${THEME.fontBody}`;
    ctx.fillText('All boosts are clearly disclosed on run results', cw / 2, ch * 0.13);

    const items = [
      { id: 'slow_time',      prod: PRODUCTS.slow_time },
      { id: 'bonus_stones_3', prod: PRODUCTS.bonus_stones_3 },
      { id: 'streak_shield',  prod: PRODUCTS.streak_shield },
    ];

    const cardW = cw * 0.88;
    const cardH = ch * 0.16;
    const startY = ch * 0.17;

    items.forEach((item, index) => {
      const p = item.prod;
      const count = this.powerUpState.inventory[item.id] || 0;
      const y = startY + index * (cardH + ch * 0.02);

      // Card background
      ctx.fillStyle = 'rgba(78, 46, 24, 0.65)';
      ctx.beginPath();
      ctx.roundRect(cw / 2 - cardW / 2, y, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = THEME.pine;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Emoji & Name
      ctx.fillStyle = THEME.danfoYellow;
      ctx.font      = `bold ${Math.round(cw * 0.048)}px ${THEME.fontDisplay}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${p.emoji} ${p.name}`, cw / 2 - cardW / 2 + 14, y + cardH * 0.32);

      // Inventory badge
      ctx.fillStyle = count > 0 ? '#4caf50' : '#888';
      ctx.font      = `bold ${Math.round(cw * 0.034)}px ${THEME.fontBody}`;
      ctx.fillText(`Owned: ${count}`, cw / 2 - cardW / 2 + 14, y + cardH * 0.54);

      // Description
      ctx.fillStyle = '#ddd';
      ctx.font      = `${Math.round(cw * 0.031)}px ${THEME.fontBody}`;
      ctx.fillText(p.desc, cw / 2 - cardW / 2 + 14, y + cardH * 0.80);

      // Buy button on right
      const buyBtnW = cardW * 0.34;
      const buyBtnH = cardH * 0.44;
      const buyX = cw / 2 + cardW / 2 - buyBtnW - 12;
      const buyY = y + cardH * 0.28;

      this._drawWoodBtn(buyX, buyY, buyBtnW, buyBtnH, `₦${p.price}`, true);
      this._registerButton(buyX, buyY, buyBtnW, buyBtnH, () => this.onBuyProduct(item.id));
    });

    // Close button
    const closeBtnW = cw * 0.64;
    const closeBtnH = ch * 0.065;
    const closeY = ch * 0.86;
    this._drawWoodBtn(cw / 2 - closeBtnW / 2, closeY, closeBtnW, closeBtnH, '← BACK TO WALL', false);
    this._registerButton(cw / 2 - closeBtnW / 2, closeY, closeBtnW, closeBtnH, () => this.onCloseShop());
  }

  // ── Redesigned Mobile Portrait Gameplay HUD ─────────────────────────────────
  _renderHUD() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const { rocksLeft, score, multiplier, streak, mode } = this.hud;
    this._buttons = [];

    // Compact Top HUD Header Panel (weathered wood/concrete bar)
    const hudH = ch * 0.095;
    const hudGrad = ctx.createLinearGradient(0, 0, 0, hudH);
    hudGrad.addColorStop(0, 'rgba(25, 16, 28, 0.92)');
    hudGrad.addColorStop(1, 'rgba(40, 26, 36, 0.85)');
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, cw, hudH);

    // Bottom gold accent line
    ctx.fillStyle = THEME.danfoYellow;
    ctx.fillRect(0, hudH - 2, cw, 2);

    // 1. Score (Chunky, legible Danfo typography on left)
    ctx.fillStyle = '#ffffff';
    ctx.font      = `bold ${Math.round(cw * 0.075)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${score}`, cw * 0.04, hudH * 0.62);

    // Mode label under score
    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.026)}px ${THEME.fontDisplay}`;
    ctx.fillText(mode === 'daily' ? 'DAILY MATCH' : 'PRACTICE', cw * 0.04, hudH * 0.86);

    // 2. Multiplier & Consecutive Hit Streak (Center)
    if (streak >= 2) {
      ctx.fillStyle = '#ff6d00';
      ctx.font      = `bold ${Math.round(cw * 0.042)}px ${THEME.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.fillText(`STREAK 🔥 ${streak}`, cw * 0.44, hudH * 0.48);

      ctx.fillStyle = THEME.danfoYellow;
      ctx.font      = `bold ${Math.round(cw * 0.034)}px ${THEME.fontDisplay}`;
      ctx.fillText(`×${multiplier.toFixed(2)} MULTIPLIER`, cw * 0.44, hudH * 0.82);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font      = `${Math.round(cw * 0.03)}px ${THEME.fontBody}`;
      ctx.textAlign = 'center';
      ctx.fillText('COMBO READY', cw * 0.44, hudH * 0.60);
    }

    // 3. Compact 15-Rock Indicator (Right)
    const rocksMax = TOTAL_ROCKS;
    const iconSize = Math.min(cw * 0.026, 12);
    const gridCols = 5;
    const gridRows = 3;
    const startRockX = cw * 0.68;
    const startRockY = hudH * 0.22;
    const stepX = iconSize * 1.5;
    const stepY = iconSize * 1.6;

    for (let i = 0; i < rocksMax; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const rx = startRockX + col * stepX;
      const ry = startRockY + row * stepY;

      ctx.beginPath();
      ctx.arc(rx, ry, iconSize * 0.45, 0, Math.PI * 2);
      if (i < rocksLeft) {
        // Available rock (stone brown with highlight)
        ctx.fillStyle = '#8d6e63';
        ctx.fill();
        ctx.strokeStyle = '#d7ccc8';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Spent rock (hollow ring)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 4. Sound Toggle (Top-right corner icon button)
    this._drawSoundToggle(cw * 0.90, hudH * 0.18, cw * 0.08, hudH * 0.64);

    // ── In-Game Assist Shortcuts (Subtle, lower side pills) ──
    const slowCount = this.powerUpState.inventory.slow_time || 0;
    const shieldActive = this.powerUpState.streakShieldActive;
    const shieldCount = this.powerUpState.inventory.streak_shield || 0;
    const isSlow = this.powerUpState.slowTimeActive;

    const assistY = hudH + ch * 0.012;
    const btnW = cw * 0.32;
    const btnH = ch * 0.042;

    // Slow Time indicator
    if (isSlow) {
      ctx.fillStyle = 'rgba(0, 188, 212, 0.9)';
      ctx.beginPath();
      ctx.roundRect(cw * 0.04, assistY, btnW, btnH, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(cw * 0.03)}px ${THEME.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.fillText(`🐢 SLOW ${this.powerUpState.slowTimeRemaining.toFixed(1)}s`, cw * 0.04 + btnW / 2, assistY + btnH * 0.66);
    } else if (slowCount > 0) {
      this._drawWoodBtn(cw * 0.04, assistY, btnW, btnH, `SLOW (${slowCount})`, false, '🐢');
      this._registerButton(cw * 0.04, assistY, btnW, btnH, () => this.onUseSlowTime());
    }

    // Shield status
    if (shieldActive) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.92)';
      ctx.beginPath();
      ctx.roundRect(cw * 0.64, assistY, btnW, btnH, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(cw * 0.03)}px ${THEME.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.fillText('🛡 SHIELD ON', cw * 0.64 + btnW / 2, assistY + btnH * 0.66);
    } else if (shieldCount > 0) {
      this._drawWoodBtn(cw * 0.64, assistY, btnW, btnH, `SHIELD (${shieldCount})`, false, '🛡');
      this._registerButton(cw * 0.64, assistY, btnW, btnH, () => this.onUseBonusStones('shield'));
    }
  }

  // ── Clutch Screen: Second Chance Offer ───────────────────────────────────────
  _renderClutch() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    // Dark backdrop
    ctx.fillStyle = 'rgba(15, 10, 20, 0.93)';
    ctx.fillRect(0, 0, cw, ch);

    // Title
    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.09)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡ SECOND CHANCE', cw / 2, ch * 0.22);

    ctx.fillStyle = '#ddd';
    ctx.font      = `600 ${Math.round(cw * 0.044)}px ${THEME.fontBody}`;
    ctx.fillText('Your 15 stones are finished!', cw / 2, ch * 0.28);

    ctx.fillStyle = '#aaa';
    ctx.font      = `${Math.round(cw * 0.034)}px ${THEME.fontBody}`;
    ctx.fillText('Take 1 extra stone to extend your streak.', cw / 2, ch * 0.35);
    ctx.fillText('Price increases with each Second Chance on this run.', cw / 2, ch * 0.39);

    const price = this.powerUpState.secondChancePrice;
    const tierNum = this.powerUpState.secondChancesUsed + 1;
    const canBuy = this.powerUpState.canBuySecondChance;

    if (canBuy) {
      // Price badge
      ctx.fillStyle = 'rgba(245, 184, 0, 0.18)';
      ctx.beginPath();
      ctx.roundRect(cw * 0.15, ch * 0.45, cw * 0.7, ch * 0.08, 10);
      ctx.fill();

      ctx.fillStyle = THEME.danfoYellow;
      ctx.font      = `bold ${Math.round(cw * 0.05)}px ${THEME.fontDisplay}`;
      ctx.fillText(`USE ${tierNum}/4 · ₦${price}`, cw / 2, ch * 0.505);

      // Buy button
      const btnW = cw * 0.76;
      const btnH = ch * 0.075;
      const buyY = ch * 0.58;
      this._drawWoodBtn(cw / 2 - btnW / 2, buyY, btnW, btnH, `BUY EXTRA STONE (₦${price})`, true, '⚡');
      this._registerButton(cw / 2 - btnW / 2, buyY, btnW, btnH, () => this.onBuySecondChance());
    } else {
      ctx.fillStyle = '#ff5252';
      ctx.font      = `bold ${Math.round(cw * 0.045)}px ${THEME.fontDisplay}`;
      ctx.fillText('Maximum 4 Second Chances used for this run.', cw / 2, ch * 0.48);
    }

    // Finish Run button
    const finishW = cw * 0.76;
    const finishH = ch * 0.075;
    const finishY = ch * 0.70;
    this._drawWoodBtn(cw / 2 - finishW / 2, finishY, finishW, finishH, 'FINISH RUN & VIEW RESULTS', false, '🏁');
    this._registerButton(cw / 2 - finishW / 2, finishY, finishW, finishH, () => this.onDeclineSecondChance());
  }

  // ── Results Screen ──────────────────────────────────────────────────────────
  _renderResults() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const r  = this.results || {};
    this._buttons = [];

    ctx.fillStyle = 'rgba(20, 14, 25, 0.94)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.09)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText('ROUND OVER!', cw / 2, ch * 0.12);

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font      = `bold ${Math.round(cw * 0.15)}px ${THEME.fontDisplay}`;
    ctx.fillText(`${r.score || 0}`, cw / 2, ch * 0.23);

    // Assists tag
    const assistSummary = this.powerUpState.assistsSummary || { hasAssists: false, tag: '🎯 Pure Run' };
    ctx.fillStyle = assistSummary.hasAssists ? '#ffd54f' : '#81c784';
    ctx.font      = `bold ${Math.round(cw * 0.04)}px ${THEME.fontDisplay}`;
    ctx.fillText(assistSummary.tag, cw / 2, ch * 0.28);

    // Stats grid
    const stats = [
      ['Accuracy',      `${r.accuracy || 0}%`],
      ['Best Streak',   `${r.bestStreak || 0} hits`],
      ['Hits / Misses', `${r.hits || 0} / ${r.misses || 0}`],
    ];
    ctx.font = `600 ${Math.round(cw * 0.04)}px ${THEME.fontBody}`;
    stats.forEach(([label, val], i) => {
      const y = ch * (0.33 + i * 0.052);
      ctx.fillStyle = '#baa';
      ctx.textAlign = 'left';
      ctx.fillText(label, cw * 0.12, y);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(val, cw * 0.88, y);
    });

    // Assists breakdown if used
    if (assistSummary.hasAssists && assistSummary.list?.length > 0) {
      ctx.fillStyle = '#998';
      ctx.font      = `${Math.round(cw * 0.032)}px ${THEME.fontBody}`;
      ctx.textAlign = 'center';
      ctx.fillText(`Assists used: ${assistSummary.list.join(' · ')}`, cw / 2, ch * 0.51);
    }

    // Personal best notice
    if (r.isPersonalBest) {
      ctx.fillStyle = THEME.danfoYellow;
      ctx.font      = `bold ${Math.round(cw * 0.046)}px ${THEME.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.fillText('🏆 NEW PERSONAL BEST!', cw / 2, ch * 0.57);
    }

    // Buttons
    const btnW = cw * 0.74, btnH = Math.min(ch * 0.07, 54);
    const rematchY = ch * 0.64;
    const lbY      = ch * 0.73;
    const shopY    = ch * 0.82;

    this._drawWoodBtn(cw / 2 - btnW / 2, rematchY, btnW, btnH, 'PLAY AGAIN', true, '🔁');
    this._registerButton(cw / 2 - btnW / 2, rematchY, btnW, btnH, () => this.onRematch());

    this._drawWoodBtn(cw / 2 - btnW / 2, lbY, btnW, btnH, 'LEADERBOARD', false, '🏆');
    this._registerButton(cw / 2 - btnW / 2, lbY, btnW, btnH, () => this.onLeaderboard());

    this._drawWoodBtn(cw / 2 - btnW / 2, shopY, btnW, btnH, 'BOOST SHOP', false, '🛍️');
    this._registerButton(cw / 2 - btnW / 2, shopY, btnW, btnH, () => this.onOpenShop());
  }

  _renderLeaderboard() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    ctx.fillStyle = 'rgba(20, 14, 25, 0.94)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.08)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText('🏆 LEADERBOARD', cw / 2, ch * 0.10);

    const entries = this.leaderboardData?.entries || [];
    if (entries.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = `${Math.round(cw * 0.042)}px ${THEME.fontBody}`;
      ctx.fillText('No scores posted yet. Claim the top!', cw / 2, ch * 0.5);
    } else {
      entries.slice(0, 10).forEach((e, i) => {
        const y = ch * (0.17 + i * 0.062);
        const isMe = e.playerId === this.player?.id;
        ctx.fillStyle = isMe ? THEME.danfoYellow : (i < 3 ? '#fff' : '#aaa');
        ctx.font = `${isMe ? 'bold ' : ''}${Math.round(cw * 0.038)}px ${THEME.fontBody}`;
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}. ${e.name}`, cw * 0.08, y);
        ctx.textAlign = 'right';
        ctx.fillText(`${e.score}`, cw * 0.92, y);
      });
    }

    // Back button
    const btnW = cw * 0.54, btnH = ch * 0.068;
    const backY = ch * 0.88;
    this._drawWoodBtn(cw / 2 - btnW / 2, backY, btnW, btnH, '← BACK', false);
    this._registerButton(cw / 2 - btnW / 2, backY, btnW, btnH, () => this.onRematch());
  }

  _renderPaused() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    this._buttons = [];

    ctx.fillStyle = 'rgba(15, 10, 20, 0.88)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = THEME.danfoYellow;
    ctx.font      = `bold ${Math.round(cw * 0.11)}px ${THEME.fontDisplay}`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cw / 2, ch * 0.42);

    const btnW = cw * 0.56, btnH = ch * 0.075;
    const resumeY = ch * 0.54;
    this._drawWoodBtn(cw / 2 - btnW / 2, resumeY, btnW, btnH, 'RESUME', true, '▶');
    this._registerButton(cw / 2 - btnW / 2, resumeY, btnW, btnH, () => this.onResume());
  }

  _renderFlashes() {
    const { ctx } = this;
    for (const f of this._flashes) {
      ctx.save();
      const alpha = Math.max(0, f.life / f.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font        = `bold ${Math.round(this.canvas.width * 0.052)}px ${THEME.fontDisplay}`;
      ctx.textAlign   = 'center';
      const drift = (1 - f.life / f.maxLife) * 24;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth   = 3;
      ctx.strokeText(f.text, f.x, f.y - drift);
      ctx.fillStyle   = THEME.danfoYellow;
      ctx.fillText(f.text, f.x, f.y - drift);
      ctx.restore();
    }
  }

  // ── Helper Controls ────────────────────────────────────────────────────────

  _drawWoodBtn(x, y, w, h, label, isPrimary = false, icon = '') {
    drawWoodButton(this.ctx, x, y, w, h, label, isPrimary, icon);
  }

  _drawSoundToggle(x, y, w, h) {
    const { ctx } = this;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.45;

    // Circular button background
    ctx.fillStyle = this.soundMuted ? 'rgba(60, 40, 40, 0.8)' : 'rgba(78, 46, 24, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.soundMuted ? '#ff5252' : THEME.danfoYellow;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Speaker icon
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(r * 1.05)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.soundMuted ? '🔇' : '🔊', cx, cy);
    ctx.textBaseline = 'alphabetic'; // reset

    this._registerButton(x, y, w, h, () => this.onToggleSound());
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
