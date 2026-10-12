# Long Shot – TODO (interruption-safe task list)

Update this file whenever you finish a task or pick up from an interruption.

## Status key
- [x] Done
- [~] In progress
- [ ] Not started

---

## M0 – Repo & Tooling
- [x] .gitignore
- [x] .env.example
- [x] package.json
- [x] vercel.json (CSP frame-ancestors header)
- [x] .github/workflows/ci.yml
- [ ] Push initial commit to GitHub
- [ ] Get Vatar test keys from lagoslife.app/developers/keys
- [ ] Add VATAR_TEST_SECRET to Vercel env variables

## M1 – Core Engine
- [x] src/constants.js (all tuning values)
- [x] src/engine.js (fixed 1/120s physics, world coords, drag/release, hit detection, particles)

## M2 – Seeded Bottles
- [x] src/rng.js (mulberry32, hashSeed, dailySeed, practiceSeed)
- [x] src/spawnManager.js (tier weighting, gap ramp, stay time, sync to engine)

## M3 – Scoring & Round Flow
- [x] src/scoring.js (combo, multiplier, streak bonus, accuracy, round-end)

## M4 – Game Feel & Audio
- [x] src/audio.js (Web Audio API synth – all sounds, no files needed)
- [x] Trajectory preview dots (in engine.js)
- [x] Particle shatter (in engine.js)
- [x] Screen shake (in engine.js)

## M5 – Daily Challenge & Practice
- [x] dailySeed() / practiceSeed() in rng.js
- [x] Mode switching in game.js
- [x] Best score saved to localStorage (guarded try/catch)

## M6 – SDK Integration
- [x] src/sdk.js (boot, mock fallback, submitScore throttle, leaderboard throttle, pause/resume)

## M7 – UI
- [x] src/ui.js (start screen, HUD, results, leaderboard, paused, flash texts, buttons)

## M8 – Game Controller
- [x] src/game.js (wires all modules, round lifecycle, resize, RAF loop)

## M9 – Entry Point
- [x] index.html (SDK script, canvas, ES module boot)

## M10 – Hosting
- [ ] Create Vercel project (vercel init or dashboard)
- [ ] Deploy: vercel --prod
- [ ] Verify frame loads in Lagos Life sandbox
- [ ] Tick "SDK init seen" in dashboard

## M11 – QA
- [ ] Test on Chrome DevTools (375×812 portrait)
- [ ] Test on real Android (touch, pause/resume, sound after first tap)
- [ ] Fix any console errors
- [ ] Verify leaderboard submission in sandbox

## M12 – Submission pack (tomorrow)
- [ ] icon-512.png
- [ ] 3-5 screenshots (portrait)
- [ ] Short description (≤120 chars)
- [ ] Long description
- [ ] Developer Agreement
- [ ] Answer all review checklist items

---

## Interruption log
*Add a line whenever you stop, describing exactly where you left off.*

| Date/Time | Status | Notes |
|-----------|--------|-------|
| 2026-10-12 | All source code written | Next: push to GitHub, deploy to Vercel |
