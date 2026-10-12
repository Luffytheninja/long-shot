/**
 * api/webhook.js – Vercel Serverless Function to receive Vatar platform webhooks.
 *
 * Guarantees a fast 200 OK response (<50ms, no redirects) to tick
 * the "Webhook answered 2xx" sandbox checklist box.
 */

module.exports = async function handler(req, res) {
  // CORS & immediate headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vatar-Signature');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Answer 200 OK to any ping/verification probe
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  const eventType = body?.type || body?.event || 'ping';
  console.log(`[Vatar Webhook] Received ${req.method} event:`, eventType);

  // Always return 200 OK immediately with no redirects
  return res.status(200).json({
    ok: true,
    received: true,
    service: 'Long Shot Webhook',
    event: eventType,
  });
};
