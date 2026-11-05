# Implementation and validation record

Date: 2026-11-05. Scope: the static Squeek Wheel Rush game, its complete run/results/claim flow, supplied public status and leaderboard integrations, source, and production export. This is the contributor's local evidence, not independent certification.

## Delivered scope

| Brief requirement | Status and implementation |
| --- | --- |
| Free, one-page, vanilla JavaScript and canvas; phone and desktop | Implemented. Vite bundles plain JavaScript and CSS; no framework, wallet, account, transaction, or additional backend. |
| Deep teal night room, warm lamp, brass wheel, orange stuffed-cheek hamster, Fredoka, bold score | Implemented in `src/render.js` and `src/style.css`; actual phone and desktop screenshots inspected. |
| Start screen title, action, instructions, worldwide runners, community disclaimer | Implemented in `index.html`. Main action visible at 390 × 664 and 390 × 844. Real API had two entries during the read check; the UI displays available entries without inventing more. |
| Slowly turning idle wheel and jogging hamster | Implemented; decorative animation freezes for reduced motion. |
| Hamster at the bottom inside the wheel; seeds/pegs approach on the inner curve | Implemented using shared 210-unit track coordinates. |
| Score, x1.0–x12 multiplier, timer, sound control, status chip | Implemented. Status reads asleep before/after a run, active during play, resting while paused. Live changes also have text cues. |
| Tap, click, Space/Up/W; hold for higher jumps | Implemented. Keyboard, touch canvas, and the visible phone jump control exercised in Chromium. Simulation compares tap and hold trajectories. |
| Collect seeds and rare stars; peg collision ends a run; tumble/wind-down; points never deducted | Implemented. Deterministic simulation tests and actual unattended browser collisions verify the flow. |
| Survival/seed/star scoring and capped multiplier | Implemented as specified. Tests check continuous integration, collection values, no duplicate collection, live bonus, cap, and monotonic points. |
| 1.5–2.8 rad/s speed, post-25s surge, increasingly difficult patterns, shorter rests | Implemented. All six pattern types are generated; every obstacle pattern is tested as clearable at early and maximum speed, including collecting the star above a tall peg. |
| Jump, rising combo seeds, gold arpeggio, thud, footsteps; mute and M | Implemented with Web Audio. Gesture activation and mute controls exercised; actual acoustic output was not auditioned. |
| Status GET every 3s, online + positive RPM grants +25%, missing data never blocks play | Implemented. Polling, active/idle/error transitions, bonus note and unblocked runs exercised with controlled responses; predicate edge cases have simulation tests. |
| Shared Supabase top_scores/submit_score with apikey header only | Implemented using exactly the supplied project and RPCs. Browser validation asserts methods, request bodies, numeric fields, header placement, and returned rank handling. No alternate leaderboard store or production fixtures. |
| Tripped/New best, final score/time/best, ≤14-character name, claim, replay, highlighted row | Implemented and exercised, including pending/claimed UI, empty-name rejection, preserved preferences and server-returned name/rank. |
| slow_down, bad_score, bad_time | Implemented and exercised. Five-second claim cooldown is retryable; rejected runs direct the player to replay. Connection failures retain the current run for retry. |
| Source, lockfile, relative static export, metadata, favicon, social image | Delivered. `dist/` is not ignored, no dependency trees/archives are submitted, and all local runtime asset references resolve. |
| Build, typecheck, useful interactions, Better Interface review, DESIGN and README | Performed and recorded here. `DESIGN.md` describes final source values; README documents installation, development, preview and rebuild. |

Ordinary choices: save only personal preferences/best locally; show eight worldwide leaders plus a claimed row when needed; pause on tab loss; retain fractional points internally and floor displayed/submitted integers. These do not require a requester-held value. Hosting and a final public URL are handled after delivery.

## Executed checks

