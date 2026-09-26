# tithi

Minimal Hindu panchang, after drikpanchang.com. Static files, no build.

    python3 -m http.server   # open http://localhost:8000

Today (panchang, choghadiya, hora, what's coming up), calendar, yearly festivals. Any city (search) or your location. Links like `#calendar?date=2026-10-01&city=Mumbai` are shareable. Theme (auto, light, dark), Hindi names and amanta/purnimanta months are toggles at the foot of the page. Works offline and installs to the home screen (`sw.js`: own files network-first, CDN cache-first).

Check: `npm i --no-save astronomy-engine && node test.js`
