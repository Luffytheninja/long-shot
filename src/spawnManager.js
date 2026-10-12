/**
 * spawnManager.js – one-bottle-at-a-time seeded spawn controller.
 *
 * Rules:
 *  - Only one bottle is ever on screen.
 *  - A bottle stays for BOTTLE_STAY_MIN..BOTTLE_STAY_MAX seconds.
 *  - The next bottle spawns immediately after the current one is hit or expires.
 *  - Horizontal position cycles through a biased shuffle of left / centre / right zones.
 *    The shuffle guarantees no two consecutive bottles appear in the same zone,
 *    and isn't purely sequential either (uses the seeded RNG to order within each cycle).
 *  - Tier (distance / difficulty) ramps from easy to hard over the round,
 *    using the same seeded RNG so the full round is reproducible.
 */

import {
  TIERS, WORLD_H,
  BOTTLE_STAY_MIN, BOTTLE_STAY_MAX,
  SPAWN_ZONES,
  RAMP_DURATION,
} from './constants.js';

export default class SpawnManager {
  /**
   * @param {function} rand   – mulberry32 generator bound to the round seed
   * @param {Engine}   engine – reference to call engine.setBottles()
   */
  constructor(rand, engine) {
    this.rand    = rand;
    this.engine  = engine;
    this.active  = null;   // single active bottle (or null)
    this.elapsed = 0;      // seconds since round start
    this.running = false;

    // Zone shuffle state
    this._zoneDeck   = [];     // remaining zones in current shuffle cycle
    this._lastZoneIdx= -1;     // index of last used zone (to prevent repeats)
  }

  start() {
    this.active       = null;
    this.elapsed      = 0;
    this.running      = true;
    this._zoneDeck    = [];
    this._lastZoneIdx = -1;
    this._spawn();             // spawn first bottle immediately
    this._syncEngine();
  }

  stop() {
    this.running = false;
  }

  /**
   * Call every frame with elapsed delta seconds.
   * @param {number} dt
   */
  update(dt) {
    if (!this.running) return;
    this.elapsed += dt;

    if (this.active) {
      if (this.active.hit) {
        // Bottle was hit – spawn next immediately
        this.active = null;
        this._spawn();
      } else {
        this.active.timeLeft -= dt;
        if (this.active.timeLeft <= 0) {
          // Bottle expired – spawn next immediately
          this.active = null;
          this._spawn();
        }
      }
    }

    this._syncEngine();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Pick next zone index using biased shuffle (never same zone twice in a row). */
  _nextZoneIdx() {
    // Refill deck when empty
    if (this._zoneDeck.length === 0) {
      // Build [0,1,2] and Fisher-Yates shuffle with seeded RNG
      const indices = SPAWN_ZONES.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      // If the first item in the new deck is the same as last zone used,
      // swap it with a random other item to avoid consecutive repeat at cycle boundary.
      if (indices[0] === this._lastZoneIdx && indices.length > 1) {
        const swapWith = 1 + Math.floor(this.rand() * (indices.length - 1));
        [indices[0], indices[swapWith]] = [indices[swapWith], indices[0]];
      }
      this._zoneDeck = indices;
    }

    const idx = this._zoneDeck.shift();
    this._lastZoneIdx = idx;
    return idx;
  }

  /** Choose difficulty tier based on how far into the round we are. */
  _chooseTier() {
    const t = Math.min(this.elapsed / RAMP_DURATION, 1); // 0 → 1
    // Weights peak near the current ramp position across the 5 tiers
    const weights = TIERS.map((_, i) => {
      const base = i / (TIERS.length - 1); // 0 → 1
      return 0.15 + 0.85 * (1 - Math.abs(base - t));
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rand() * total;
    for (let i = 0; i < TIERS.length; i++) {
      r -= weights[i];
      if (r <= 0) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  _spawn() {
    const tier    = this._chooseTier();
    const zoneIdx = this._nextZoneIdx();
    const zone    = SPAWN_ZONES[zoneIdx];

    // X: random inside the chosen zone
    const x = zone.xMin + this.rand() * (zone.xMax - zone.xMin);

    // Y: based on tier – closer tiers sit lower, farther tiers sit higher
    // Tier 1 (Close) ≈ 65% of world height, Tier 5 (Long) ≈ 35%
    const baseYFrac = 0.65 - (tier.id - 1) * 0.07;
    const yJitter   = (this.rand() - 0.5) * 5;
    const y = WORLD_H * baseYFrac + yJitter;

    // Stay time: min 2.5 s, max 4.5 s, randomised with seed
    const stayTime = BOTTLE_STAY_MIN + this.rand() * (BOTTLE_STAY_MAX - BOTTLE_STAY_MIN);

    this.active = {
      id:       `b-${Date.now()}-${Math.floor(this.rand() * 9999)}`,
      tier,
      zone:     zone.name,
      x,
      y,
      timeLeft: stayTime,
      hit:      false,
    };
  }

  _syncEngine() {
    // Engine expects an array; wrap single bottle (or empty)
    this.engine.setBottles(this.active ? [this.active] : []);
  }
}
