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
  - `ashtakoota(p1, p2)` computes classical 36-point Vedic Milan across all 8 Kootas (Nadi, Bhakoot, Gana, Graha Maitri, Yoni, Tara, Vashya, Varna) with breakdown scores, maximums, and compatibility verdicts.
  - `kundli(birth)` computes Sidereal Lahiri coordinates for Lagna (Ascendant) and 9 Grahas (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu) in 12 whole sign houses.
  - `insights(day, natal)` generates editorial Co-Star style daily Vibe narrative, personalized Do's & Don'ts, and life area ratings (Mind, Social, Energy, Career) from Tara Bala and Chandra Bala.
  - `muhurta(natal, loc, start, daysCount)` finds optimal personal timing windows across upcoming days (30 days free, 90 days Tithi+).
- **`index.html`**: all the UI (styles, markup and script in one file).
  - Hash routing: `#today|calendar|festivals|compatibility?date=YYYY-MM-DD&city=Name`, or `&place=&at=lat,lon&tz=` for a custom place.
  - Views: `today()`, `calendar()`, `festivals()`, `compatibility()`, drawn by `render()`. With no hash, `#landing` shows instead (`land()`); the head script sets `data-landing` before first paint.
  - Compatibility view: friend circle selector, partner birth form, 36 Gunas match gauge, locked curtain blur for free preview, and print/export synastry report.
  - Tithi+ membership modal: annual (₹1,499/yr) and monthly (₹199/mo) plan picker, Razorpay Standard Checkout (UPI, Cards, NetBanking), and instant VIP promo code unlock (`COSTAR`, `VEDIC`, `FOUNDER`, `PRO`, `TITHIPLUS`).
  - A 30-second interval moves the "now" markers and rolls over at midnight.
  - Term notes and the "How this is worked out" note (`#method`) use the native Popover API.
- **`pages.js`**: writes committed static HTML for search engines, which can't read the app's hash routes: `festival/<name>/` (every built-in city, `YEARS`), `festivals/<year>/<city>/`, `festivals/` and `sitemap.xml`. It runs `panchang.js` in Node and shares its `CITIES` and `ROUTINE`. Output is committed, so deploys stay build-free.
- **Sign-in, Sync & Tithi+**: Google sign-in is the OpenID Connect implicit flow in `index.html`; the page keeps the ID token (valid for an hour). `worker.js` verifies it against Google's keys and serves:
  - `GET/PUT/DELETE /api/birth`: user's birth details (`birth:<sub>` in KV).
  - `GET /api/user`: composite user state (birth, tier, pro status, and saved circle).
  - `PUT /api/circle`: saved friends and partners for compatibility matching (`circle:<sub>` in KV).
  - `POST /api/promo`: VIP promo code validation (`pro:<sub>` in KV).
  - `POST /api/checkout`: Razorpay Order creation (`https://api.razorpay.com/v1/orders`) or fallback instant tier activation.
  - `POST /api/razorpay/verify`: Web Crypto HMAC-SHA256 signature verification for payments.
  - `POST /api/webhook` / `/api/razorpay/webhook`: Razorpay webhook listener for `payment.captured` / `order.paid`.
- **`sw.js`**: offline support (`tithi-v5`). Its own files are network-first; CDN files are cache-first; geocoding, Razorpay, and `/api/*` are never cached.

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
