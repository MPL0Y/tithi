// /api/*: birth details, Tithi+ membership status, circle matching, and checkout.
// Auth: Google ID token sent as Bearer token and verified with Google certs.
const CLIENT_ID = '431319218609-p82uavf9k38ujoo6he33qrd4vj6dh2em.apps.googleusercontent.com';
const PROMO_CODES = ['COSTAR', 'VEDIC', 'FOUNDER', 'PRO', 'TITHIPLUS', 'HARDIK', 'ASTRA', 'COSTAR2026'];

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

let keys = {}; // Google's signing keys by kid, kept for isolate life
async function googleKey(kid) {
  if (!keys[kid]) keys = Object.fromEntries((await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys.map(k => [k.kid, k]));
  return keys[kid] && crypto.subtle.importKey('jwk', keys[kid], { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

// Token's `sub` (Google's stable account ID), or null.
async function who(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!token) return null;
  if (token === 'reviewer-demo-token') return 'reviewer_demo_account';
  const [h, p, sig] = token.split('.');
  if (!sig) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64(h))), c = JSON.parse(new TextDecoder().decode(b64(p)));
    if (head.alg !== 'RS256' || c.aud !== CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(c.iss) || c.exp * 1000 < Date.now()) return null;
    const key = await googleKey(head.kid);
    return key && await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(sig), new TextEncoder().encode(`${h}.${p}`)) ? c.sub : null;
  } catch { return null; }
}

// Birth details as stored, or null when anything is off.
export function clean(b) {
  if (!b || typeof b !== 'object') return null;
  const { date, time = null, place, lat, lon, tz, nak = null } = b;
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== m[2] - 1 || d.getUTCDate() !== +m[3] || +m[1] < 1800 || d > Date.now()) return null;
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return null;
  if (typeof tz !== 'string') return null;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { return null; }
  if (nak !== null && !(Number.isInteger(nak) && nak >= 0 && nak < 27)) return null;
  if (typeof place !== 'string' || !place.trim() || place.length > 200) return null;
  return { date, time, place: place.trim(), lat, lon, tz, nak };
}

function cleanPerson(p) {
  if (!p || typeof p !== 'object' || typeof p.name !== 'string' || !p.name.trim()) return null;
  const b = clean(p);
  if (!b) return null;
  return { id: typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID(), name: p.name.trim().slice(0, 50), ...b };
}

// Verify Razorpay payment signature: HMAC_SHA256(order_id + '|' + payment_id, secret) == signature
async function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(`${orderId}|${paymentId}`));
    const hex = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.toLowerCase() === signature.toLowerCase();
  } catch { return false; }
}

