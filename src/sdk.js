/**
 * sdk.js – Lagos Life (Vatar Games SDK v1) wrapper with mock fallback.
 *
 * The SDK script is loaded from Lagos Life's CDN in index.html.
 * If Vatar.init() throws "not_framed" (game is opened directly in a browser),
 * we substitute a mock player so development works without the platform frame.
 *
 * Exports a single async boot() that resolves to { player, live, sdk }.
 *
 * Usage:
 *   import { boot } from './sdk.js';
 *   const { player, live, sdk } = await boot();
 *   sdk.submitScore(score);
 *   sdk.leaderboard();
 *   sdk.onPause(cb);
 *   sdk.onResume(cb);
 */

// ── Mock implementation ───────────────────────────────────────────────────────
// Mirrors the real Vatar interface so the rest of the game can call sdk.* safely.

let _lastSubmit = 0;
let _lastLeaderboard = 0;

const MOCK_PLAYER = {
  id:     'local_dev',
  name:   'You (dev)',
  avatar: null,
};

function createMock() {
  return {
    submitScore(n) {
      console.log(`[mock SDK] submitScore(${n})`);
    },
    async leaderboard() {
      console.log('[mock SDK] leaderboard()');
    async purchase(productId) {
      console.log(`[mock SDK] purchase(${productId}) - test item unlocked`);
      return { success: true, mock: true, productId };
    },
    onPause(cb)  { window.addEventListener('blur',  cb); },
    onResume(cb) { window.addEventListener('focus', cb); },
  };
}

// ── Real SDK wrapper ──────────────────────────────────────────────────────────

function createReal(vatarPlayer, session) {
  return {
    submitScore(n) {
      const now = Date.now();
      if (now - _lastSubmit < 20_000) return; // throttle: once per 20 s
      _lastSubmit = now;
      if (typeof Vatar !== 'undefined') Vatar.submitScore(n);
    },
    async leaderboard() {
      const now = Date.now();
      if (now - _lastLeaderboard < 30_000) return null; // throttle: once per 30 s
      _lastLeaderboard = now;
      if (typeof Vatar !== 'undefined') return await Vatar.leaderboard();
      return null;
    },
    async purchase(productId) {
      if (typeof Vatar === 'undefined') throw new Error('Vatar SDK not available');
      // 1. Trigger Lagos Life purchase modal
      const result = await Vatar.purchase(productId);
      const purchaseId = result?.purchaseId || result?.id;
      if (!purchaseId) throw new Error('Purchase was cancelled or failed');

      // 2. Deliver via server /api/claim
      const claimRes = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, purchaseId }),
      });

      if (!claimRes.ok) {
        const err = await claimRes.text();
        throw new Error(`Server claim failed: ${err}`);
      }

      return await claimRes.json();
    },
    onPause(cb)  { if (typeof Vatar !== 'undefined') Vatar.onPause(cb);  },
    onResume(cb) { if (typeof Vatar !== 'undefined') Vatar.onResume(cb); },
  };
}

// ── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Initialises the SDK (or mock). Always resolves; never rejects.
 * @returns {Promise<{ player: object, live: boolean, sdk: object }>}
 */
export async function boot() {
  try {
    if (typeof Vatar === 'undefined') throw new Error('not_framed');
    const initData = await Vatar.init();
    const player = initData?.player || { id: 'unknown', name: 'Player' };
    const session = initData?.session || null;
    return { player, session, live: true, sdk: createReal(player, session) };
  } catch (e) {
    console.warn('[Long Shot] SDK not available – running in dev/mock mode:', e.message);
    return { player: MOCK_PLAYER, session: null, live: false, sdk: createMock() };
  }
}
