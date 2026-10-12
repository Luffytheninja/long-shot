/**
 * powerups.js – Inventory, Run State, and Assist Rules for Long Shot.
 *
 * Implements Studio Ayo design proposal:
 * - Consumables: Slow Time, Bonus Stones (3 pack), Second Chance, Streak Shield
 * - Escalating Second Chance pricing per run: [500, 1000, 3500, 5000] (₦)
 * - Transparent run assists tracking
 * - Enforces MAX_TOTAL_SHOTS (25) cap
 */

import {
  PRODUCTS,
  SECOND_CHANCE_PRICES,
  MAX_SECOND_CHANCES_PER_RUN,
  SLOW_TIME_DURATION,
  SLOW_TIME_FACTOR,
  BONUS_STONES_PER_PACK,
  MAX_TOTAL_SHOTS,
  TOTAL_ROCKS,
} from './constants.js';

const INVENTORY_STORAGE_KEY = 'longshot_inventory_v1';

export default class PowerUpManager {
  constructor() {
    this.inventory = this._loadInventory();

    // Active Run State (reset on every new run)
    this.runId = null;
    this.secondChancesUsed = 0;
    this.bonusStonesUsed = 0;
    this.assistsUsed = {
      slowTime: 0,
      bonusStones: 0,
      secondChance: 0,
      streakShield: 0,
    };

    // Active in-game timers / states
    this.slowTimeTimer = 0; // seconds remaining of Slow Time
    this.streakShieldActive = false; // whether active for the next miss
  }

  // ── Inventory Persistence ──────────────────────────────────────────────────

  _loadInventory() {
    try {
      const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      slow_time: 1,      // Give 1 free starter for test/playtest
      bonus_stones_3: 1, // 1 starter pack
      streak_shield: 1,  // 1 starter shield
    };
  }

  _saveInventory() {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(this.inventory));
    } catch (_) {}
  }

  grantItem(productId, quantity = 1) {
    this.inventory[productId] = (this.inventory[productId] || 0) + quantity;
    this._saveInventory();
  }

  hasItem(productId) {
    return (this.inventory[productId] || 0) > 0;
  }

  consumeItem(productId, quantity = 1) {
    if (!this.hasItem(productId)) return false;
    this.inventory[productId] = Math.max(0, (this.inventory[productId] || 0) - quantity);
    this._saveInventory();
    return true;
  }

  // ── Run Lifecycle ──────────────────────────────────────────────────────────

  startNewRun() {
    this.runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.secondChancesUsed = 0;
    this.bonusStonesUsed = 0;
    this.assistsUsed = {
      slowTime: 0,
      bonusStones: 0,
      secondChance: 0,
      streakShield: 0,
    };
    this.slowTimeTimer = 0;
    this.streakShieldActive = false;
  }

  // ── Slow Time ──────────────────────────────────────────────────────────────

  get isSlowTimeActive() {
    return this.slowTimeTimer > 0;
  }

  get slowTimeRemaining() {
    return Math.max(0, this.slowTimeTimer);
  }

  get slowFactor() {
    return this.isSlowTimeActive ? SLOW_TIME_FACTOR : 1.0;
  }

  activateSlowTime() {
    if (this.isSlowTimeActive) return false;
    if (!this.consumeItem('slow_time', 1)) return false;
    this.slowTimeTimer = SLOW_TIME_DURATION;
    this.assistsUsed.slowTime++;
    return true;
  }

  update(dt) {
    if (this.slowTimeTimer > 0) {
      this.slowTimeTimer = Math.max(0, this.slowTimeTimer - dt);
    }
  }

  // ── Streak Shield ──────────────────────────────────────────────────────────

  activateStreakShield() {
    if (this.streakShieldActive) return false;
    if (!this.consumeItem('streak_shield', 1)) return false;
    this.streakShieldActive = true;
    this.assistsUsed.streakShield++;
    return true;
  }

  // Called when a rock misses. If protected, consumes shield and returns true.
  protectMiss() {
    if (this.streakShieldActive) {
      this.streakShieldActive = false;
      return true; // combo protected!
    }
    return false;
  }

  // ── Bonus Stones (pre-run / mid-run ammo addition) ─────────────────────────

  canUseBonusStones(currentTotalRocks) {
    if (!this.hasItem('bonus_stones_3')) return false;
    return (currentTotalRocks + BONUS_STONES_PER_PACK) <= MAX_TOTAL_SHOTS;
  }

  activateBonusStones(currentTotalRocks) {
    if (!this.canUseBonusStones(currentTotalRocks)) return 0;
    if (!this.consumeItem('bonus_stones_3', 1)) return 0;
    this.bonusStonesUsed += BONUS_STONES_PER_PACK;
    this.assistsUsed.bonusStones += BONUS_STONES_PER_PACK;
    return BONUS_STONES_PER_PACK;
  }

  // ── Second Chance ──────────────────────────────────────────────────────────

  get canBuySecondChance() {
    return this.secondChancesUsed < MAX_SECOND_CHANCES_PER_RUN;
  }

  get nextSecondChancePrice() {
    if (!this.canBuySecondChance) return null;
    return SECOND_CHANCE_PRICES[this.secondChancesUsed] || 5000;
  }

  recordSecondChanceDelivered() {
    this.secondChancesUsed++;
    this.assistsUsed.secondChance++;
  }

  // ── Summary & Assists Transparency ─────────────────────────────────────────

  get hasUsedAssists() {
    return (
      this.assistsUsed.slowTime > 0 ||
      this.assistsUsed.bonusStones > 0 ||
      this.assistsUsed.secondChance > 0 ||
      this.assistsUsed.streakShield > 0
    );
  }

  getAssistsSummary() {
    const list = [];
    if (this.assistsUsed.slowTime > 0) list.push(`🐢 Slow Time ×${this.assistsUsed.slowTime}`);
    if (this.assistsUsed.bonusStones > 0) list.push(`🪨 Bonus Stones +${this.assistsUsed.bonusStones}`);
    if (this.assistsUsed.secondChance > 0) list.push(`⚡ 2nd Chance ×${this.assistsUsed.secondChance}`);
    if (this.assistsUsed.streakShield > 0) list.push(`🛡 Shield ×${this.assistsUsed.streakShield}`);
    return {
      hasAssists: this.hasUsedAssists,
      list,
      tag: this.hasUsedAssists ? '⚡ Assisted' : '🎯 Pure Run',
      raw: { ...this.assistsUsed },
    };
  }
}
