// /api/birth: one set of birth details per Google account, in KV. Everything else is served as static assets.
// Auth: the Google ID token the page got at sign-in, sent as a Bearer token and verified here.
const CLIENT_ID = '431319218609-p82uavf9k38ujoo6he33qrd4vj6dh2em.apps.googleusercontent.com';

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

let keys = {}; // Google's signing keys by kid, kept for the isolate's life; refetched when a new kid shows up
async function googleKey(kid) {
  if (!keys[kid]) keys = Object.fromEntries((await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys.map(k => [k.kid, k]));
  return keys[kid] && crypto.subtle.importKey('jwk', keys[kid], { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

// The token's `sub` (Google's stable account id), or null.
async function who(req) {
  const [h, p, sig] = (req.headers.get('authorization') || '').replace(/^Bearer /, '').split('.');
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

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname !== '/api/birth') return json({ error: 'not found' }, 404);
    const sub = await who(req);
    if (!sub) return json({ error: 'sign in' }, 401);
    const key = `birth:${sub}`;
    if (req.method === 'GET') return json(await env.BIRTH.get(key, 'json'));
    if (req.method === 'PUT') {
      const b = clean(await req.json().catch(() => null));
      if (!b) return json({ error: 'invalid birth details' }, 400);
      await env.BIRTH.put(key, JSON.stringify(b));
      return json(b);
    }
    if (req.method === 'DELETE') { await env.BIRTH.delete(key); return new Response(null, { status: 204 }); }
    return json({ error: 'method not allowed' }, 405);
  },
};
