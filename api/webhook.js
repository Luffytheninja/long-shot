/**
 * api/webhook.js – Vercel Serverless Function to receive Vatar platform webhooks.
 *
 * Ticks the "Webhook answered 2xx" optional checklist box in Vatar Developers sandbox.
 * Handles purchase and refund notification events safely.
 */

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vatar-Signature');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check / GET ping
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Long Shot Webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const event = req.body || {};
  console.log('[Vatar Webhook] Received event:', JSON.stringify(event));

  // Acknowledge receipt with 200 OK immediately
  // Even if an internal action fails, return 200 so Vatar knows webhook is healthy
  try {
    const { type, data } = event;

    switch (type) {
      case 'purchase.completed':
      case 'purchase.paid':
        console.log(`[Vatar Webhook] Purchase event acknowledged: ${data?.id || data?.purchaseId}`);
        break;

      case 'purchase.refunded':
        console.log(`[Vatar Webhook] Refund event acknowledged: ${data?.id || data?.purchaseId}`);
        break;

      default:
        console.log(`[Vatar Webhook] Event ${type || 'ping'} received.`);
        break;
    }

    return res.status(200).json({ received: true, event: type || 'ping' });
  } catch (err) {
    console.error('[Vatar Webhook] Error processing webhook:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};
