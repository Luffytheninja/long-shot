/**
 * api/claim.js – Vercel Serverless Function to verify and deliver purchases.
 *
 * Flow:
 * 1. Player triggers Vatar.purchase(productId) in game.
 * 2. Game sends { session, purchaseId } to /api/claim.
 * 3. Server calls POST /session/verify to authenticate the player.
 * 4. Server calls GET /purchases/{id} to verify payment status and ownership.
 * 5. Server calls POST /purchases/{id}/deliver to mark item delivered in Lagos Life.
 */

const VATAR_API_BASE = 'https://lagoslife.app/api/games/v1';

module.exports = async function handler(req, res) {
  // CORS & method check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.VATAR_SECRET;
  if (!secret) {
    console.error('Missing VATAR_SECRET in environment variables');
    return res.status(500).json({ error: 'Server misconfigured: missing VATAR_SECRET' });
  }

  const { session, purchaseId } = req.body || {};
  if (!session || !purchaseId) {
    return res.status(400).json({ error: 'Missing session or purchaseId' });
  }

  const authHeaders = {
    'Authorization': `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Verify player session
    const sessionRes = await fetch(`${VATAR_API_BASE}/session/verify`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ session }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      return res.status(401).json({ error: 'Invalid session', details: err });
    }

    const { playerId } = await sessionRes.json();

    // 2. Fetch purchase details from Vatar API
    const purchaseRes = await fetch(`${VATAR_API_BASE}/purchases/${purchaseId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!purchaseRes.ok) {
      const err = await purchaseRes.text();
      return res.status(404).json({ error: 'Purchase not found', details: err });
    }

    const purchase = await purchaseRes.json();

    // 3. Verify status and player match
    if (purchase.status !== 'paid') {
      return res.status(400).json({ error: `Purchase not paid (status: ${purchase.status})` });
    }

    if (purchase.playerId && purchase.playerId !== playerId) {
      return res.status(403).json({ error: 'Purchase belongs to another player' });
    }

    // 4. Mark purchase as delivered
    const deliverRes = await fetch(`${VATAR_API_BASE}/purchases/${purchaseId}/deliver`, {
      method: 'POST',
      headers: authHeaders,
    });

    if (!deliverRes.ok) {
      const err = await deliverRes.text();
      return res.status(500).json({ error: 'Failed to deliver purchase', details: err });
    }

    return res.status(200).json({
      success: true,
      delivered: true,
      productId: purchase.productId,
      playerId,
    });

  } catch (error) {
    console.error('Error claiming purchase:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