| Command/check | Actual result |
| --- | --- |
| `npm ci` workflow | Lockfile supplied. Dependencies installed with `npm install --no-audit --no-fund`; subsequent package-lock-only synchronization succeeded. A separate clean `npm ci` install was not repeated. |
| `npm run typecheck` | Pass: strict TypeScript `checkJs`/`noEmit` over production JavaScript and Vite configuration. |
| `npm test` | Pass: 19 tests, zero failures, including deterministic patterns/physics/scoring, 120 seeded randomized runs, pause/restart/trip invariants, and status predicate edge cases. |
| `npm run build` | Pass: production Vite export with local WOFF2 fonts and relative assets. No runtime build service needed. |
| `npm run test:browser`, with supplied external Playwright/Chromium | Pass: complete production interaction checks under `/preview/`; no JavaScript page errors. Test responses are explicitly intercepted; the production code has no fixture players. |
| Pinned `taste.mjs --out test/scratch/taste`, with supplied Playwright/browser locations | Pass: all 16 checks. Render, layout, targets, contrast, casing, tracking, eyebrows, type sizes/faces, glyphs, slogans, repetition, prose budget, chrome, motion and share metadata. |
| Export integrity/budget script using read-only Git candidate listing | Pass: relative HTML/CSS references resolve; `dist/` files are not ignored; no submitted dependency trees, caches, `.tgz` archives or forbidden configuration paths. Export approximately 0.54 MiB; complete candidate submission approximately 1.16 MiB, below 8 MiB. |
| Actual supplied endpoints | Both answered read-only HTTP requests. Actual returned leaderboard rows and status rendered in Chromium through forwarding; no score was submitted to the public service. |

Browser validation starts and closes its own foreground preview and browser, using the real built files at a subpath. Viewports: 320 × 740, 390 × 664, 390 × 844, 760 × 800, 900 × 700, 1440 × 900, and 1920 × 1080. There was no horizontal overflow. The 390 × 664 primary action is fully on the first screen. Long-value fixtures include a 14-character wide name and `Number.MAX_SAFE_INTEGER` score. At 200% text size the scene grows with its contents and leaderboard name/time/score columns stay separate.

Screenshots were produced under `test/scratch/browser/` and `test/scratch/taste/shots/` and visually inspected. Representative files: `start-390.png`, `jump-390.png`, `touch-control-390.png`, `paused-390.png`, `claimed-390.png`, `results-320.png`, `running-1440.png`, `result-1440.png`, `long-values-320.png`, `text-200-percent-390.png`, `actual-endpoints-1440.png`, and the pinned probe's `390.png`/`1440.png`. These are temporary check evidence and are excluded from delivery. The required runtime social card is retained at `public/share.png` and `dist/share.png`.

## Better Interface six-domain coverage

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native buttons/input/dialog, persistent labels and hints, named icon controls, 44px utilities, keyboard paths, modal Escape/focus return, visible focus, inline announced messages, reduced motion, and storage failure. No screen-reader session or physical-device assistive technology check. Canvas timing play has no separate nonvisual equivalent. |
| Layout | Checked | Main action on first phone screen; source/DOM order; desktop split and mobile flow; narrow results; empty/error/populated board; long names/numbers; 200% text enlargement; no horizontal overflow. Native browser 200% zoom and RTL mirroring were not performed. |
| Writing | Checked | Title, direct action labels, instructions next to actions, community attribution, honest empty/loading/error/claimed states, consistent runner/score terminology, local-vs-worldwide distinction. No invented records or implied team affiliation. |
| Typography | Checked | One local Fredoka family; weights 400/500/600 across states; at most six sizes per state; complete wrapped values; stable tabular digits; 16px mobile input. Loaded local font assets and rendered rounded lettering inspected. |
| Colors | Checked | Semantic roles in CSS; text plus color for status; all solid pairs measured by taste@1 pass. Additional renderer sampling covers text over the actual canvas; four state measurements described below. Forced-color styles source-reviewed, not exercised with a native OS theme. |
| UI | Checked | Hover/focus/press/paused/result/empty/error/cooldown/claimed states, native dialog, opaque result surface, matched icon strokes, restrained animation and frozen idle reduced-motion scene. CSS transition values reviewed; browser Animations-panel 10% replay not performed. |

