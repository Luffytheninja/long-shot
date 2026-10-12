/**
 * ui.js – Canvas overlay renderer for all screens.
 *
 * Handles:
 *   - Start screen (Daily Challenge / Practice)
 *   - HUD (rocks left, score, combo, streak)
 *   - Results screen (score, accuracy, streak, rematch/leaderboard)
 *   - Leaderboard overlay
 *   - Pause overlay
 *
 * All drawing is in canvas pixels (not world units) because UI sits on top.
 */

import { TOTAL_ROCKS, CLR_UI_BG, CLR_UI_TEXT, CLR_ACCENT } from './constants.js';

export default class UI {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.screen = 'start';  // 'start' | 'game' | 'results' | 'leaderboard' | 'paused'

    // Callbacks set by Game
    this.onDailyChallenge = () => {};
    this.onPractice       = () => {};
    this.onRematch        = () => {};
    this.onLeaderboard    = () => {};
    this.onResume         = () => {};
    this.onPurchase       = () => {};

    // Data passed in
    this.hud        = { rocksLeft: TOTAL_ROCKS, score: 0, combo: 0, multiplier: 1, streak: 0 };
    this.results    = null;
    this.player     = { name: 'Player', avatar: null };
    this.bestDaily  = 0;
    this.leaderboardData = null;

    // Hit flash text
    this._flashes = [];   // [{ text, x, y, life, maxLife }]

    this._buttons = [];   // clickable regions for current screen
    this.canvas.addEventListener('pointerdown', (e) => this._handleClick(e));
  }

  // ── Public setters ─────────────────────────────────────────────────────────

  setScreen(name) { this.screen = name; this._buttons = []; }
  setHUD(data)    { Object.assign(this.hud, data); }
  setResults(r)   { this.results = r; }
  setPlayer(p)    { this.player  = p; }
  setBestDaily(n) { this.bestDaily = n; }
  setLeaderboard(d) { this.leaderboardData = d; }

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
      case 'start':       this._renderStart();       break;
      case 'game':        this._renderHUD();         break;
      case 'results':     this._renderResults();     break;
      case 'leaderboard': this._renderLeaderboard(); break;
      case 'paused':      this._renderPaused();      break;
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
    ctx.fillText('LONG SHOT', cw / 2, ch * 0.22);

    ctx.fillStyle = '#aaa';
    ctx.font      = `${Math.round(cw * 0.045)}px sans-serif`;
    ctx.fillText('Slingshot Arcade · Lagos Life', cw / 2, ch * 0.285);

    // Best daily score
    if (this.bestDaily > 0) {
      ctx.fillStyle = '#fff8';
      ctx.font = `${Math.round(cw * 0.038)}px sans-serif`;
      ctx.fillText(`Best today: ${this.bestDaily}`, cw / 2, ch * 0.33);
    }

    // Buttons
    const btnW = cw * 0.72, btnH = ch * 0.075;
    const dailyY  = ch * 0.44;
    const practY  = ch * 0.54;
    const shopY   = ch * 0.64;

    this._drawButton(cw / 2 - btnW / 2, dailyY, btnW, btnH, '📅  Daily Challenge', CLR_ACCENT, '#000');
    this._registerButton(cw / 2 - btnW / 2, dailyY, btnW, btnH, () => this.onDailyChallenge());

    this._drawButton(cw / 2 - btnW / 2, practY, btnW, btnH, '🎯  Practice', '#4caf50', '#fff');
    this._registerButton(cw / 2 - btnW / 2, practY, btnW, btnH, () => this.onPractice());

    this._drawButton(cw / 2 - btnW / 2, shopY, btnW, btnH, '🛍️  Test Skin (₦100)', '#9c27b0', '#fff');
    this._registerButton(cw / 2 - btnW / 2, shopY, btnW, btnH, () => this.onPurchase());

    // Rules hint
    ctx.fillStyle = '#666';
    ctx.font      = `${Math.round(cw * 0.033)}px sans-serif`;
    ctx.fillText('Drag back the slingshot · Release to fire', cw / 2, ch * 0.77);
    ctx.fillText('15 rocks · Hit bottles to score', cw / 2, ch * 0.81);
  }

  _renderHUD() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const { rocksLeft, score, multiplier, streak } = this.hud;

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
  }

  _renderResults() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;
    const r  = this.results || {};
    this._buttons = [];

    ctx.fillStyle = CLR_UI_BG;
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = CLR_ACCENT;
    ctx.font      = `bold ${Math.round(cw * 0.1)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Round Over!', cw / 2, ch * 0.14);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${Math.round(cw * 0.16)}px "Segoe UI", sans-serif`;
    ctx.fillText(r.score || 0, cw / 2, ch * 0.28);

    // Stats grid
    const stats = [
      ['Accuracy',    `${r.accuracy || 0}%`],
      ['Best Streak', `${r.bestStreak || 0} hits`],
      ['Hits / Misses', `${r.hits || 0} / ${r.misses || 0}`],
    ];
    ctx.font      = `${Math.round(cw * 0.042)}px sans-serif`;
    stats.forEach(([label, val], i) => {
      const y = ch * (0.38 + i * 0.07);
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'left';
      ctx.fillText(label, cw * 0.12, y);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(val, cw * 0.88, y);
    });

    // Personal best notice
    if (r.isPersonalBest) {
      ctx.fillStyle = CLR_ACCENT;
      ctx.font      = `bold ${Math.round(cw * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🏆 New Personal Best!', cw / 2, ch * 0.62);
    }

    // Buttons
    const btnW = cw * 0.72, btnH = ch * 0.075;
    const rematchY = ch * 0.70;
    const lbY      = ch * 0.80;

    this._drawButton(cw / 2 - btnW / 2, rematchY, btnW, btnH, '🔁  Play Again', CLR_ACCENT, '#000');
    this._registerButton(cw / 2 - btnW / 2, rematchY, btnW, btnH, () => this.onRematch());

    this._drawButton(cw / 2 - btnW / 2, lbY, btnW, btnH, '🏆  Leaderboard', '#1565c0', '#fff');
    this._registerButton(cw / 2 - btnW / 2, lbY, btnW, btnH, () => this.onLeaderboard());
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
      ctx.font        = `bold ${Math.round(this.canvas.width * 0.06)}px sans-serif`;
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
    ctx.font      = `bold ${Math.round(h * 0.45)}px "Segoe UI", sans-serif`;
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
