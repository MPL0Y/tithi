// Panchang calculations on top of astronomy-engine. Sidereal = Lahiri.
(function (root, A) {
  const TITHI = ['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi'];
  const NAKSHATRA = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
  const YOGA = ['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
  const KARANA_MOVABLE = ['Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti'];
  const RASHI = ['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrishchika','Dhanu','Makara','Kumbha','Meena'];
  const MASA = ['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashwin','Kartika','Margashirsha','Pausha','Magha','Phalguna'];
  const RITU = ['Vasanta','Grishma','Varsha','Sharad','Hemanta','Shishira'];
  const VARA = ['Ravivara','Somavara','Mangalavara','Budhavara','Guruvara','Shukravara','Shanivara'];
  const PLANET = ['Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars']; // Chaldean order (hora)
  const DAY_LORD = [0, 3, 6, 2, 5, 1, 4]; // weekday -> index in PLANET
  const CHOG = ['Udveg','Char','Labh','Amrit','Kaal','Shubh','Rog'];
  const CHOG_KIND = { Udveg: 'bad', Char: 'neutral', Labh: 'good', Amrit: 'good', Kaal: 'bad', Shubh: 'good', Rog: 'bad' };
  const CHOG_DAY = [0, 3, 6, 2, 5, 1, 4], CHOG_NIGHT = [5, 1, 4, 0, 3, 6, 2];
  // 1-indexed eighth of the day, by weekday
  const RAHU = [8, 2, 7, 5, 6, 4, 3], YAMA = [5, 4, 3, 2, 1, 7, 6], GULIKA = [7, 6, 5, 4, 3, 2, 1];
  // 1-indexed day muhurtas (of 15), by weekday. ponytail: day-time only; Tuesday's night dur muhurta skipped.
  const DUR = [[14], [9, 12], [4], [8], [6, 12], [4, 9], [1, 2]];

  const HOUR = 3600e3, DAY = 24 * HOUR;
  const mod = (x, n) => ((x % n) + n) % n;
  const add = (d, ms) => new Date(d.getTime() + ms);

  // Lahiri (Chitra paksha) ayanamsa: its 1956 value carried by general precession (IAU 2006), plus nutation,
  // since the tropical longitudes below are true of date. Matches Drik Panchang's Moon to ~10″.
  const cent = d => (d.getTime() / DAY + 2440587.5 - 2451545) / 36525, prec = t => 5028.796195 * t + 1.1054348 * t * t;
  const LAHIRI_1956 = 23.250182778 - prec((2435553.5 - 2451545) / 36525) / 3600;
  const ayanamsa = d => LAHIRI_1956 + prec(cent(d)) / 3600 + A.e_tilt(A.MakeTime(d)).dpsi / 3600;
  const sunTrop = d => A.SunPosition(d).elon;
  const moonTrop = d => A.EclipticGeoMoon(d).lon;
  const sunSid = d => mod(sunTrop(d) - ayanamsa(d), 360);
  const moonSid = d => mod(moonTrop(d) - ayanamsa(d), 360);
  const elong = d => mod(moonTrop(d) - sunTrop(d), 360);

  const tithiIdx = d => Math.floor(elong(d) / 12);             // 0..29
  const nakIdx = d => Math.floor(moonSid(d) / (360 / 27));
  const yogaIdx = d => Math.floor(mod(sunSid(d) + moonSid(d), 360) / (360 / 27));
  const karanaIdx = d => Math.floor(elong(d) / 6);             // 0..59

  const tithiName = i => i === 14 ? 'Purnima' : i === 29 ? 'Amavasya' : TITHI[i % 15];
  const karanaName = i => i === 0 ? 'Kimstughna' : i >= 57 ? ['Shakuni', 'Chatushpada', 'Naga'][i - 57] : KARANA_MOVABLE[(i - 1) % 7];

  // First instant after t where idxFn changes. Every limb takes >8h, so 1h steps can't skip one.
  function nextChange(idxFn, t) {
    const i0 = idxFn(t);
    let lo = t, hi = add(t, HOUR);
    while (idxFn(hi) === i0) { lo = hi; hi = add(hi, HOUR); }
    while (hi - lo > 1000) {
      const mid = new Date((lo.getTime() + hi.getTime()) / 2);
      if (idxFn(mid) === i0) lo = mid; else hi = mid;
    }
    return hi;
  }

  // Limbs active between sunrise and next sunrise, each with its end time.
  function spans(idxFn, nameFn, from, to) {
    const out = [];
    let t = from;
    while (t < to) {
      const i = idxFn(t), end = nextChange(idxFn, t);
      out.push({ i, name: nameFn(i), end });
      t = end;
    }
    return out;
  }

  // --- time zone helpers (IANA zone, no library) ---
  function tzOffset(d, tz) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(d).map(x => [x.type, +x.value]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
  }
  // Wall-clock time in tz to an instant, with that date's own offset (history and DST).
  function localTime(y, m, d, h, mi, tz) {
    const t = Date.UTC(y, m, d, h, mi);
    const guess = t - tzOffset(new Date(t), tz);
    return new Date(t - tzOffset(new Date(guess), tz));
  }
  const localMidnight = (y, m, d, tz) => localTime(y, m, d, 0, 0, tz);

  // --- lunar month ---
  const newMoonBefore = d => A.SearchMoonPhase(0, d, -31).date;
  function masaAt(d) {
    const nm = newMoonBefore(d);
    const next = A.SearchMoonPhase(0, add(nm, DAY), 32).date;
    const r1 = Math.floor(sunSid(nm) / 30), r2 = Math.floor(sunSid(next) / 30);
    return { i: (r1 + 1) % 12, adhika: r1 === r2 };
  }

  const rise = (body, obs, dir, t) => { const r = A.SearchRiseSet(body, obs, dir, t, 1); return r && r.date; };

  // Cheap per-day summary used by month/year views.
  function brief(y, m, d, loc) {
    const obs = new A.Observer(loc.lat, loc.lon, 0);
    const mid = localMidnight(y, m, d, loc.tz);
    const sunrise = rise('Sun', obs, +1, mid) || add(mid, 6 * HOUR);
    const sunset = rise('Sun', obs, -1, sunrise) || add(sunrise, 12 * HOUR);
    const t = tithiIdx(sunrise), dl = sunset - sunrise, dayAt = f => tithiIdx(add(sunrise, dl * f));
    // Tithi at each festival's time of day (kala). Moonrise only matters around Krishna Chaturthi.
    const moonrise = t === 17 || t === 18 ? rise('Moon', obs, +1, sunset) : null;
    const at = {
      sunrise: t, purvahna: dayAt(0.4), // end of the forenoon: a tithi touching it counts
      madhyahna: dayAt(0.5), aparahna: dayAt(0.6), // start of the afternoon
      pradosh: tithiIdx(add(sunset, 1.2 * HOUR)), nishita: tithiIdx(add(sunset, (DAY - dl) / 2)),
      moonrise: moonrise ? tithiIdx(moonrise) : tithiIdx(add(sunset, 2 * HOUR)),
    };
    return { y, m, d, sunrise, tithi: t, at, nak: nakIdx(sunrise), moonRashi: Math.floor(moonSid(sunrise) / 30), sunRashiSet: Math.floor(sunSid(sunset) / 30), tithiName: tithiName(t), paksha: t < 15 ? 'Shukla' : 'Krishna', masa: masaAt(sunrise), sunRashi: Math.floor(sunSid(sunrise) / 30), weekday: new Date(Date.UTC(y, m, d)).getUTCDay() };
  }

  function day(y, m, d, loc) {
    const obs = new A.Observer(loc.lat, loc.lon, 0);
    const mid = localMidnight(y, m, d, loc.tz);
    const sunrise = rise('Sun', obs, +1, mid);
    if (!sunrise) return null; // polar day/night: no sunrise-based panchang
    const sunset = rise('Sun', obs, -1, sunrise);
    const nextSunrise = rise('Sun', obs, +1, add(sunset, HOUR));
    const prevSunset = rise('Sun', obs, -1, add(sunrise, -DAY));
    const wd = new Date(Date.UTC(y, m, d)).getUTCDay();
    const dayLen = sunset - sunrise, nightLen = nextSunrise - sunset;
    const part = (start, len, n, k) => ({ start: add(start, len / n * (k - 1)), end: add(start, len / n * k) });

    const t = tithiIdx(sunrise);
    const masa = masaAt(sunrise);
    // Purnimanta month runs one ahead during Krishna paksha
    const purnimanta = t >= 15 ? (masa.i + 1) % 12 : masa.i;
    const gy = y, early = m <= 3 && masa.i >= 8; // Jan–Apr before Chaitra still belongs to last year
    const nightMuhurta = (sunrise - prevSunset) / 15;

    const chog = (start, len, first, step) => Array.from({ length: 8 }, (_, k) => {
      const name = CHOG[mod(first + step * k, 7)];
      return { name, kind: CHOG_KIND[name], ...part(start, len, 8, k + 1) };
    });
    const horaStart = DAY_LORD[wd];
    const hora = Array.from({ length: 24 }, (_, k) => ({
      name: PLANET[(horaStart + k) % 7],
      ...(k < 12 ? part(sunrise, dayLen, 12, k + 1) : part(sunset, nightLen, 12, k - 11)),
    }));
    const tropSun = sunTrop(sunrise);

    return {
      sunrise, sunset, nextSunrise,
      moonrise: rise('Moon', obs, +1, mid), moonset: rise('Moon', obs, -1, mid),
      vara: VARA[wd], weekday: wd, phase: elong(sunrise), sunLon: sunSid(sunrise), moonLon: moonSid(sunrise),
      tithi: spans(tithiIdx, i => i % 15 === 14 ? tithiName(i) : `${i < 15 ? 'Shukla' : 'Krishna'} ${tithiName(i)}`, sunrise, nextSunrise),
      nakshatra: spans(nakIdx, i => NAKSHATRA[i], sunrise, nextSunrise),
      yoga: spans(yogaIdx, i => YOGA[i], sunrise, nextSunrise),
      karana: spans(karanaIdx, karanaName, sunrise, nextSunrise),
      paksha: t < 15 ? 'Shukla' : 'Krishna',
      amanta: (masa.adhika ? 'Adhika ' : '') + MASA[masa.i],
      purnimanta: (masa.adhika ? 'Adhika ' : '') + MASA[purnimanta],
      ritu: RITU[Math.floor(masa.i / 2)],
      ayana: tropSun >= 270 || tropSun < 90 ? 'Uttarayana' : 'Dakshinayana',
      vikram: gy + (early ? 56 : 57), shaka: gy - (early ? 79 : 78),
      sunRashi: RASHI[Math.floor(sunSid(sunrise) / 30)],
      moonRashi: spans(d => Math.floor(moonSid(d) / 30), i => RASHI[i], sunrise, nextSunrise),
      rahu: part(sunrise, dayLen, 8, RAHU[wd]),
      yamaganda: part(sunrise, dayLen, 8, YAMA[wd]),
      gulika: part(sunrise, dayLen, 8, GULIKA[wd]),
      abhijit: part(sunrise, dayLen, 15, 8),
      brahma: { start: add(sunrise, -2 * nightMuhurta), end: add(sunrise, -nightMuhurta) },
      durMuhurta: DUR[wd].map(k => part(sunrise, dayLen, 15, k)),
      choghadiya: { day: chog(sunrise, dayLen, CHOG_DAY[wd], 1), night: chog(sunset, nightLen, CHOG_NIGHT[wd], -2) },
      hora,
    };
  }

  // Festivals by amanta month / tithi index (0–29) / time of day the tithi must hold (default sunrise).
  const FEST = [
    [0, 0, 'Ugadi · Gudi Padwa · Chaitra Navratri'], [0, 8, 'Rama Navami', 'madhyahna'], [0, 14, 'Hanuman Jayanti'],
    [1, 2, 'Akshaya Tritiya', 'purvahna'], [1, 14, 'Buddha Purnima'], [2, 10, 'Nirjala Ekadashi'],
    [3, 1, 'Jagannath Rath Yatra'], [3, 10, 'Devshayani Ekadashi'], [3, 14, 'Guru Purnima'],
    [4, 4, 'Nag Panchami'], [4, 14, 'Raksha Bandhan'], [4, 22, 'Krishna Janmashtami'],
    [5, 3, 'Ganesh Chaturthi', 'madhyahna'], [5, 13, 'Anant Chaturdashi'], [5, 15, 'Pitru Paksha begins'], [5, 29, 'Sarva Pitru Amavasya'],
    [6, 0, 'Sharad Navratri begins'], [6, 7, 'Durga Ashtami'], [6, 9, 'Dussehra', 'aparahna'], [6, 14, 'Sharad Purnima', 'pradosh'],
    [6, 18, 'Karwa Chauth', 'moonrise'], [6, 27, 'Dhanteras', 'pradosh'], [6, 28, 'Narak Chaturdashi'], [6, 29, 'Diwali · Lakshmi Puja', 'pradosh'],
    [7, 0, 'Govardhan Puja'], [7, 1, 'Bhai Dooj', 'aparahna'], [7, 5, 'Chhath Puja'], [7, 10, 'Dev Uthani Ekadashi'], [7, 14, 'Kartik Purnima · Guru Nanak Jayanti'],
    [8, 10, 'Gita Jayanti · Mokshada Ekadashi'], [10, 4, 'Vasant Panchami'], [10, 28, 'Maha Shivaratri', 'nishita'],
    [9, 29, 'Mauni Amavasya'], 
  ];
  const SANKRANTI = { 0: 'Mesha Sankranti · Baisakhi', 9: 'Makar Sankranti · Pongal', 3: 'Karka Sankranti' };

  // Tithis that fall to cur when observed at kala `key`. A tithi holding at the kala on two days goes to
  // the first; one that slips between two observations goes to the day on whose sunrise it holds, else the earlier.
  function tithisAt(prev, cur, next, key) {
    const k = x => x.at[key], out = [];
    if (!prev || k(prev) !== k(cur)) out.push(k(cur));
    if (next && mod(k(next) - k(cur), 30) === 2 && next.tithi !== (k(cur) + 1) % 30) out.push((k(cur) + 1) % 30);
    if (prev && mod(k(cur) - k(prev), 30) === 2 && cur.tithi === (k(prev) + 1) % 30) out.push((k(prev) + 1) % 30);
    return out;
  }

  // prev/cur/next are brief() results for consecutive days.
  // ponytail: kala rules only; bhadra, eclipses, nakshatra (Janmashtami's Rohini) and regional variants are ignored.
  function festivals(prev, cur, next) {
    const out = [], on = key => tithisAt(prev, cur, next, key);
    const masaFor = ti => next && ti < cur.tithi ? next.masa : cur.masa; // a tithi past Amavasya belongs to the new month
    for (const [ms, ti, name, key = 'sunrise'] of FEST) {
      const masa = masaFor(ti);
      if (!masa.adhika && ms === masa.i && on(key).includes(ti)) out.push(name);
    }
    // Holika Dahan: Purnima at pradosh (bhadra only changes the hour, not the day). Holi is the morning after.
    const holika = (p, c, n) => !c.masa.adhika && c.masa.i === 11 && tithisAt(p, c, n, 'pradosh').includes(14);
    if (holika(prev, cur, next)) out.push('Holika Dahan');
    if (prev && holika(null, prev, cur) && cur.at.pradosh !== 14) out.push('Holi');
    for (const ti of on('sunrise')) {
      if (ti === 10 || ti === 25) out.push('Ekadashi');
      else if (ti === 14 && !out.some(f => f.includes('Purnima'))) out.push('Purnima');
      else if (ti === 29 && !out.some(f => f.includes('Amavasya') || f.includes('Diwali'))) out.push('Amavasya');
    }
    if (on('pradosh').some(ti => ti === 12 || ti === 27)) out.push('Pradosh Vrat');
    if (on('moonrise').includes(18) && !out.includes('Karwa Chauth')) out.push('Sankashti Chaturthi');
    // Sankranti: the day the sun changes rashi, or the next day when it changes after sunset.
    const entered = cur.sunRashiSet !== cur.sunRashi ? cur.sunRashiSet : prev && prev.sunRashiSet !== cur.sunRashi ? cur.sunRashi : null;
    if (entered !== null) out.push(SANKRANTI[entered] || `${RASHI[entered]} Sankranti`);
    return out;
  }

  // --- For you: personal panchang from birth details. Traditional rules only. ---
  // ponytail: tara/chandra bala, windows, dasha, Sade Sati and Jupiter only; no lagna, houses or divisional charts.
  const NAK = 360 / 27, YEAR = 365.25 * DAY;
  const TARA = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyak', 'Sadhana', 'Naidhana', 'Mitra', 'Parama Mitra'];
  const TARA_KIND = ['caution', 'good', 'bad', 'good', 'bad', 'good', 'bad', 'good', 'good'];
  const CHANDRA_GOOD = [1, 3, 6, 7, 10, 11];
  const DASHA = [['Ketu', 7], ['Venus', 20], ['Sun', 6], ['Moon', 10], ['Mars', 7], ['Rahu', 18], ['Jupiter', 16], ['Saturn', 19], ['Mercury', 17]];
  const SADE_SATI = { 11: 'rising', 0: 'peak', 1: 'setting' }; // Saturn's sign counted from the birth Moon's, 0-based

  // Birth moment; an unknown time is taken as noon.
  function birthTime(p) {
    const [y, m, d] = p.date.split('-').map(Number), [h, mi] = (p.time || '12:00').split(':').map(Number);
    return localTime(y, m - 1, d, h, mi, p.tz);
  }
  // Nakshatras the Moon was in across the birth day (time unknown) or within an hour of the birth time.
  function candidates(p) {
    const t = birthTime(p), from = p.time ? add(t, -HOUR) : add(t, -12 * HOUR), to = p.time ? add(t, HOUR) : add(t, 12 * HOUR);
    const out = [];
    for (let x = from; x <= to; x = add(x, 10 * 60e3)) { const n = nakIdx(x); if (!out.includes(n)) out.push(n); }
    return out;
  }
  // The birth Moon. A picked nakshatra (p.nak) overrides the computed one: the Moon sat at its near edge.
  function natal(p) {
    const t = birthTime(p);
    let lon = moonSid(t);
    if (p.nak != null && p.nak !== Math.floor(lon / NAK)) lon = (p.nak + (mod(p.nak - lon / NAK, 27) < 13 ? 0.001 : 0.999)) * NAK;
    const nak = Math.floor(lon / NAK);
    // Vimshottari: the dasha lord of the birth nakshatra, with the part of it already run counted back from birth.
    const [, years] = DASHA[nak % 9], ran = lon / NAK - nak;
    return { birth: t, moonLon: lon, nak, pada: Math.floor((lon / NAK - nak) * 4) + 1, rashi: Math.floor(lon / 30),
      nakName: NAKSHATRA[nak], rashiName: RASHI[Math.floor(lon / 30)], dashaStart: new Date(t - ran * years * YEAR), dashaLord: nak % 9 };
  }
  // Maha- and antardasha running at `date`.
  function dasha(n, date) {
    let i = n.dashaLord, start = +n.dashaStart;
    while (start + DASHA[i][1] * YEAR <= date) { start += DASHA[i][1] * YEAR; i = (i + 1) % 9; }
    const maha = { lord: DASHA[i][0], start: new Date(start), end: new Date(start + DASHA[i][1] * YEAR) };
    let j = i, s = start;
    const len = k => DASHA[i][1] * DASHA[k][1] / 120 * YEAR;
    while (s + len(j) <= date) { s += len(j); j = (j + 1) % 9; }
    return { maha, antar: { lord: DASHA[j][0], start: new Date(s), end: new Date(s + len(j)) } };
  }

  const ranges = list => list.map(x => [+x.start, +x.end]);
  const intersect = (a, b) => a.flatMap(([s, e]) => b.map(([s2, e2]) => [Math.max(s, s2), Math.min(e, e2)])).filter(([s, e]) => s < e);
  const subtract = (a, cut) => cut.reduce((acc, [cs, ce]) => acc.flatMap(([s, e]) => [[s, Math.min(e, cs)], [Math.max(s, ce), e]].filter(([x, y]) => x < y)), a);
  const merge = a => a.sort((x, y) => x[0] - y[0]).reduce((out, r) => { const l = out[out.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else out.push([...r]); return out; }, []);
  // Spans of a day() limb list with their start times.
  const withStart = (list, from) => list.map((x, k) => ({ ...x, start: k ? list[k - 1].end : from }));

  // How a day() stands for the natal Moon n: tara bala, chandra bala and the windows where everything is good.
  function personal(p, n) {
    const tara = withStart(p.nakshatra, p.sunrise).map(x => { const k = mod(x.i - n.nak, 27) % 9; return { start: x.start, end: x.end, name: TARA[k], kind: TARA_KIND[k] }; });
    const chandra = withStart(p.moonRashi, p.sunrise).map(x => { const house = mod(x.i - n.rashi, 12) + 1; return { start: x.start, end: x.end, house, kind: CHANDRA_GOOD.includes(house) ? 'good' : 'bad', ashtama: house === 8 }; });
    const good = l => ranges(l.filter(x => x.kind === 'good'));
    let w = merge(ranges(p.choghadiya.day.filter(c => c.kind === 'good')));
    w = subtract(w, ranges([p.rahu, p.yamaganda, p.gulika, ...p.durMuhurta]));
    w = merge(intersect(intersect(w, good(tara)), good(chandra)));
    return { tara, chandra, windows: w.map(([s, e]) => ({ start: new Date(s), end: new Date(e) })) };
  }
  // Tara at sunrise and chandrashtama, for month tints; b is a brief().
  const glance = (b, n) => ({ tara: TARA_KIND[mod(b.nak - n.nak, 27) % 9], ashtama: mod(b.moonRashi - n.rashi, 12) === 7 });

  const planetSid = (body, d) => mod(A.Ecliptic(A.GeoVector(body, d, true)).elon - ayanamsa(d), 360);
  // Slow background at `date`: dasha, Sade Sati phase (or null), Jupiter's house from the birth Moon.
  function transits(date, n) {
    const sat = mod(Math.floor(planetSid('Saturn', date) / 30) - n.rashi, 12);
    return { ...dasha(n, date), sadeSati: SADE_SATI[sat] || null, jupiter: mod(Math.floor(planetSid('Jupiter', date) / 30) - n.rashi, 12) + 1 };
  }

  // Built-in places, shared by the app and pages.js.
  const CITIES = [
    ['New Delhi', 28.6139, 77.2090, 'Asia/Kolkata'], ['Mumbai', 19.0760, 72.8777, 'Asia/Kolkata'],
    ['Kolkata', 22.5726, 88.3639, 'Asia/Kolkata'], ['Chennai', 13.0827, 80.2707, 'Asia/Kolkata'],
    ['Bengaluru', 12.9716, 77.5946, 'Asia/Kolkata'], ['Hyderabad', 17.3850, 78.4867, 'Asia/Kolkata'],
    ['Ahmedabad', 23.0225, 72.5714, 'Asia/Kolkata'], ['Pune', 18.5204, 73.8567, 'Asia/Kolkata'],
    ['Jaipur', 26.9124, 75.7873, 'Asia/Kolkata'], ['Lucknow', 26.8467, 80.9462, 'Asia/Kolkata'],
    ['Varanasi', 25.3176, 82.9739, 'Asia/Kolkata'], ['Ujjain', 23.1765, 75.7885, 'Asia/Kolkata'],
    ['Kathmandu', 27.7172, 85.3240, 'Asia/Kathmandu'], ['Singapore', 1.3521, 103.8198, 'Asia/Singapore'],
    ['Dubai', 25.2048, 55.2708, 'Asia/Dubai'], ['London', 51.5074, -0.1278, 'Europe/London'],
    ['New York', 40.7128, -74.0060, 'America/New_York'], ['Toronto', 43.6532, -79.3832, 'America/Toronto'],
    ['San Francisco', 37.7749, -122.4194, 'America/Los_Angeles'], ['Sydney', -33.8688, 151.2093, 'Australia/Sydney'],
  ].map(([name, lat, lon, tz]) => ({ name, lat, lon, tz }));
  // Monthly vrats: on the month page, left off the year's festival lists.
  const ROUTINE = ['Ekadashi', 'Purnima', 'Amavasya', 'Pradosh Vrat', 'Sankashti Chaturthi'];

  const api = { day, brief, festivals, tzOffset, localMidnight, localTime, birthTime, candidates, natal, dasha, personal, glance, transits, TARA, NAKSHATRA, TITHI, MASA, RASHI, CITIES, ROUTINE };
  if (typeof module !== 'undefined') module.exports = api; else root.Panchang = api;
})(this, typeof Astronomy !== 'undefined' ? Astronomy : require('astronomy-engine'));
