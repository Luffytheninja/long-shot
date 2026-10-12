/**
 * rng.js – mulberry32 seeded pseudo-random number generator.
 *
 * Returns a function that yields deterministic floats in [0, 1).
 * NEVER use Math.random() in gameplay logic – always use this.
 *
 * Usage:
 *   import { makeRng, hashSeed } from './rng.js';
 *   const rand = makeRng(hashSeed('bottle-2026-10-12'));
 *   rand(); // → 0.someFloat
 */

export function makeRng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * hashSeed – converts an arbitrary string to a 32-bit integer seed.
 * Uses djb2 so it is simple, fast and stable across JS engines.
 */
export function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * dailySeed – returns today's deterministic seed (UTC date).
 * Every player on the same UTC day gets the same seed.
 */
export function dailySeed() {
  const d = new Date();
  const key = `bottle-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return hashSeed(key);
}

/**
 * practiceSeed – returns a fresh random seed using the CSPRNG.
 */
export function practiceSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}
