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
export const GRAVITY        = 80;   // world units / s²  (downward)
export const FIXED_DT       = 1 / 120; // seconds per physics tick
export const MAX_DRAG       = 14;   // world units – maximum slingshot pull
export const LAUNCH_SCALE   = 2.6;  // multiplier: drag length → launch speed
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

// ─── Spawn timing ─────────────────────────────────────────────────────────────
export const GAP_EARLY_MIN  = 1.2;  // seconds, start of round
export const GAP_EARLY_MAX  = 2.4;
export const GAP_LATE_MIN   = 0.8;  // seconds, 60 s into round
export const GAP_LATE_MAX   = 1.6;
export const RAMP_DURATION  = 60;   // seconds over which gap narrows

// ─── Trajectory preview ───────────────────────────────────────────────────────
export const TRAJECTORY_SHOTS = 3;  // show dots only on first N shots
export const TRAJECTORY_DOTS  = 8;  // number of preview dots

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
