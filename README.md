# tithi

Minimal Hindu panchang, after drikpanchang.com. Live at [tithi.agenticrabbit.com](https://tithi.agenticrabbit.com).

[![Tithi](og.png)](https://tithi.agenticrabbit.com)

- **Landing page**: today's moon, tithi and nakshatra, with "Go to daily panchang", "✦ Tithi+" membership preview, and "Sign in with Google".
- **Today**: summary line, what's coming up, five limbs (tithi, nakshatra, yoga, karana, vara), sun and moon times, good and bad hours, choghadiya, hora, moon phase, place in the year.
- **Calendar**: month grid with tithi and festivals; tap a day to preview it.
- **Festivals**: the year's observances, dated by the time of day each is kept (see "How this is worked out" at the foot of the page).
- **Cosmic Compatibility (Ashtakoota Milan)**: 36 Gunas Vedic relationship matching across all 8 Kootas (Nadi, Bhakoot, Gana, Graha Maitri, Yoni, Tara, Vashya, Varna). Compare against friends and partners, save people to your Circle, and export synastry dossiers.
- **For you & Janma Kundli** (signed in):
  - **Daily Vibe**: blunt, editorial Co-Star style daily forecast, personal Do's & Don'ts, and real-time life area metrics (Mind, Social, Energy, Career) powered by Vedic Tara Bala and Chandra Bala.
  - **Janma Kundli**: Sidereal Lahiri coordinates for Lagna (Ascendant) and all 9 Grahas (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu) in 12 whole sign houses with printable dossier export.
  - **Personal Muhurta Planner**: multi-week scan of optimal personal windows for career decisions, signing contracts, investments, travel, and dates.
  - **Dasha & Transits**: Vimshottari Mahadasha/Antardasha timeline, Sade Sati phase, and Jupiter transits.
- **Tithi+ Membership & Monetization**:
  - ₹199 / month or ₹1,499 / year (~$4.99/mo or $39/yr) via **Razorpay** with full India support: UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and NetBanking.
  - Paywall gates full 8-dimension Koota synastry, expanded 90-day Muhurta calendar, and complete daily Do/Don't directives.
  - VIP Promo code support (`COSTAR`, `VEDIC`, `FOUNDER`, `PRO`, `TITHIPLUS`).
- Any city (built-in list plus Open-Meteo search) or your location. Links like `#calendar?date=2026-10-01&city=Mumbai` are shareable.
- Toggles at the foot of the page: theme (auto, light, dark), Hindi names, amanta or purnimanta months. They're stored in `localStorage`.
- Works offline and installs to the home screen.
- Static festival pages for search: [/festivals/](https://tithi.agenticrabbit.com/festivals/) lists every festival's date across the built-in cities, for this year and next.

Everything is calculated in the browser with [astronomy-engine](https://github.com/cosinekitty/astronomy) (loaded from jsDelivr). Sidereal positions use Lahiri (with precession and nutation). Server code is `worker.js`, which handles auth, user birth details, circle synastry, promo codes, and Razorpay payment orders & verification.

## Develop

Static files, no build.

    python3 -m http.server   # open http://localhost:8000 (no /api)
    npx wrangler dev --port 8779   # site plus /api with local KV; wrangler needs Node 22+
    npm i --no-save astronomy-engine && node test.js   # prints "ok"

`test.js` checks festival dates against Drik Panchang for New Delhi (2025–2027) and London (2026), and the For you rules (natal nakshatra, tara and chandra bala, dasha, Sade Sati) against Drik's pages.

    node pages.js   # rewrites festival/, festivals/ and sitemap.xml; commit the output

Re-run `pages.js` after changing a festival rule. `YEARS` is this year and next; a GitHub Action (`.github/workflows/pages.yml`) regenerates and pushes the pages each 1 January, and can be run by hand from the Actions tab.

## Deploy

Pushing to `main` deploys to tithi.agenticrabbit.com (a Cloudflare Worker serving static assets, built by Workers Builds from `wrangler.jsonc`). Only the files listed in `.assetsignore` are served. `worker.js` handles `/api/*` (`run_worker_first`): `GET/PUT/DELETE /api/birth`, authenticated by the Google ID token and stored in the `BIRTH` KV namespace (`tithi-birth`). The Google OAuth client ID is in `index.html` and `worker.js`; its JSON with the secret is kept locally as `google-oauth-client.json`, gitignored and never committed.
