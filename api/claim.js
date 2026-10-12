/**
 * api/claim.js – Serverless Function to verify and deliver purchases.
 *
 * Lagos Life (Vatar) Specification:
 * 1. GET /purchases/<purchaseId> with Bearer $VATAR_SECRET (verifies purchase)
 * 2. POST /purchases/<purchaseId>/deliver with Bearer $VATAR_SECRET (marks delivered)
 */

const VATAR_API_BASE = 'https://lagoslife.app/api/games/v1';

module.exports = async function handler(req, res) {
  // CORS & method check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.VATAR_SECRET;
  if (!secret) {
    console.error('[claim] Missing VATAR_SECRET in environment variables');
    return res.status(500).json({ error: 'Server misconfigured: missing VATAR_SECRET' });
  }

  const { purchaseId, session } = req.body || {};
  if (!purchaseId) {
    console.warn('[claim] Missing purchaseId in request body:', req.body);
    return res.status(400).json({ error: 'Missing purchaseId' });
  }

  console.log(`[claim] Verifying purchaseId: ${purchaseId}`);

  const authHeaders = {
    'Authorization': `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Fetch & verify purchase details from Vatar API
    // This satisfies "A purchase verified by your server"
    const purchaseRes = await fetch(`${VATAR_API_BASE}/purchases/${purchaseId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!purchaseRes.ok) {
      const err = await purchaseRes.text();
      console.error(`[claim] Error fetching purchase ${purchaseId}: ${purchaseRes.status}`, err);
      return res.status(purchaseRes.status).json({ error: 'Purchase verification failed', details: err });
    }

    const purchase = await purchaseRes.json();
    console.log(`[claim] Purchase verified:`, purchase);

    // 2. Mark purchase as delivered
    // This satisfies "One marked delivered"
    const deliverRes = await fetch(`${VATAR_API_BASE}/purchases/${purchaseId}/deliver`, {
      method: 'POST',
      headers: authHeaders,
    });

    if (!deliverRes.ok) {
      const err = await deliverRes.text();
      console.error(`[claim] Error delivering purchase ${purchaseId}: ${deliverRes.status}`, err);
      return res.status(deliverRes.status).json({ error: 'Failed to deliver purchase', details: err });
    }

    const deliverData = await deliverRes.json().catch(() => ({}));
    console.log(`[claim] Purchase delivered successfully:`, deliverData);

    return res.status(200).json({
      success: true,
      delivered: true,
      purchaseId,
      productId: purchase?.productId,
    });

  } catch (error) {
    console.error('[claim] Internal error claiming purchase:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
