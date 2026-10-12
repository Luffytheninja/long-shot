/**
 * engine.js – fixed-timestep physics loop, coordinate mapping, and renderer.
 *
 * World coords (100 × 216 units) are mapped to canvas pixels at runtime.
 * Unified with woodTheme for an authentic Lagos compound-wall atmosphere.
 */

import {
  WORLD_W, WORLD_H, GRAVITY, FIXED_DT,
  ROCK_RADIUS, SLING_X, SLING_Y, FORK_SPREAD, FORK_HEIGHT,
  MAX_DRAG, MIN_SPEED, MAX_SPEED, DRAG_EXPONENT,
  CLR_HIT, CLR_ACCENT,
  TIERS, TRAJECTORY_SHOTS, TRAJECTORY_DOTS,
} from './constants.js';

import {
  THEME,
  drawLagosEnvironment,
  drawWallLedge,
  drawLagosBottle,
} from './woodTheme.js';

// ─── Vector helpers ───────────────────────────────────────────────────────────
function vec(x, y) { return { x, y }; }
function vAdd(a, b) { return vec(a.x + b.x, a.y + b.y); }
function vSub(a, b) { return vec(a.x - b.x, a.y - b.y); }
function vScale(v, s) { return vec(v.x * s, v.y * s); }
function vLen(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function vNorm(v) { const l = vLen(v) || 1; return vec(v.x / l, v.y / l); }

// ─── Hit detection ────────────────────────────────────────────────────────────
// Circle (rock) vs rectangle (bottle area).
function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

// ─── Particles ────────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, vx, vy, radius, colour, life, type = 'glass') {
    Object.assign(this, { x, y, vx, vy, radius, colour, life, maxLife: life, type });
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += (this.type === 'dust' ? 8 : GRAVITY * 0.5) * dt;
    this.life -= dt;
  }
  get alive() { return this.life > 0; }
  get alpha() { return Math.max(0, this.life / this.maxLife); }
}

// ─── Engine ───────────────────────────────────────────────────────────────────
export default class Engine {
  constructor(canvas, { onRoundEnd, onHit, onMiss, onShoot } = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.onRoundEnd = onRoundEnd || (() => {});
    this.onHit      = onHit      || (() => {});
    this.onMiss     = onMiss     || (() => {});
    this.onShoot    = onShoot    || (() => {});

    this.ppu     = 1;      // pixels per world unit – set by resize()
    this.offX    = 0;      // canvas x offset when letterboxing
    this.offY    = 0;

    // Game state
    this.rocks      = [];
    this.bottles    = [];     // managed by SpawnManager, passed in
    this.particles  = [];
    this.shakeTime  = 0;

    // Visual impact feedback ("Gbam!" floating impact labels)
    this.impactLabels = []; // [{ text, x, y, life, maxLife, scale, color }]

    // Slow-motion effect for qualifying long shots (Tier 4 & 5 hits)
    this.slowMoTime   = 0;
    this.slowMoFactor = 1.0;

    // Drag state
    this.dragging   = false;
    this.dragStart  = null;   // world coords
    this.dragCurrent= null;

    // Running state
    this.running    = false;
    this._acc       = 0;      // accumulated time for fixed step

    // Shot counter (for trajectory preview)
    this.shotsFired = 0;
    this.gameTime   = 0;

    this._bindInput();
    this.resize();
  }

