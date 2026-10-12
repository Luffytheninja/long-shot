/**
 * constants.js – single source of truth for all game tuning numbers.
 *
 * World coordinate system:
 *   - The play field is 100 units wide (WORLD_W).
 *   - Heights are proportional so portrait phones stay fair.
 *   - Pixels-per-unit is computed at runtime from canvas size.
 */

// ─── World dimensions ────────────────────────────────────────────────────────
export const WORLD_W = 100;      // world units across the screen
export const WORLD_H = 216;      // world units tall (≈ 375×812 ratio)

// ─── Physics ─────────────────────────────────────────────────────────────────
export const GRAVITY        = 42;   // world units / s² (downward)
export const FIXED_DT       = 1 / 120; // seconds per physics tick
export const MAX_DRAG       = 26;   // world units – generous thumb stroke on mobile (was 14)
export const MIN_SPEED      = 22;   // gentle minimum speed for close-up finesse
export const MAX_SPEED      = 108;  // maximum speed needed to reach the highest bottle tier
export const DRAG_EXPONENT  = 1.35; // progressive power curve (soft at low pull, ramps at deep pull)
export const ROCK_RADIUS    = 1.2;  // world units

// ─── Slingshot anchor ────────────────────────────────────────────────────────
// Slingshot sits bottom-centre. Pouch rests at SLING_Y when idle.
export const SLING_X        = 50;   // world units from left
export const SLING_Y        = 185;  // world units from top (near bottom)
export const FORK_SPREAD    = 4;    // half-width between fork tips (world units)
export const FORK_HEIGHT    = 8;    // height of the Y-fork above anchor point

// ─── Round rules ─────────────────────────────────────────────────────────────
export const TOTAL_ROCKS    = 15;
export const COMBO_STEP     = 0.25; // multiplier gained per consecutive hit
export const MAX_MULTIPLIER = 2.0;
export const STREAK_BONUS_AT = 5;  // hits in a row to earn the bonus
export const STREAK_BONUS   = 50;  // flat bonus points

// ─── Distance / difficulty tiers ─────────────────────────────────────────────
// distance: shelf X position in world units from sling anchor
// scale:    bottle visual scale (1 = full size)
// points:   base points for a hit
// stayStart: how long (s) a bottle stays at the START of the round
// The stay time shrinks by up to 25% over the full round.
export const TIERS = [
  { id: 1, name: 'Close', distance: 8,  scale: 1.00, points: 10, stayStart: 4.0 },
  { id: 2, name: 'Near',  distance: 14, scale: 0.80, points: 20, stayStart: 3.4 },
  { id: 3, name: 'Mid',   distance: 22, scale: 0.62, points: 35, stayStart: 2.9 },
  { id: 4, name: 'Far',   distance: 32, scale: 0.47, points: 55, stayStart: 2.4 },
  { id: 5, name: 'Long',  distance: 45, scale: 0.35, points: 80, stayStart: 2.0 },
];

// ─── Difficulty ramp ──────────────────────────────────────────────────────────
export const RAMP_DURATION  = 60;   // seconds over which tier weighting shifts easy→hard

// ─── Trajectory preview ───────────────────────────────────────────────────────
export const TRAJECTORY_SHOTS = Infinity;  // always show aim assist while dragging
export const TRAJECTORY_DOTS  = 22;        // long preview arc across the screen (was 10)

// ─── Bottle spawn timing ──────────────────────────────────────────────────────
// One bottle at a time. Next spawns immediately after current is hit or expires.
export const BOTTLE_STAY_MIN  = 4.5;  // seconds minimum on screen (+2s)
export const BOTTLE_STAY_MAX  = 6.5;  // seconds maximum on screen (+2s)

// ─── Horizontal spawn zones (world units) ────────────────────────────────────
// Three zones: left / centre / right. Bottles are placed with jitter inside each zone.
export const SPAWN_ZONES = [
  { name: 'left',   xMin: 20, xMax: 36 },
  { name: 'centre', xMin: 43, xMax: 57 },
  { name: 'right',  xMin: 64, xMax: 80 },
];

// ─── Colours (placeholder art) ────────────────────────────────────────────────
export const CLR_SKY        = '#1a1a2e';
export const CLR_GROUND     = '#3d2c1e';
export const CLR_SHELF      = '#5c4033';
export const CLR_BOTTLE     = '#2e7d32';
export const CLR_ROCK       = '#8d6e63';
export const CLR_BAND       = '#795548';
export const CLR_HIT        = '#ffeb3b';
export const CLR_MISS       = '#ef5350';
export const CLR_UI_BG      = 'rgba(0,0,0,0.72)';
export const CLR_UI_TEXT    = '#ffffff';
export const CLR_ACCENT     = '#ff9800';

// ─── Power-up product catalogue ───────────────────────────────────────────────
// Prices are test hypotheses; verify Vatar's price limits before going live.
export const PRODUCTS = {
  slow_time:      { id: 'slow_time',      name: 'Slow Time',      price: 100,  emoji: '🐢', desc: 'Bottles expire 35% slower for 4 s.' },
  bonus_stones_3: { id: 'bonus_stones_3', name: '3 Bonus Stones', price: 100,  emoji: '🪨', desc: 'Adds 3 extra shots to your next round.' },
  streak_shield:  { id: 'streak_shield',  name: 'Streak Shield',  price: 150,  emoji: '🛡', desc: 'One miss won\'t break your combo.' },
  second_chance:  { id: 'second_chance',  name: 'Second Chance',  price: null, emoji: '⚡', desc: 'One extra shot after your last stone. Price rises per use.' },
};

// Second Chance escalating prices (₦) — index = number already used this run
export const SECOND_CHANCE_PRICES     = [500, 1000, 3500, 5000];
export const MAX_SECOND_CHANCES_PER_RUN = 4;

// Slow Time
export const SLOW_TIME_DURATION  = 4.0;   // seconds the effect lasts
export const SLOW_TIME_FACTOR    = 0.65;  // bottle countdown ticks at 65% speed (35% slower)

// Bonus Stones
export const BONUS_STONES_PER_PACK = 3;

// Hard cap on total shots per run (base 15 + bonuses + second chances)
export const MAX_TOTAL_SHOTS = 25;

