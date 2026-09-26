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

// For you. Reference values from Drik Panchang's Janma Kundali, Tarabalam/Chandrabalam and Shani transit pages.
const near = (d, iso, min, label) => assert(Math.abs(d - new Date(iso)) <= min * 60e3, `${label}: expected ${iso}, got ${d.toISOString()}`);
// Birth Moon: nakshatra, pada, rashi. Mumbai is 6′ short of the Magha/Purva Phalguni line; London is in BST.
for (const [b, nak, pada, rashi] of [
  [{ date: '1990-05-15', time: '10:30', lat: 28.652, lon: 77.231, tz: 'Asia/Kolkata' }, 'Uttara Ashadha', 1, 'Dhanu'], // Moon 29°50′23″ Dhanu
  [{ date: '1988-11-03', time: '23:40', lat: 19.073, lon: 72.883, tz: 'Asia/Kolkata' }, 'Magha', 4, 'Simha'], // 13°14′21″ Simha
  [{ date: '1995-07-20', time: '14:00', lat: 51.509, lon: -0.126, tz: 'Europe/London' }, 'Bharani', 1, 'Mesha'], // 15°38′25″ Mesha
]) {
  const n = P.natal(b);
  assert.deepEqual([n.nakName, n.pada, n.rashiName], [nak, pada, rashi], `natal ${b.date}`);
}
assert.deepEqual(P.candidates({ date: '1988-11-03', time: '23:40', tz: 'Asia/Kolkata' }).map(i => P.NAKSHATRA[i]), ['Magha', 'Purva Phalguni']);
assert.equal(P.natal({ date: '1988-11-03', time: '23:40', tz: 'Asia/Kolkata', nak: 10 }).nakName, 'Purva Phalguni');

// Tara bala and chandra bala in Delhi for a Rohini (Vrishabha) native; chandrashtama for Vrishchika.
const ROHINI = { nak: 3, rashi: 1 };
for (const [y, m, dd, tara, chandra] of [
  [2026, 8, 26, [['Kshema', '2026-09-26T11:32+05:30'], ['Pratyak']], [[11, 'good']]],
  [2026, 9, 3, [['Vipat', '2026-10-04T01:29+05:30'], ['Kshema']], [[2, 'bad']]],
  [2027, 0, 15, [['Sadhana', '2027-01-15T23:51+05:30'], ['Naidhana']], [[11, 'good', '2027-01-15T23:51+05:30'], [12, 'bad']]],
]) {
  const me = P.personal(P.day(y, m, dd, DELHI), ROHINI);
  assert.deepEqual(me.tara.map(x => x.name), tara.map(x => x[0]), `tara ${y}-${m + 1}-${dd}`);
  tara.forEach(([, end], k) => end && near(me.tara[k].end, end, 2, `tara end ${y}-${m + 1}-${dd}`));
  assert.deepEqual(me.chandra.map(x => [x.house, x.kind]), chandra.map(x => x.slice(0, 2)), `chandra ${y}-${m + 1}-${dd}`);
  chandra.forEach(([, , end], k) => end && near(me.chandra[k].end, end, 2, `chandra end ${y}-${m + 1}-${dd}`));
}
assert(P.personal(P.day(2026, 9, 3, DELHI), { nak: 16, rashi: 7 }).chandra.every(x => x.ashtama));

// Vimshottari for the Delhi birth above: Rahu 10 Dec 2011 – 10 Dec 2029, Surya antardasha 29 Jun 2026 – 23 May 2027.
const ds = P.dasha(P.natal({ date: '1990-05-15', time: '10:30', tz: 'Asia/Kolkata' }), new Date('2026-09-26'));
assert.deepEqual([ds.maha.lord, ds.antar.lord], ['Rahu', 'Sun']);
near(ds.maha.start, '2011-12-10T18:17+05:30', 2880, 'Rahu start'); near(ds.maha.end, '2029-12-10T09:02+05:30', 2880, 'Rahu end');
near(ds.antar.start, '2026-06-29T05:48+05:30', 2880, 'Surya start'); near(ds.antar.end, '2027-05-23T23:21+05:30', 2880, 'Surya end');

// Sade Sati for a Kumbha Moon: Saturn enters Makara 24 Jan 2020 12:10, leaves Meena for good 23 Feb 2028 20:00 (IST; ours is within ~1h).
const sade = iso => P.transits(new Date(iso), { rashi: 10, dashaStart: new Date(0), dashaLord: 0 }).sadeSati;
assert.deepEqual(['2020-01-24T06:00+05:30', '2020-01-24T18:00+05:30', '2023-02-01', '2025-04-05', '2027-07-01', '2027-11-01', '2028-02-23T12:00+05:30', '2028-02-24T12:00+05:30'].map(sade),
  [null, 'rising', 'peak', 'setting', null, 'setting', 'setting', null]);

// Best windows never overlap Rahu kalam (or the other avoided periods), and only fall in good tara and chandra bala.
for (let k = 0; k < 60; k++) {
  const day = P.day(2026, 0, 1 + k, DELHI), me = P.personal(day, { nak: k % 27, rashi: k % 12 });
  for (const w of me.windows) for (const r of [day.rahu, day.yamaganda, day.gulika, ...day.durMuhurta])
    assert(w.end <= r.start || w.start >= r.end, `window overlaps an avoided period on day ${k}`);
  for (const w of me.windows) for (const x of [...me.tara, ...me.chandra]) if (x.kind !== 'good') assert(w.end <= x.start || w.start >= x.end, `window in a bad span on day ${k}`);
}
console.log('ok');
