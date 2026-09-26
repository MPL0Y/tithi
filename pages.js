// Static festival pages for search engines, which can't read the app's hash routes:
//   /festival/<name>/        one festival, every city, both years
//   /festivals/<year>/<city>/ one city's year
//   /festivals/              the index, plus sitemap.xml
// Run: npm i --no-save astronomy-engine && node pages.js
// Re-run each January (bump YEARS) and after changing festival rules. Commit the output.
const fs = require('fs');
const P = require('./panchang.js');

const SITE = 'https://tithi.agenticrabbit.com';
const YEARS = [2026, 2027];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOME = P.CITIES[0]; // New Delhi: the reference other cities are compared with

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
const iso = b => `${b.y}-${String(b.m + 1).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
const short = b => `${WD[b.weekday]} ${b.d} ${MONTHS[b.m].slice(0, 3)}`;
const long = b => `${DAY[b.weekday]}, ${b.d} ${MONTHS[b.m]}`;
const app = (b, city) => `/#today?date=${iso(b)}&city=${encodeURIComponent(city.name).replace(/%20/g, '+')}`;
const list = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1);

// dates[festival][city][year] = [brief, ...], in date order
const dates = {}, byCityYear = {};
for (const city of P.CITIES) for (const y of YEARS) {
  const days = [], rows = byCityYear[`${city.name}|${y}`] = [];
  const n = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 864e5;
  for (let k = -1; k <= n; k++) { const t = new Date(Date.UTC(y, 0, 1 + k)); days.push(P.brief(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), city)); }
  for (let k = 1; k <= n; k++) for (const f of P.festivals(days[k - 1], days[k], days[k + 1])) {
    if (P.ROUTINE.includes(f)) continue;
    rows.push([days[k], f]);
    for (const name of f.split(' · ')) ((dates[name] ??= {})[city.name] ??= {})[y] ??= [], dates[name][city.name][y].push(days[k]);
  }
}
// Festivals in the order they fall in New Delhi's first year
const first = name => Math.min(...YEARS.flatMap(y => (dates[name][HOME.name]?.[y] || []).map(b => Date.UTC(b.y, b.m, b.d))));
const NAMES = Object.keys(dates).sort((a, b) => first(a) - first(b));

