/**
 * spawnManager.js – seeded bottle spawn controller.
 *
 * Uses the same makeRng() instance as the rest of the round so the entire
 * match is reproducible from one seed.
 *
 * Usage:
 *   const sm = new SpawnManager(rand, engine);
 *   sm.start();           // called when the round begins
 *   sm.update(dt);        // call every frame with elapsed seconds
 *   sm.stop();            // call on round end / pause
 */

import {
  TIERS, WORLD_H, SLING_X, SLING_Y,
  GAP_EARLY_MIN, GAP_EARLY_MAX,
  GAP_LATE_MIN,  GAP_LATE_MAX,
  RAMP_DURATION,
} from './constants.js';

export default class SpawnManager {
  /**
   * @param {function} rand – mulberry32 generator bound to the round seed
   * @param {Engine}   engine – reference to set engine.bottles
   */
  constructor(rand, engine) {
    this.rand   = rand;
    this.engine = engine;
    this.active = [];     // bottles currently on screen
    this.elapsed= 0;      // seconds since round start
    this.nextIn = 0;      // seconds until next spawn
    this.running= false;
  }

  start() {
    this.active  = [];
    this.elapsed = 0;
    this.nextIn  = this._gapNow();
    this.running = true;
    this._syncEngine();
  }

  stop() {
    this.running = false;
  }

  /**
   * @param {number} dt – seconds since last frame
   */
  update(dt) {
    if (!this.running) return;
    this.elapsed += dt;

    // Expire old bottles
    this.active = this.active.filter(b => {
      if (b.hit) return false;                  // hit: remove immediately
      b.timeLeft -= dt;
      return b.timeLeft > 0;
    });

    // Spawn
    this.nextIn -= dt;
    if (this.nextIn <= 0) {
      this._spawn();
      this.nextIn = this._gapNow();
    }

    this._syncEngine();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _gapNow() {
    // Linear interpolation between early and late windows based on elapsed time
    const t = Math.min(this.elapsed / RAMP_DURATION, 1);
    const minG = GAP_EARLY_MIN + (GAP_LATE_MIN - GAP_EARLY_MIN) * t;
    const maxG = GAP_EARLY_MAX + (GAP_LATE_MAX - GAP_EARLY_MAX) * t;
    return minG + this.rand() * (maxG - minG);
  }

  _chooseTier() {
    // Early rounds lean 1–3, later rounds lean 3–5
    const t = Math.min(this.elapsed / RAMP_DURATION, 1); // 0..1
    // Weight: each tier gets a weight, skewed by t.
    // Tier 1 weight goes from 1 → 0.1, Tier 5 weight goes from 0.1 → 1.
    const weights = TIERS.map((_, i) => {
      const base = (i / (TIERS.length - 1));        // 0 → 1 for tiers 1→5
      return 0.1 + 0.9 * (1 - Math.abs(base - t));  // peak near current ramp
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rand() * total;
    for (let i = 0; i < TIERS.length; i++) {
      r -= weights[i];
      if (r <= 0) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  _stayTime(tier) {
    // Stay time shrinks by up to 25% over the round
    const t = Math.min(this.elapsed / RAMP_DURATION, 1);
    return tier.stayStart * (1 - 0.25 * t);
  }

  _spawn() {
    const tier = this._chooseTier();

    // Shelf Y position: place bottles on shelves at different heights
    // Spread shelves from 60% of world height up to 30%
    // Tier 1 (closest) is low, tier 5 (far) is high, with variation
    const baseY = WORLD_H * (0.60 - (tier.id - 1) * 0.06);
    const jitter = (this.rand() - 0.5) * 4; // small vertical jitter
    const y = baseY + jitter;

    // X position: jitter around the tier distance from sling X
    const xJitter = (this.rand() - 0.5) * tier.distance * 0.3;
    const x = Math.min(95, Math.max(5, SLING_X + tier.distance + xJitter));

    this.active.push({
      id:       `${Date.now()}-${this.rand()}`,
      tier,
      x,
      y,
      timeLeft: this._stayTime(tier),
      hit:      false,
    });
  }

  _syncEngine() {
    this.engine.setBottles(this.active);
  }
}