Canvas/gradient contrast is explicitly outside the pinned probe's solid-background measurement. The interaction script separately sampled nine background points behind each selected visible text element, using either its actual opaque HTML surface or rendered canvas pixels. All sampled elements passed their 4.5:1 body/3:1 large-text threshold:

| State | Text elements sampled | Lowest sampled ratio |
| --- | --- | --- |
| Start, 390 | 28 | 6.08:1 |
| Running, 390 | 4 | 7.26:1 |
| Claimed, 390 | 36 | 5.36:1 |
| Results, 1440 | 36 | 5.36:1 |

This is representative rendered sampling, not a guarantee for every canvas pixel at every frame. Disabled controls were exempted from this sampling. The complete temporary readings were written to `test/scratch/browser/contrast.json`.

## Findings corrected

| Severity / source | Observed problem | Correction and recheck |
| --- | --- | --- |
| High, `src/main.js:159` / `src/main.js:166` | Space used for jumping also intercepted the native sound button's activation when it had keyboard focus. A browser assertion reproduced it. | Both keydown and keyup now preserve native controls; only held game inputs suppress keyup defaults. Space on the focused sound button toggles sound, and canvas/keyboard jumps still work. |
| Medium, `src/render.js:29` / `src/style.css:197` | The initial phone status chip covered part of the hamster. Source/viewport scaling also assumed fixed text height. | Measure the title/action gap and chip height, scale the idle wheel inside it, and place the chip above the action. Final 390/320 screenshots show the hamster and the action clearly. |
| Medium, `src/style.css:167` / `src/style.css:226` | An absolutely positioned result panel could not make space for growing form messages. | Results now participate in document flow and narrow claim fields wrap. Claimed/error results at 390 and the 320 result form remain separate from the board. |
| Medium, `src/style.css:187` / `src/style.css:204` | Enlarged text allowed the rotated title spark to create horizontal overflow and crowded time/score cells. Long numeric values also needed wrapping. | Constrain the title, let mobile scene height grow, reserve rem-based wheel space, wrap complete values, and put mobile time below each name. Rechecked at 200% text size and with a maximum safe integer score; no overflow or time/score intersection. |
| Low, `src/style.css:132` / `src/style.css:146` | Programmatic reading focus outlined the noninteractive result heading, and pending claim text inherited an error color. | Keep the heading focusable for reading without a control outline; distinguish neutral pending, error and success text. Interactive focus perimeters remain visible; final result and claim states inspected. |

No known required behavior remains intentionally unimplemented. The design probe reports two entry-screen controls below its optional 44px comfort measure; neither violates the 24px/spacing rule. Main actions and utilities meet the intended comfortable sizes.

## Remaining limitations

- Direct browser requests to the external APIs were refused by the validation runtime. Actual read-only responses were checked through HTTP forwarding, while controlled browser responses exercised claim success/failure and the exact outgoing request contract. An unmodified browser-to-service claim was not sent; this avoids publishing test scores. Deployment-origin CORS and a real human claim remain unverified here.
- WebKit was unavailable, so Safari/iPhone behavior was not executed. Chromium mobile emulation is not a physical phone test.
- No manual screen-reader session, native browser zoom, RTL locale, forced-colors OS session, or audio listening session was performed. The 200% check changes text size and is not described as native page zoom.
- The configured network timeouts are source-reviewed; an actual eight-second hung submission was not separately forced. Network rejection, backend errors, cooldown, retry and loading states were exercised.
- A client-side game cannot establish the trustworthiness of public leaderboard entries. Validation covers the requested client behavior; server rules belong to the supplied service.

Complete for the stated implementation scope, with the browser/service and device verification limits above.