function page({ path, title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f2ede4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#161512" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>
  /* the app's tokens, from index.html */
  :root { --paper: #f2ede4; --ink: #1c1b19; --ink2: #5b574f; --muted: #6f695f; --rule: #d8d1c4; --sindoor: #b23624; color-scheme: light dark;
    --serif: "Instrument Serif", Georgia, serif; --sans: "Instrument Sans", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace; }
  @media (prefers-color-scheme: dark) { :root { --paper: #161512; --ink: #ebe5da; --ink2: #b5aea1; --muted: #948e83; --rule: #34312c; --sindoor: #e2644f; } }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--paper); color: var(--ink); font: 400 0.9375rem/1.6 var(--sans); -webkit-font-smoothing: antialiased; }
  main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1rem 5rem; }
  a { color: inherit; text-decoration-color: var(--muted); text-underline-offset: 0.2em; }
  a:hover { color: var(--sindoor); }
  .mark { font-family: var(--serif); font-size: 1.5rem; text-decoration: none; }
  .mark span, .label, th { font-family: var(--mono); font-size: 0.6875rem; font-weight: 400; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  h1 { font-family: var(--serif); font-weight: 400; font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 0.95; letter-spacing: -0.02em; margin-top: 3rem; }
  h1 em, h2 em { font-style: italic; }
  h2 { font-family: var(--serif); font-weight: 400; font-size: 2rem; line-height: 1; margin: 3rem 0 1rem; }
  .lead { font-family: var(--serif); font-size: clamp(1.375rem, 3vw, 1.75rem); line-height: 1.2; margin-top: 1.5rem; max-width: 40rem; }
  .lead em { color: var(--sindoor); }
  p { max-width: 40rem; }
  p + p, .note { margin-top: 1rem; color: var(--ink2); }
  table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
  th, td { text-align: left; padding: 0.625rem 0.75rem 0.625rem 0; border-bottom: 1px solid var(--rule); vertical-align: baseline; }
  thead th { border-bottom-color: var(--ink); }
  td { font-family: var(--serif); font-size: 1.25rem; line-height: 1.2; }
  td a { text-decoration: none; }
  td.diff a { color: var(--sindoor); font-style: italic; }
  .ledger td:last-child { text-align: right; }
  td small { font-family: var(--mono); font-size: 0.6875rem; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
  .cols { columns: 14rem; column-gap: 2rem; margin-top: 1rem; }
  .cols a { display: block; padding: 0.375rem 0; font-family: var(--serif); font-size: 1.25rem; text-decoration: none; break-inside: avoid; }
  .cta { display: inline-block; margin-top: 2rem; font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none; border-bottom: 1px solid var(--ink); padding: 0.75rem 0 0.125rem; }
  footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--rule); color: var(--ink2); font-size: 0.8125rem; }
</style>
</head>
<body>
<main>
<a class="mark" href="/">Tithi <span>a panchang</span></a>
${body}
<footer><p>Worked out in your browser with <a href="/">Tithi</a>, a free panchang with no ads. Each date is the day the festival’s tithi holds at the time it is kept (sunrise, midday, dusk, midnight or moonrise) in that city. Eclipses, bhadra and regional customs are not modelled, so a family or temple calendar can differ by a day.</p><p><a href="/festivals/">All festivals</a> · <a href="https://github.com/MPL0Y/tithi">Source</a></p></footer>
</main>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "39289d9b86624934a8e44069b40f2725"}'></script>
</body>
</html>
`;
}

function write(path, html) {
  const file = '.' + path + (path.endsWith('/') ? 'index.html' : '');
  fs.mkdirSync(require('path').dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return path;
}

fs.rmSync('festival', { recursive: true, force: true });
fs.rmSync('festivals', { recursive: true, force: true });
const paths = ['/'];

// One festival
for (const name of NAMES) {
  const d = dates[name], at = (city, y) => d[city.name]?.[y] || [];
  // "In New York and San Francisco it falls on Wed 28 Oct." for the years where cities disagree with New Delhi
  const home = y => at(HOME, y).map(iso).join();
  const differ = YEARS.map(y => {
    const groups = {};
    for (const c of P.CITIES) { const b = at(c, y)[0]; if (b && at(c, y).map(iso).join() !== home(y)) (groups[short(b)] ??= []).push(c.name); }
    return Object.entries(groups).map(([day, cs]) => `In ${list(cs)} it falls on ${day} ${y}.`).join(' ');
  }).filter(Boolean).join(' ');
  const lead = YEARS.filter(y => at(HOME, y).length).map((y, i) => i ? `in ${y}, ${at(HOME, y).map(long).join(' and ')}` : `${esc(name)} ${y} is on <em>${at(HOME, y).map(long).join(' and ')}</em> in ${HOME.name}`).join('; ');
  const rows = P.CITIES.filter(c => YEARS.some(y => at(c, y).length)).map(c => `<tr><th scope="row">${esc(c.name)}</th>${YEARS.map(y => {
    const bs = at(c, y), diff = bs.length && bs.map(iso).join() !== home(y);
    return `<td${diff ? ' class="diff"' : ''}>${bs.map(b => `<a href="${app(b, c)}">${short(b)}</a>`).join('<br>') || '—'}</td>`;
  }).join('')}</tr>`).join('\n');
  paths.push(write(`/festival/${slug(name)}/`, page({
    path: `/festival/${slug(name)}/`,
    title: `${name} ${YEARS.join(' and ')}: dates by city · Tithi`,
    description: `${name} ${YEARS[0]}${at(HOME, YEARS[0])[0] ? ` is on ${long(at(HOME, YEARS[0])[0])} in ${HOME.name}` : ''}. Dates for ${P.CITIES.length} cities in India and abroad, worked out for each city’s own sunrise and time zone.`,
    body: `<h1>${esc(name)} <em>dates</em></h1>
<p class="lead">${lead}.</p>
${differ ? `<p class="note">${esc(differ)} Dates in red differ from ${HOME.name}.</p>` : `<p class="note">Every city below keeps it on the same day as ${HOME.name}.</p>`}
<table><thead><tr><th scope="col">City</th>${YEARS.map(y => `<th scope="col">${y}</th>`).join('')}</tr></thead><tbody>
${rows}
</tbody></table>
<a class="cta" href="${app(at(HOME, YEARS[0])[0] || at(HOME, YEARS[1])[0], HOME)}">Open the full panchang for that day →</a>`,
  })));
}

// One city's year
for (const c of P.CITIES) for (const y of YEARS) {
  const rows = byCityYear[`${c.name}|${y}`];
  const months = MONTHS.map((m, i) => [m, rows.filter(([b]) => b.m === i)]).filter(([, r]) => r.length);
  paths.push(write(`/festivals/${y}/${slug(c.name)}/`, page({
    path: `/festivals/${y}/${slug(c.name)}/`,
    title: `Hindu festivals ${y} in ${c.name}: dates and calendar · Tithi`,
    description: `Every Hindu festival in ${y}, dated for ${c.name}: ${rows.slice(0, 4).map(([b, f]) => `${f.split(' · ')[0]} ${b.d} ${MONTHS[b.m].slice(0, 3)}`).join(', ')} and more.`,
    body: `<h1>Hindu festivals <em>${y}</em> in ${esc(c.name)}</h1>
<p class="lead">${rows.length} festivals and observances, dated for ${esc(c.name)}’s sunrise and time zone.</p>
${months.map(([m, r]) => `<h2><em>${m}</em></h2><table class="ledger"><tbody>${r.map(([b, f]) => `<tr><td style="width:6rem"><a href="${app(b, c)}">${b.d}</a> <small>${WD[b.weekday]}</small></td><td>${f.split(' · ').map(n => `<a href="/festival/${slug(n)}/">${esc(n)}</a>`).join(' · ')}</td><td><small>${esc(b.paksha)} ${esc(b.tithiName)}</small></td></tr>`).join('')}</tbody></table>`).join('\n')}
<p class="note">Other years: ${YEARS.filter(x => x !== y).map(x => `<a href="/festivals/${x}/${slug(c.name)}/">${x}</a>`).join(', ')}. Other cities: ${P.CITIES.filter(x => x !== c).map(x => `<a href="/festivals/${y}/${slug(x.name)}/">${esc(x.name)}</a>`).join(', ')}.</p>
<a class="cta" href="/#festivals?date=${y}-01-01&city=${encodeURIComponent(c.name).replace(/%20/g, '+')}">Open ${y} in Tithi →</a>`,
  })));
}

// Index
paths.push(write('/festivals/', page({
  path: '/festivals/',
  title: `Hindu festival dates ${YEARS.join(' and ')} by city · Tithi`,
  description: `Dates of ${NAMES.length} Hindu festivals for ${P.CITIES.length} cities in India, the UK, the US and beyond, worked out for each city’s sunrise and time zone.`,
  body: `<h1>Festival dates <em>by city</em></h1>
<p class="lead">${NAMES.length} festivals, ${P.CITIES.length} cities, ${YEARS.join(' and ')}. A festival can fall on a different day abroad, because it is kept by the tithi at the city’s own sunrise or dusk.</p>
<h2><em>Festivals</em></h2><div class="cols">${NAMES.map(n => `<a href="/festival/${slug(n)}/">${esc(n)}</a>`).join('')}</div>
${YEARS.map(y => `<h2><em>${y}</em> by city</h2><div class="cols">${P.CITIES.map(c => `<a href="/festivals/${y}/${slug(c.name)}/">${esc(c.name)}</a>`).join('')}</div>`).join('\n')}`,
})));

fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(p => `<url><loc>${SITE}${p}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`${paths.length} pages`);