  // ── Coordinate mapping ─────────────────────────────────────────────────────
  resize() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.ppu  = Math.min(cw / WORLD_W, ch / WORLD_H);
    this.offX = (cw - WORLD_W * this.ppu) / 2;
    this.offY = (ch - WORLD_H * this.ppu) / 2;
  }

  // world → canvas pixel
  wx(x) { return this.offX + x * this.ppu; }
  wy(y) { return this.offY + y * this.ppu; }
  wp(v) { return v * this.ppu; }

  // canvas pixel → world
  px(x) { return (x - this.offX) / this.ppu; }
  py(y) { return (y - this.offY) / this.ppu; }

  // ── Input ──────────────────────────────────────────────────────────────────
  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  _bindInput() {
    const c = this.canvas;
    const ev = (name, fn) => c.addEventListener(name, fn, { passive: false });

    ev('pointerdown', (e) => {
      if (!this.running) return;
      e.preventDefault();
      const pos = this._getCanvasPos(e);
      const wx = this.px(pos.x), wy = this.py(pos.y);
      // Grab radius: generous on phones (32 world units) so thumbs easily grab pouch
      const d = vLen(vSub(vec(wx, wy), vec(SLING_X, SLING_Y)));
      if (d < 32 || wy > SLING_Y - 10) {
        this.dragging = true;
        this.dragStart   = vec(SLING_X, SLING_Y);
        this.dragCurrent = vec(wx, wy);
        try { c.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    ev('pointermove', (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      const pos = this._getCanvasPos(e);
      const wx = this.px(pos.x), wy = this.py(pos.y);
      // Clamp drag distance to MAX_DRAG world units
      const raw  = vSub(vec(wx, wy), this.dragStart);
      const dist = Math.min(vLen(raw), MAX_DRAG);
      const dir  = vNorm(raw);
      this.dragCurrent = vAdd(this.dragStart, vScale(dir, dist));
    });

    const endDrag = (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this._launch();
      this.dragging    = false;
      this.dragStart   = null;
      this.dragCurrent = null;
    };

    ev('pointerup', endDrag);
    ev('pointercancel', endDrag);
  }

  _getLaunchPhysics() {
    if (!this.dragStart || !this.dragCurrent) return null;
    const pull = vSub(this.dragStart, this.dragCurrent);
    const dist = vLen(pull);
    if (dist < 1.2) return null; // Dead-zone for accidental micro-taps

    const dir = vNorm(pull);
    // Normalized pull fraction (0.0 to 1.0)
    const norm = Math.min(dist / MAX_DRAG, 1.0);
    // Non-linear power ramp (starts soft & gentle, ramps with deep pull)
    const powerCurve = Math.pow(norm, DRAG_EXPONENT);
    const speed = MIN_SPEED + powerCurve * (MAX_SPEED - MIN_SPEED);

    return { dir, speed, norm, dist };
  }

  _launch() {
    const phys = this._getLaunchPhysics();
    if (!phys) return;

    this.rocks.push({
      x:  SLING_X,
      y:  SLING_Y,
      vx: phys.dir.x * phys.speed,
      vy: phys.dir.y * phys.speed,
      r:  ROCK_RADIUS,
      trail: [],
      landed: false,
      hit:    false,
    });

    this.shotsFired++;
    this.onShoot();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  setBottles(arr) { this.bottles = arr; }

  spawnShatterAt(x, y, tier) {
    // Glass fragments in bottle green and glass sparkles
    const colors = [THEME.bottleGlass, THEME.bottleGlassDark, '#a5d6a7', '#fff', THEME.bottleCap];
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() * 0.4);
      const speed = 12 + Math.random() * 22;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 6,
        0.5 + Math.random() * 1.0,
        color,
        0.55 + Math.random() * 0.45,
        'glass'
      ));
    }

    // Floating "Gbam!" feedback label
    const isLongShot = tier && tier.id >= 4;
    const label = isLongShot ? 'GBAM! 🔥' : 'GBAM!';
    this.impactLabels.push({
      text: label,
      x: this.wx(x),
      y: this.wy(y - 4),
      life: 0.9,
      maxLife: 0.9,
      scale: isLongShot ? 1.3 : 1.0,
      color: isLongShot ? THEME.danfoYellow : '#ffffff',
    });

    // Screen shake
    this.shakeTime = 0.18;

    // Subtle slow-mo for long shots (Tiers 4 & 5)
    if (isLongShot) {
      this.slowMoTime = 0.28;
      this.slowMoFactor = 0.4;
    }
  }

  spawnDustAt(x, y) {
    // Miss feedback: sand & concrete dust puff
    const dustColors = ['rgba(160, 140, 120, 0.7)', 'rgba(120, 105, 90, 0.6)', 'rgba(210, 190, 160, 0.5)'];
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI * (0.2 + 0.6 * Math.random());
      const speed = 4 + Math.random() * 9;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.8 + Math.random() * 1.2,
        dustColors[i % dustColors.length],
        0.45 + Math.random() * 0.3,
        'dust'
      ));
    }

    // Small miss label for clear muted accessibility
    this.impactLabels.push({
      text: 'MISS',
      x: this.wx(x),
      y: this.wy(y - 2),
      life: 0.6,
      maxLife: 0.6,
      scale: 0.85,
      color: '#ff8a80',
    });
  }

  start() {
    this.running = true;
    this._acc    = 0;
  }

  stop() {
    this.running = false;
    this.dragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.slowMoTime = 0;
    this.slowMoFactor = 1.0;
  }

  reset() {
    this.rocks = [];
    this.bottles = [];
    this.particles = [];
    this.impactLabels = [];
    this.shotsFired = 0;
    this.shakeTime = 0;
    this.slowMoTime = 0;
    this.slowMoFactor = 1.0;
  }

  // ── Stepped physics update (called authoritatively from Game loop) ─────────
  update(dt) {
    this.gameTime += dt;

    // Handle slow-mo decay
    if (this.slowMoTime > 0) {
      this.slowMoTime -= dt;
      if (this.slowMoTime <= 0) {
        this.slowMoFactor = 1.0;
      }
    }

    const effectiveDt = dt * this.slowMoFactor;
    this._acc += effectiveDt;

    while (this._acc >= FIXED_DT) {
      this._tick(FIXED_DT);
      this._acc -= FIXED_DT;
    }

    // Update impact labels
    for (const lbl of this.impactLabels) {
      lbl.life -= dt;
    }
    this.impactLabels = this.impactLabels.filter(lbl => lbl.life > 0);
  }

  _tick(dt) {
    if (this.shakeTime > 0) this.shakeTime -= dt;

    // Update rocks
    for (const rock of this.rocks) {
      if (rock.landed) continue;
      rock.vy += GRAVITY * dt;
      rock.x  += rock.vx * dt;
      rock.y  += rock.vy * dt;

      // Add to restrained rock flight trail (max 6 points)
      rock.trail.push({ x: rock.x, y: rock.y });
      if (rock.trail.length > 6) rock.trail.shift();

      // Check hit against all active bottles
      for (const bottle of this.bottles) {
        if (bottle.hit) continue;
        const bw = 2.4 * bottle.tier.scale;
        const bh = 6.0 * bottle.tier.scale;
        const bx = bottle.x - bw / 2;
        const by = bottle.y - bh;
        if (circleRect(rock.x, rock.y, rock.r, bx, by, bw, bh)) {
          bottle.hit = true;
          rock.landed = true;
          rock.hit    = true;
          this.spawnShatterAt(bottle.x, bottle.y, bottle.tier);
          this.onHit(bottle.tier);
          break;
        }
      }

      // Out of bounds or wall hit → landed as miss
      if (!rock.landed && (rock.y > WORLD_H + 5 || rock.x < -5 || rock.x > WORLD_W + 5)) {
        rock.landed = true;
        // Spawn dust puff at approximate exit/wall contact
        const clampX = Math.max(5, Math.min(WORLD_W - 5, rock.x));
        const clampY = Math.min(WORLD_H - 8, rock.y);
        this.spawnDustAt(clampX, clampY);
        this.onMiss();
      }
    }

    // Remove landed rocks
    this.rocks = this.rocks.filter(r => !r.landed);

    // Particles
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.alive);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  render() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;

    // Screen shake offset
    let sx = 0, sy = 0;
    if (this.shakeTime > 0) {
      sx = (Math.random() - 0.5) * 7;
      sy = (Math.random() - 0.5) * 7;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // 1. Lagos compound-wall atmosphere
    drawLagosEnvironment(ctx, cw, ch, this.ppu, this.offX, this.offY, this.gameTime);

    // 2. Draw shelves and bottles
    for (const bottle of this.bottles) {
      if (bottle.hit) continue;
      this._drawShelf(bottle);
      this._drawBottle(bottle);
    }

    // 3. Trajectory preview – visible while aiming
    if (this.dragging) {
      this._drawTrajectory();
    }

    // 4. Slingshot
    this._drawSlingshot();

    // 5. Rocks in flight with trail
    for (const rock of this.rocks) {
      if (rock.landed) continue;

      // Restrained rock flight trail
      if (rock.trail.length > 1) {
        ctx.strokeStyle = 'rgba(230, 210, 190, 0.45)';
        ctx.lineWidth = Math.max(1, this.wp(rock.r * 0.7));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.wx(rock.trail[0].x), this.wy(rock.trail[0].y));
        for (let i = 1; i < rock.trail.length; i++) {
          ctx.lineTo(this.wx(rock.trail[i].x), this.wy(rock.trail[i].y));
        }
        ctx.stroke();
      }

      // Rock body with shadow & highlight
      const rx = this.wx(rock.x);
      const ry = this.wy(rock.y);
      const rr = this.wp(rock.r);

      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fillStyle = '#6d4c41';
      ctx.fill();
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Pebble highlight
      ctx.fillStyle = 'rgba(255, 235, 215, 0.4)';
      ctx.beginPath();
      ctx.arc(rx - rr * 0.3, ry - rr * 0.3, rr * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Particles (glass shatter / concrete dust)
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(this.wx(p.x), this.wy(p.y), this.wp(p.radius), 0, Math.PI * 2);
      ctx.fillStyle = p.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 7. Impact Labels ("Gbam!", "MISS")
    for (const lbl of this.impactLabels) {
      const alpha = Math.max(0, lbl.life / lbl.maxLife);
      const lift = (1 - lbl.life / lbl.maxLife) * 35;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(cw * 0.052 * lbl.scale)}px ${THEME.fontDisplay}`;
      ctx.textAlign = 'center';
      // Outline for readability against wall
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(lbl.text, lbl.x, lbl.y - lift);
      ctx.fillStyle = lbl.color;
      ctx.fillText(lbl.text, lbl.x, lbl.y - lift);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawSlingshot() {
    const { ctx } = this;
    const ax = this.wx(SLING_X), ay = this.wy(SLING_Y);
    const topY = this.wy(SLING_Y - FORK_HEIGHT);
    const lx   = this.wx(SLING_X - FORK_SPREAD);
    const rx   = this.wx(SLING_X + FORK_SPREAD);

    // Carved Iroko wooden fork with grain
    ctx.lineCap = 'round';
    ctx.strokeStyle = THEME.mahoganyDark;
    ctx.lineWidth = this.wp(1.8);

    // Handle stem
    ctx.beginPath();
    ctx.moveTo(ax, ay + this.wp(5));
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // Wood fork prongs
    ctx.strokeStyle = THEME.iroko;
    ctx.lineWidth = this.wp(1.4);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lx, topY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(rx, topY); ctx.stroke();

    // Prong tips wrap (twine wrap holding elastic)
    ctx.strokeStyle = THEME.danfoYellow;
    ctx.lineWidth = this.wp(0.8);
    ctx.beginPath(); ctx.moveTo(lx - this.wp(0.8), topY); ctx.lineTo(lx + this.wp(0.8), topY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx - this.wp(0.8), topY); ctx.lineTo(rx + this.wp(0.8), topY); ctx.stroke();

    // Rubber band and leather pouch
    const pouch = this.dragCurrent
      ? vec(this.wx(this.dragCurrent.x), this.wy(this.dragCurrent.y))
      : vec(ax, topY + this.wp(1));

    // Elastic band (taut tyre rubber)
    ctx.strokeStyle = '#8d5b4c';
    ctx.lineWidth   = this.wp(0.7);
    ctx.beginPath(); ctx.moveTo(lx, topY); ctx.lineTo(pouch.x, pouch.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx, topY); ctx.lineTo(pouch.x, pouch.y); ctx.stroke();

    // Leather pouch
    ctx.beginPath();
    ctx.arc(pouch.x, pouch.y, this.wp(ROCK_RADIUS * 1.3), 0, Math.PI * 2);
    ctx.fillStyle = '#4e342e';
    ctx.fill();

    // Loaded stone inside pouch
    ctx.beginPath();
    ctx.arc(pouch.x, pouch.y, this.wp(ROCK_RADIUS), 0, Math.PI * 2);
    ctx.fillStyle = '#8d6e63';
    ctx.fill();
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Generous thumb pull guide circle when idling
    if (!this.dragging && this.running) {
      ctx.strokeStyle = 'rgba(245, 184, 0, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ax, ay, this.wp(14), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawTrajectory() {
    const phys = this._getLaunchPhysics();
    if (!phys) return;

    let x = SLING_X, y = SLING_Y;
    let vx = phys.dir.x * phys.speed, vy = phys.dir.y * phys.speed;
    const dt = 0.04;

    const { ctx } = this;
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      for (let s = 0; s < 2; s++) {
        vy += GRAVITY * dt;
        x  += vx * dt;
        y  += vy * dt;
      }

      if (y > WORLD_H || x < 0 || x > WORLD_W) break;

      const alpha = Math.max(0.2, 1 - (i / TRAJECTORY_DOTS) * 0.8);
      const dotRadius = Math.max(0.6, 1.1 - (i / TRAJECTORY_DOTS) * 0.4);

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(this.wx(x), this.wy(y), this.wp(dotRadius), 0, Math.PI * 2);
      ctx.fillStyle = THEME.danfoYellow;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawShelf(bottle) {
    const sw = 8 * bottle.tier.scale;
    const sh = 1.2 * bottle.tier.scale;
    const sx = this.wx(bottle.x - sw / 2);
    const sy = this.wy(bottle.y);
    const pw = this.wp(sw);
    const ph = this.wp(sh);

    drawWallLedge(this.ctx, sx, sy, pw, ph, bottle.tier.scale);
  }

  _drawBottle(bottle) {
    const sc = bottle.tier.scale;
    const bw = 2.4 * sc;
    const bh = 6.0 * sc;
    const bx = this.wx(bottle.x - bw / 2);
    const by = this.wy(bottle.y - bh);
    const pw = this.wp(bw);
    const ph = this.wp(bh);

    const timeLeftFrac = bottle.timeLeft / 4.0;
    drawLagosBottle(this.ctx, bx, by, pw, ph, bottle.tier, timeLeftFrac);
  }
}
