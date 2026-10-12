/**
 * scoring.js – combo multiplier, streak bonus, and round score state.
 *
 * Usage:
 *   const s = new Scoring();
 *   s.onHit(tier);   // returns { points, multiplier, comboText }
 *   s.onMiss();
 *   s.summary();     // call at round end
 */

import {
  COMBO_STEP, MAX_MULTIPLIER,
  STREAK_BONUS_AT, STREAK_BONUS,
  TOTAL_ROCKS,
} from './constants.js';

export default class Scoring {
  constructor() {
    this.reset();
  }

  reset() {
    this.score        = 0;
    this.multiplier   = 1.0;
    this.combo        = 0;       // current consecutive hits
    this.bestStreak   = 0;
    this.hits         = 0;
    this.misses       = 0;
    this.rocksLeft    = TOTAL_ROCKS;
    this.roundOver    = false;
  }

  /**
   * Called when a rock hits a bottle.
   * @param {object} tier – the TIERS entry for the hit bottle
   * @returns {{ points: number, multiplier: number, bonus: number, comboText: string }}
   */
  onHit(tier) {
    const basePoints = tier.points;
    const earned = Math.round(basePoints * this.multiplier);
    let bonus = 0;

    this.score   += earned;
    this.combo++;
    this.hits++;
    this.bestStreak = Math.max(this.bestStreak, this.combo);

    // Multiplier steps up
    this.multiplier = Math.min(MAX_MULTIPLIER, 1 + this.combo * COMBO_STEP);

    // Streak bonus at multiples of STREAK_BONUS_AT
    if (this.combo % STREAK_BONUS_AT === 0) {
      bonus = STREAK_BONUS;
      this.score += bonus;
    }

    const comboText = this.combo >= 2 ? `×${this.multiplier.toFixed(2)}` : '';

    return { points: earned, multiplier: this.multiplier, bonus, comboText };
  }

  /**
   * Called when a rock lands without hitting a bottle.
   */
  onMiss() {
    this.combo      = 0;
    this.multiplier = 1.0;
    this.misses++;
  }

  /**
   * Called when a rock is fired (decrements rock count, triggers round end).
   * @returns {boolean} true if the round is now over
   */
  onShoot() {
    this.rocksLeft--;
    if (this.rocksLeft <= 0) {
      this.roundOver = true;
      return true;
    }
    return false;
  }

  get accuracy() {
    const total = this.hits + this.misses;
    return total > 0 ? Math.round((this.hits / total) * 100) : 0;
  }

  summary() {
    return {
      score:      this.score,
      hits:       this.hits,
      misses:     this.misses,
      accuracy:   this.accuracy,
      bestStreak: this.bestStreak,
    };
  }
}
