/**
 * engine.js – fixed-timestep physics loop, coordinate mapping, and renderer.
 *
 * World coords (100 × 216 units) are mapped to canvas pixels at runtime.
 * Call Engine.resize() whenever the canvas dimensions change.
 *
 * Usage:
 *   import Engine from './engine.js';
 *   const eng = new Engine(canvasEl);
 *   eng.start();           // begins the loop
 *   eng.stop();            // pauses the loop
 */

import {
  WORLD_W, WORLD_H, GRAVITY, FIXED_DT,
  ROCK_RADIUS, SLING_X, SLING_Y, FORK_SPREAD, FORK_HEIGHT,
  MAX_DRAG, LAUNCH_SCALE,
  CLR_SKY, CLR_GROUND, CLR_SHELF, CLR_BOTTLE,
  CLR_ROCK, CLR_BAND, CLR_HIT, CLR_ACCENT, CLR_UI_TEXT,
  TIERS, TRAJECTORY_SHOTS, TRAJECTORY_DOTS,
  TOTAL_ROCKS,
} from './constants.js';

// ─── Vector helpers ───────────────────────────────────────────────────────────
function vec(x, y) { return { x, y }; }
function vAdd(a, b) { return vec(a.x + b.x, a.y + b.y); }
function vSub(a, b) { return vec(a.x - b.x, a.y - b.y); }
function vScale(v, s) { return vec(v.x * s, v.y * s); }
function vLen(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function vNorm(v) { const l = vLen(v) || 1; return vec(v.x / l, v.y / l); }

// ─── Hit detection ────────────────────────────────────────────────────────────
// Circle (rock) vs rectangle (bottle shelf area).
function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

// ─── Particles ────────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, vx, vy, radius, colour, life) {
    Object.assign(this, { x, y, vx, vy, radius, colour, life, maxLife: life });
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += GRAVITY * dt * 0.5;
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

    // Drag state
    this.dragging   = false;
    this.dragStart  = null;   // world coords
    this.dragCurrent= null;

    // Running state
    this.running    = false;
    this._raf       = null;
    this._acc       = 0;      // accumulated time for fixed step
    this._last      = 0;

    // Shot counter (for trajectory preview)
    this.shotsFired = 0;

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
  _bindInput() {
    const c = this.canvas;
    const ev = (name, fn) => c.addEventListener(name, fn, { passive: false });

    ev('pointerdown', (e) => {
      if (!this.running) return;
      e.preventDefault();
      const wx = this.px(e.offsetX), wy = this.py(e.offsetY);
      // Only start drag if near the slingshot pouch area
      const d = vLen(vSub(vec(wx, wy), vec(SLING_X, SLING_Y)));
      if (d < 18) {
        this.dragging = true;
        this.dragStart   = vec(SLING_X, SLING_Y);
        this.dragCurrent = vec(wx, wy);
        c.setPointerCapture(e.pointerId);
      }
    });

    ev('pointermove', (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      const wx = this.px(e.offsetX), wy = this.py(e.offsetY);
      // Clamp drag distance to MAX_DRAG world units
      const raw  = vSub(vec(wx, wy), this.dragStart);
      const dist = Math.min(vLen(raw), MAX_DRAG);
      const dir  = vNorm(raw);
      this.dragCurrent = vAdd(this.dragStart, vScale(dir, dist));
    });

    ev('pointerup', (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this._launch();
      this.dragging    = false;
      this.dragStart   = null;
      this.dragCurrent = null;
    });
  }

  _launch() {
    // Pull vector = sling anchor − current drag position (opposite direction)
    const pull = vSub(this.dragStart, this.dragCurrent);
    const speed = vLen(pull) * LAUNCH_SCALE;
    if (speed < 1) return;  // ignore accidental taps

    const dir = vNorm(pull);
    this.rocks.push({
      x:  SLING_X,
      y:  SLING_Y,
      vx: dir.x * speed,
      vy: dir.y * speed,
      r:  ROCK_RADIUS,
      landed: false,
      hit:    false,
    });

    this.shotsFired++;
    this.onShoot();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  setBottles(arr) { this.bottles = arr; }

  spawnShatterAt(x, y, colour) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() * 0.5);
      const speed = 10 + Math.random() * 18;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 5,
        0.6 + Math.random() * 0.8,
        colour,
        0.6 + Math.random() * 0.4,
      ));
    }
    this.shakeTime = 0.18;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last   = performance.now();
    this._loop(this._last);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  _loop(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame((t) => this._loop(t));

    const elapsed = Math.min((now - this._last) / 1000, 0.1); // cap at 100ms
    this._last = now;
    this._acc += elapsed;

    while (this._acc >= FIXED_DT) {
      this._tick(FIXED_DT);
      this._acc -= FIXED_DT;
    }

    this._render();
  }

  _tick(dt) {
    // Screen shake decay
    if (this.shakeTime > 0) this.shakeTime -= dt;

    // Update rocks
    for (const rock of this.rocks) {
      if (rock.landed) continue;
      rock.vy += GRAVITY * dt;
      rock.x  += rock.vx * dt;
      rock.y  += rock.vy * dt;

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
          this.spawnShatterAt(bottle.x, bottle.y, CLR_HIT);
          this.onHit(bottle.tier);
          break;
        }
      }

      // Out of bounds → landed as miss
      if (!rock.landed && (rock.y > WORLD_H + 5 || rock.x < -5 || rock.x > WORLD_W + 5)) {
        rock.landed = true;
        this.onMiss();
      }
    }

    // Clean up rocks that are done
    this.rocks = this.rocks.filter(r => !r.landed || r.justLanded);

    // Particles
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.alive);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  _render() {
    const { ctx } = this;
    const cw = this.canvas.width, ch = this.canvas.height;

    // Screen shake offset
    let sx = 0, sy = 0;
    if (this.shakeTime > 0) {
      sx = (Math.random() - 0.5) * 6;
      sy = (Math.random() - 0.5) * 6;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // Background
    ctx.fillStyle = CLR_SKY;
    ctx.fillRect(0, 0, cw, ch);

    // Ground strip
    ctx.fillStyle = CLR_GROUND;
    ctx.fillRect(0, this.wy(WORLD_H - 8), cw, ch);

    // Draw shelves and bottles
    for (const bottle of this.bottles) {
      if (bottle.hit) continue;
      this._drawShelf(bottle);
      this._drawBottle(bottle);
    }

    // Trajectory preview – always visible while dragging
    if (this.dragging) {
      this._drawTrajectory();
    }

    // Slingshot
    this._drawSlingshot();

    // Rocks in flight
    for (const rock of this.rocks) {
      if (rock.landed) continue;
      ctx.beginPath();
      ctx.arc(this.wx(rock.x), this.wy(rock.y), this.wp(rock.r), 0, Math.PI * 2);
      ctx.fillStyle = '#8d6e63';
      ctx.fill();
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(this.wx(p.x), this.wy(p.y), this.wp(p.radius), 0, Math.PI * 2);
      ctx.fillStyle = p.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  _drawSlingshot() {
    const { ctx } = this;
    const ax = this.wx(SLING_X), ay = this.wy(SLING_Y);
    const topY = this.wy(SLING_Y - FORK_HEIGHT);
    const lx   = this.wx(SLING_X - FORK_SPREAD);
    const rx   = this.wx(SLING_X + FORK_SPREAD);

    // Stick
    ctx.strokeStyle = CLR_BAND;
    ctx.lineWidth   = this.wp(1.2);
    ctx.lineCap     = 'round';

    // Left prong
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lx, topY); ctx.stroke();
    // Right prong
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(rx, topY); ctx.stroke();

    // Band and pouch
    const pouch = this.dragCurrent
      ? vec(this.wx(this.dragCurrent.x), this.wy(this.dragCurrent.y))
      : vec(ax, topY + this.wp(1));

    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth   = this.wp(0.5);
    // Left band
    ctx.beginPath(); ctx.moveTo(lx, topY); ctx.lineTo(pouch.x, pouch.y); ctx.stroke();
    // Right band
    ctx.beginPath(); ctx.moveTo(rx, topY); ctx.lineTo(pouch.x, pouch.y); ctx.stroke();

    // Pouch circle (rock)
    ctx.beginPath();
    ctx.arc(pouch.x, pouch.y, this.wp(ROCK_RADIUS), 0, Math.PI * 2);
    ctx.fillStyle = '#8d6e63';
    ctx.fill();
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  _drawTrajectory() {
    const pull  = vSub(this.dragStart, this.dragCurrent);
    const speed = vLen(pull) * LAUNCH_SCALE;
    if (speed < 1) return;
    const dir = vNorm(pull);

    let x = SLING_X, y = SLING_Y;
    let vx = dir.x * speed, vy = dir.y * speed;
    const dt = 0.05;

    const { ctx } = this;
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      // Simulate a few steps
      for (let s = 0; s < 3; s++) {
        vy += GRAVITY * dt;
        x  += vx * dt;
        y  += vy * dt;
      }
      const alpha = 1 - i / TRAJECTORY_DOTS;
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(this.wx(x), this.wy(y), this.wp(0.8), 0, Math.PI * 2);
      ctx.fillStyle = CLR_ACCENT;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawShelf(bottle) {
    const { ctx } = this;
    const sx    = bottle.x;
    const sy    = bottle.y;
    const sw    = 8  * bottle.tier.scale;
    const sh    = 1.2 * bottle.tier.scale;
    ctx.fillStyle = CLR_SHELF;
    ctx.fillRect(this.wx(sx - sw / 2), this.wy(sy), this.wp(sw), this.wp(sh));
  }

  _drawBottle(bottle) {
    const { ctx } = this;
    const sc = bottle.tier.scale;
    const bw = 2.4 * sc;
    const bh = 6.0 * sc;
    const bx = this.wx(bottle.x - bw / 2);
    const by = this.wy(bottle.y - bh);
    const pw = this.wp(bw);
    const ph = this.wp(bh);

    // Body
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.roundRect(bx, by + ph * 0.15, pw, ph * 0.85, this.wp(sc * 0.5));
    ctx.fill();

    // Neck
    ctx.fillStyle = '#1b5e20';
    ctx.fillRect(bx + pw * 0.3, by, pw * 0.4, ph * 0.2);

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx + pw * 0.15, by + ph * 0.2, pw * 0.2, ph * 0.5);

    // Distance label (small, during development)
    if (sc > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `${Math.round(this.wp(sc * 2))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`L${bottle.tier.id}`, this.wx(bottle.x), this.wy(bottle.y - bh / 2));
    }
  }
}
