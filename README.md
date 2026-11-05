# Squeek Wheel Rush

A free, one-page canvas game for the Squeekchain community. Keep Squeektoshi running, jump over red pegs, collect sunflower seeds and gold stars, and claim a place on the shared worldwide leaderboard. This is a community project, not made by the Squeekchain team.

## Install, run, and rebuild

Use Node.js 22.12 or newer and npm. From the repository root:

```sh
npm ci
npm run dev
```

Vite prints the local development URL. To check and create the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Open the preview URL printed by Vite. `dist/index.html`, `dist/assets/`, the favicon, font license, and social card make up the complete static site. Serve the entire `dist/` directory over HTTP(S), including at a subpath. Vite uses `base: './'`; asset URLs are relative. The delivered export is included alongside the source and lockfile. Hosting does not need Node or a backend build step.

## Play

Select **Start running**. Tap/click the wheel, or press **Space**, **Up**, or **W** to jump. Hold for a higher jump; release before jumping again. Phones also have a **Hold to jump** control. **M** toggles sound. **Escape** pauses/resumes. Switching tabs pauses the run automatically; select **Keep running** when ready.

Survival earns `10 × multiplier` per second. Seeds earn `25 × multiplier`; stars earn `150 × multiplier`. The multiplier is `min(12, 1 + seconds / 12)`. Speed starts at 1.5 rad/s and rises to 2.8, with a small surge after 25 seconds. Seed lines and single hops lead into paired/triple pegs, tall pegs, and stars above tall pegs. A trip freezes earned points, tumbles the hamster, and winds down the wheel. Fractional points accumulate; displayed and submitted scores are floored to integers.

Enter a name of 1–14 characters and select **Claim score** after a run. The board retains the best score per name. A successful claim shows the server-returned rank and highlights the runner. Personal best, name, and mute preference are stored on this device when storage is available. There are no accounts.

## Public services

- `GET https://api.squeekchain.com/v1/status` runs immediately and every three seconds while the page is visible. Only `measurement.freshness === 'online'` with numeric `rpmMilli > 0` enables the extra 25% on all earned points. Missing, stale, idle, or failed data never prevents play. Calls time out and play continues at ordinary scoring.
- The supplied Supabase project, `https://baugveuujnzqsuehfrxz.supabase.co`, supplies `POST /rest/v1/rpc/top_scores` with `{"n":20}` and `POST /rest/v1/rpc/submit_score` with `p_name`, integer `p_score`, and integer `p_secs`. The supplied public browser key is sent only as the `apikey` header. See `src/api.js`.
- The first eight runners are displayed, plus a claimed runner when necessary. No example runners are added to the production game. An empty board and failed reads have explicit messages; failed refreshes keep previously loaded scores. `slow_down` enables retry after five seconds. `bad_score`/`bad_time` ask for a new run; connection failures let the same run be retried.

Both services are optional for playing. A connection to Supabase is required to claim a worldwide score. Audio uses Web Audio synthesis after a user gesture. The illustration, icons, fonts, and social card are local assets. There is no wallet connection, transaction flow, private credential, or additional backend.

## Validation

`npm run typecheck`, `npm test` (19 simulation tests), and `npm run build` pass. Production Chromium interaction tests cover starting, all jump input families, pause/resume, mute, the results and claim form, every documented API error, persisted preferences, empty data, disabled local storage, reduced motion, and responsive reflow. All 16 pinned taste@1 design checks pass. The detailed evidence, fixes, six-domain review, and limitations are in [VALIDATION.md](VALIDATION.md); final design tokens and components are in [DESIGN.md](DESIGN.md).

The browser tests require an external Playwright installation and Chromium. Set `IMD_PLAYWRIGHT` to that installation's `index.mjs` and `PLAYWRIGHT_BROWSERS_PATH` to its browser directory, then run:

```sh
npm run test:browser
```

The script owns a temporary foreground HTTP server, serves the actual export under `/preview/`, and closes its browsers/server when done. It writes temporary evidence only in `test/scratch/`. Score submissions are intercepted in tests; no test scores are sent to the worldwide board. Actual read-only API responses were also rendered through HTTP forwarding because direct browser network requests were blocked in the validation runtime. Unmodified direct browser API access, WebKit, physical phones, screen readers, and native browser zoom were not verified. A separate 200% text-size reflow check was performed.

To refresh the 1200 × 630 local social card after a visual change, run `npm run share` with the same external Playwright configuration after building, then `npm run build` again. The existing `public/share.png` is ready to use; normal builds do not require a browser.

## Source map

| Path | Responsibility |
| --- | --- |
| `index.html` | Semantic screens, help dialog, forms, metadata |
| `src/style.css` | Tokens, component styles, responsive layout |
| `src/game.js` | Independent simulation, scoring, physics, patterns |
| `src/render.js` | Canvas room, wheel, hamster, particles, collected-point labels |
| `src/audio.js` | Synthesized jump, combo seeds, star arpeggio, thud, footsteps |
| `src/api.js` | Bounded public RPC requests and live-status predicate |
| `src/main.js` | Input, screen state, polling, storage, leaderboard and claiming |
| `test/game.test.mjs` | Deterministic simulation and randomized invariant checks |
| `test/browser.mjs` | Production browser interaction and responsive checks |
| `scripts/share.mjs` | Recreates the social card from the game's own scene |

Dependency/cache directories are excluded at every nesting level; `dist/` is intentionally included. The explicit submission budget is recorded in `.gitignore`. Font and design-reference attribution is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
