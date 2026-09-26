// Self-check against Drik Panchang festival dates.
// Run: npm i --no-save astronomy-engine && node test.js
const assert = require('assert');
const P = require('./panchang.js');
const DELHI = { lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata' };
const LONDON = { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' };

// All festival dates for loc from `from` (UTC date) over `days` days: { name: ['y-m-d', ...] }.
function festivalsFor(loc, from, days) {
  const fest = {}, b = k => { const d = new Date(from + k * 864e5); return P.brief(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), loc); };
  let prev = b(-1), cur = b(0);
  for (let k = 1; k <= days; k++) {
    const next = b(k);
    for (const f of P.festivals(prev, cur, next)) (fest[f] = fest[f] || []).push(`${cur.y}-${cur.m + 1}-${cur.d}`);
    prev = cur; cur = next;
  }
  return fest;
}
// "a|b" = either (Drik lists both traditions that year).
function check(label, fest, want) {
  for (const [name, dates] of Object.entries(want)) for (const date of dates)
    assert(date.split('|').some(x => (fest[name] || []).includes(x)), `${label} ${name}: expected ${date}, got ${fest[name]}`);
}

check('Delhi', festivalsFor(DELHI, Date.UTC(2025, 0, 1), 1095), {
  'Maha Shivaratri': ['2025-2-26', '2026-2-15', '2027-3-6'],
  // 2026: Drik moves Holika Dahan to 3 Mar and Holi to 4 Mar, most likely for that evening's lunar eclipse (not modelled).
  'Holika Dahan': ['2025-3-13', '2027-3-21'], Holi: ['2025-3-14', '2027-3-22'],
  'Ugadi · Gudi Padwa · Chaitra Navratri': ['2026-3-19', '2027-4-7'], 'Rama Navami': ['2025-4-6', '2026-3-26|2026-3-27', '2027-4-15'],
  'Hanuman Jayanti': ['2025-4-12', '2026-4-2', '2027-4-20'], 'Akshaya Tritiya': ['2025-4-30', '2026-4-19', '2027-5-9'],
  'Raksha Bandhan': ['2025-8-9', '2026-8-28', '2027-8-17'], 'Krishna Janmashtami': ['2025-8-15|2025-8-16', '2026-9-4', '2027-8-25'],
  'Ganesh Chaturthi': ['2025-8-27', '2026-9-14', '2027-9-4'], 'Anant Chaturdashi': ['2026-9-25', '2027-9-14'],
  Dussehra: ['2025-10-2', '2026-10-20', '2027-10-9'], 'Sharad Purnima': ['2025-10-6', '2026-10-25', '2027-10-14'],
  'Karwa Chauth': ['2025-10-10', '2026-10-29', '2027-10-18'], Dhanteras: ['2025-10-18', '2026-11-6', '2027-10-27'],
  'Narak Chaturdashi': ['2025-10-20', '2026-11-8', '2027-10-28'], 'Diwali · Lakshmi Puja': ['2025-10-20', '2026-11-8', '2027-10-29'],
  'Govardhan Puja': ['2025-10-22', '2026-11-10', '2027-10-30'], 'Bhai Dooj': ['2025-10-23', '2026-11-11', '2027-10-31'],
  'Chhath Puja': ['2025-10-27', '2026-11-15', '2027-11-4'], 'Makar Sankranti · Pongal': ['2026-1-14', '2027-1-15'],
  'Vasant Panchami': ['2027-2-11'],
});
check('London', festivalsFor(LONDON, Date.UTC(2026, 0, 1), 365), {
  'Maha Shivaratri': ['2026-2-15'], 'Holika Dahan': ['2026-3-2'], Holi: ['2026-3-3'], 'Rama Navami': ['2026-3-26'],
  'Akshaya Tritiya': ['2026-4-19'], 'Raksha Bandhan': ['2026-8-27'], 'Krishna Janmashtami': ['2026-9-3|2026-9-4'],
  'Ganesh Chaturthi': ['2026-9-14'], Dussehra: ['2026-10-20'], 'Sharad Purnima': ['2026-10-25'], 'Karwa Chauth': ['2026-10-29'],
  Dhanteras: ['2026-11-6'], 'Diwali · Lakshmi Puja': ['2026-11-8'], 'Govardhan Puja': ['2026-11-9'], 'Bhai Dooj': ['2026-11-10'],
});

const d = P.day(2025, 9, 20, DELHI);
assert.equal(d.vara, 'Somavara');
assert.equal(d.amanta, 'Ashwin');
assert.equal(d.vikram, 2082);
assert.equal(d.nakshatra[0].name, 'Hasta');
console.log('ok');