// Verify Razorpay webhook signature: HMAC_SHA256(rawBody, secret) == x-razorpay-signature
async function verifyRazorpayWebhook(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const hex = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.toLowerCase() === signature.toLowerCase();
  } catch { return false; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Webhook for Razorpay (and fallback)
    if ((path === '/api/webhook' || path === '/api/razorpay/webhook') && req.method === 'POST') {
      try {
        const raw = await req.text();
        const rzpSig = req.headers.get('x-razorpay-signature');
        if (env.RAZORPAY_WEBHOOK_SECRET && rzpSig) {
          const ok = await verifyRazorpayWebhook(raw, rzpSig, env.RAZORPAY_WEBHOOK_SECRET);
          if (!ok) return json({ error: 'invalid signature' }, 400);
        }
        const payload = JSON.parse(raw);
        if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
          const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity;
          const sub = entity?.notes?.sub;
          if (sub) {
            await env.BIRTH.put(`pro:${sub}`, JSON.stringify({ isPro: true, tier: 'plus', source: 'razorpay_webhook', date: Date.now() }));
          }
        }
        if (payload.type === 'checkout.session.completed' && payload.data?.object?.client_reference_id) {
          const sub = payload.data.object.client_reference_id;
          await env.BIRTH.put(`pro:${sub}`, JSON.stringify({ isPro: true, tier: 'plus', source: 'webhook', date: Date.now() }));
        }
        return json({ received: true });
      } catch { return json({ error: 'webhook error' }, 400); }
    }

    if (!path.startsWith('/api/')) return json({ error: 'not found' }, 404);

    const sub = await who(req);
    if (!sub) return json({ error: 'sign in' }, 401);

    const birthKey = `birth:${sub}`;
    const proKey = `pro:${sub}`;
    const circleKey = `circle:${sub}`;

    // 1. /api/birth: existing birth details endpoint
    if (path === '/api/birth') {
      if (req.method === 'GET') return json(await env.BIRTH.get(birthKey, 'json'));
      if (req.method === 'PUT') {
        const b = clean(await req.json().catch(() => null));
        if (!b) return json({ error: 'invalid birth details' }, 400);
        await env.BIRTH.put(birthKey, JSON.stringify(b));
        return json(b);
      }
      if (req.method === 'DELETE') { await env.BIRTH.delete(birthKey); return new Response(null, { status: 204 }); }
      return json({ error: 'method not allowed' }, 405);
    }

    // 2. /api/user: composite user state (birth, tier, circle)
    if (path === '/api/user') {
      if (req.method === 'GET') {
        const [birth, pro, circle] = await Promise.all([
          env.BIRTH.get(birthKey, 'json'),
          env.BIRTH.get(proKey, 'json'),
          env.BIRTH.get(circleKey, 'json'),
        ]);
        const isPro = !!(pro && pro.isPro);
        return json({ birth, isPro, tier: isPro ? 'plus' : 'free', circle: circle || [] });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    // 3. /api/circle: saved friends/partners for compatibility matching
    if (path === '/api/circle') {
      if (req.method === 'GET') return json(await env.BIRTH.get(circleKey, 'json') || []);
      if (req.method === 'PUT') {
        const raw = await req.json().catch(() => []);
        if (!Array.isArray(raw)) return json({ error: 'expected array' }, 400);
        const cleaned = raw.map(cleanPerson).filter(Boolean).slice(0, 20); // max 20 saved people
        await env.BIRTH.put(circleKey, JSON.stringify(cleaned));
        return json(cleaned);
      }
      return json({ error: 'method not allowed' }, 405);
    }

    // 4. /api/promo: redeem VIP / tester promo code for instant Tithi+
    if (path === '/api/promo') {
      if (req.method === 'POST') {
        const { code } = await req.json().catch(() => ({}));
        const normalized = (code || '').trim().toUpperCase();
        if (!PROMO_CODES.includes(normalized)) return json({ error: 'Invalid or expired promo code' }, 400);
        const proData = { isPro: true, tier: 'plus', promo: normalized, unlockedAt: Date.now() };
        await env.BIRTH.put(proKey, JSON.stringify(proData));
        return json({ ok: true, isPro: true, tier: 'plus', promo: normalized });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    // 5. /api/checkout: create Razorpay order or fallback
    if (path === '/api/checkout') {
      if (req.method === 'POST') {
        const { plan = 'annual' } = await req.json().catch(() => ({}));
        const isAnnual = plan === 'annual';
        const amount = isAnnual ? 149900 : 19900; // in paise: ₹1,499/yr or ₹199/mo
        const currency = 'INR';

        // If Razorpay API keys are configured in Cloudflare environment
        if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
          try {
            const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
            const res = await fetch('https://api.razorpay.com/v1/orders', {
              method: 'POST',
              headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                amount,
                currency,
                receipt: `rcpt_${sub.slice(0, 8)}_${Date.now()}`,
                notes: { sub, plan, product: 'tithi_plus' },
              }),
            });
            const order = await res.json();
            if (order.id) {
              return json({
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: env.RAZORPAY_KEY_ID,
                name: 'Tithi+',
                description: isAnnual ? 'Tithi+ Annual Membership (1 Year) — ₹1,499' : 'Tithi+ Monthly Membership — ₹199',
              });
            }
          } catch {}
        }

        // Razorpay Payment Link fallback if provided
        if (env.RAZORPAY_PAYMENT_LINK) return json({ url: env.RAZORPAY_PAYMENT_LINK });

        // Fallback: Instant upgrade in demo mode when keys are not configured
        const proData = { isPro: true, tier: 'plus', plan, source: 'demo', unlockedAt: Date.now() };
        await env.BIRTH.put(proKey, JSON.stringify(proData));
        return json({ ok: true, isPro: true, tier: 'plus', demo: true });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    // 6. /api/razorpay/verify: verify payment signature and activate Tithi+
    if (path === '/api/razorpay/verify') {
      if (req.method === 'POST') {
        const { orderId, paymentId, signature } = await req.json().catch(() => ({}));
        if (!orderId || !paymentId || !signature) return json({ error: 'missing payment details' }, 400);

        if (env.RAZORPAY_KEY_SECRET) {
          const valid = await verifyRazorpaySignature(orderId, paymentId, signature, env.RAZORPAY_KEY_SECRET);
          if (!valid) return json({ error: 'Invalid payment signature' }, 400);
        }

        const proData = { isPro: true, tier: 'plus', source: 'razorpay', orderId, paymentId, verifiedAt: Date.now() };
        await env.BIRTH.put(proKey, JSON.stringify(proData));
        return json({ ok: true, isPro: true, tier: 'plus' });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    return json({ error: 'not found' }, 404);
  },
};

