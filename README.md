# tithi

Minimal Hindu panchang, after drikpanchang.com. Live at [tithi.agenticrabbit.com](https://tithi.agenticrabbit.com).

- **Today**: summary line, what's coming up, five limbs (tithi, nakshatra, yoga, karana, vara), sun and moon times, good and bad hours, choghadiya, hora, moon phase, place in the year.
- **Calendar**: month grid with tithi and festivals; tap a day to preview it.
- **Festivals**: the year's observances, dated by the time of day each is kept (see "How this is worked out" at the foot of the page).
- Any city (built-in list plus Open-Meteo search) or your location. Links like `#calendar?date=2026-10-01&city=Mumbai` are shareable.
- Toggles at the foot of the page: theme (auto, light, dark), Hindi names, amanta or purnimanta months. They're stored in `localStorage`.
- Works offline and installs to the home screen.

Everything is calculated in the browser with [astronomy-engine](https://github.com/cosinekitty/astronomy) (loaded from jsDelivr). Sidereal positions use Lahiri.

## Develop

Static files, no build.

    python3 -m http.server   # open http://localhost:8000
    npm i --no-save astronomy-engine && node test.js   # prints "ok"

`test.js` checks festival dates against Drik Panchang for New Delhi (2025–2027) and London (2026).

## Deploy

Pushing to `main` deploys to tithi.agenticrabbit.com (a Cloudflare Worker serving static assets, built by Workers Builds from `wrangler.jsonc`). Only the files listed in `.assetsignore` are served.
