# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tithi is a minimal Hindu panchang (after drikpanchang.com): a static, client-side site with no build step, served by Cloudflare Workers at tithi.agenticrabbit.com. The only server code is `worker.js`, for `/api/*`.

## Commands

```sh
python3 -m http.server 8779                          # local preview (static only)
npx wrangler dev --port 8779                         # preview with /api (wrangler needs Node 22+; local KV)
npm i --no-save astronomy-engine && node test.js     # festival/panchang self-check, prints "ok"
node pages.js                                        # regenerate static festival pages + sitemap.xml
```

Pushing to `main` auto-deploys (Workers Builds runs `npx wrangler deploy`). Ship straight to `main`; run `node test.js` first.

## Architecture

- **`panchang.js`**: all the astronomy. It's a UMD module that works in the browser and in Node, built on astronomy-engine.
  - `day()` builds the full panchang for a date and place.
  - `brief()` is a cheap per-day summary. For festivals it records the tithi at each kala (sunrise, purvahna, madhyahna, aparahna, pradosh, nishita, moonrise).
  - `festivals(prev, cur, next)` dates the rows of the `FEST` table (`[masa, tithi, name, kala]`) by those kalas, plus the special cases handled in code (Holika Dahan/Holi, Ekadashi, Pradosh, Sankashti, sankranti).
- **`index.html`**: all the UI (styles, markup and script in one file).
  - Hash routing: `#today|calendar|festivals?date=YYYY-MM-DD&city=Name`, or `&place=&at=lat,lon&tz=` for a custom place.
  - Views: `today()`, `calendar()`, `festivals()`, drawn by `render()`.
  - A 30-second interval moves the "now" markers and rolls over at midnight.
  - Term notes and the "How this is worked out" note (`#method`) use the native Popover API.
- **`pages.js`**: writes committed static HTML for search engines, which can't read the app's hash routes: `festival/<name>/` (every built-in city, `YEARS`), `festivals/<year>/<city>/`, `festivals/` and `sitemap.xml`. It runs `panchang.js` in Node and shares its `CITIES` and `ROUTINE`. Output is committed, so deploys stay build-free.
- **Sign-in and For you**: Google sign-in is the OpenID Connect implicit flow in `index.html`; the page keeps the ID token (valid for an hour). `worker.js` verifies it against Google's keys and serves `GET/PUT/DELETE /api/birth`, one KV record (`BIRTH`, key `birth:<sub>`) of raw birth inputs per account. `panchang.js` derives everything from those inputs (`natal`, `personal`, `transits`, `glance`), so rule fixes apply to existing users. Birth details never go in the URL.
- **`sw.js`**: offline support. Its own files are network-first; CDN files are cache-first; geocoding is never cached.

## Gotchas

- **Adding a file the site needs:** un-ignore it in `.assetsignore`, which is a whitelist (the Worker's `assets.directory` is the repo root). Also add it to `CORE` in `sw.js`.
- **Changing `CORE` or the offline behaviour:** bump `CACHE` in `sw.js`.
- **Generated pages:** run `node pages.js` and commit after changing festival rules, `CITIES`, or the design tokens (its `<style>` copies them). `YEARS` is this year and next; a GitHub Action regenerates and pushes on 1 January. Never hand-edit `festival/` or `festivals/`.
- **Analytics:** Cloudflare Web Analytics beacon in `index.html` and `pages.js`, using the agenticrabbit.com zone's site token (the zone's auto-injection doesn't reach Worker assets). `sw.js` lets it through uncached.
- **For you rules:** reference values in `test.js` come from Drik's Janma Kundali, Tarabalam/Chandrabalam and Shani transit pages. Dasha dates are very sensitive to the Moon's longitude (1′ ≈ days), which is why the ayanamsa carries nutation.
- **Festival rules:** update both `test.js` (reference dates copied from drikpanchang.com's yearly calendar, Delhi and London) and the Festivals paragraph of the `#method` note, which describes the rules and their known exceptions.
- **Theme:** colours are CSS tokens on `:root`, with dark values under `prefers-color-scheme` and `[data-theme=dark]`. An inline head script applies the stored theme before first paint.
- **Controls:** the prev/today/next controls must not shift position when pressed.
- **`ponytail:` comments** mark deliberate shortcuts with known limits: no night-time dur muhurta; festivals ignore bhadra, eclipses, nakshatra conditions and regional variants.
