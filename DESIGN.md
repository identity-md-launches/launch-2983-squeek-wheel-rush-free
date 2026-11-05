# Squeek Wheel Rush design

## Overview

A cozy night-room arcade for the Squeekchain community. The visual focus is Squeektoshi, a round orange hamster with an overstuffed cheek, running inside a large brass wheel under a pendant lamp. Cream text and a honey-gold action sit directly over the scene. On desktop the start/results controls occupy the left and the wheel the right; during play the wheel and score are centered. This composition belongs to the game, rather than a general card-based site template.

The DOM holds all controls, messages, score displays, and leaderboard content. Canvas holds the room and game illustration. `src/style.css` is the interface source of truth; `src/render.js` supplies the illustration palette and geometry. The social card in `public/share.png` is generated from this same scene.

## Colors

These semantic tokens are defined in `src/style.css:3` and directly consumed by the small single-theme interface:

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0c292b` | Deep teal page, input interiors |
| `--surface` | `#123335` | Result/help panels and status chip |
| `--raised` | `#193d3d` | Utility hover, secondary action, own leaderboard row |
| `--ink` | `#fff1d2` | Main text, headings, large scores |
| `--muted` | `#abc0b7` | Instructions, secondary text, time |
| `--subtle` | `#8ca9a2` | Captions, disclaimer, column labels |
| `--line` | `#2c4a47` | Leaderboard separators |
| `--gold` | `#ffd078` | Main action fill, score emphasis, title accent |
| `--gold-hover` | `#ffdf9e` | Main action hover |
| `--gold-ink` | `#3d3020` | Text/icons on the gold action |
| `--mint` | `#a9dfbc` | Active state, live bonus, claim success |
| `--error` | `#ffb6a4` | Field and request errors |
| `--focus` | `#b9eddb` | Visible keyboard perimeter |

Gold is intentionally shared by the action and the game's collectible/score identity; interactive elements additionally have a button shape and hover/press behavior. Status messages include text, rather than relying on color. Canvas uses its own illustrated brass ramp, orange/cream fur, warm red pegs, and a restrained warm lamp glow; these are art colors rather than extra UI variants. Contrast measurements and sampled canvas backgrounds are recorded in validation.

## Typography

Local variable **Fredoka**, provided by `@fontsource-variable/fredoka` and bundled as WOFF2, serves both playful display and simple interface text. Fallbacks are `Trebuchet MS, sans-serif`. Used weights are 400, 500 (result statistics), and 600 (headings/actions/scores). No synthetic weights or italics are requested.

| Role | Token/value | Behavior |
| --- | --- | --- |
| Caption/hint | `--text-small: .8125rem` | 13px at default root, line height 1.5–1.6 |
| Body/input | `--text-body: 1rem` | 16px; inputs remain 16px on phones |
| Lead/action | `--text-lead: 1.25rem` | 20px; actions use weight 600 |
| Section heading | `--text-heading: 1.5rem` | 24px, line height 1.2 |
| Result/pause heading | `2.5rem` | 40px, weight 600 |
| Hero/score | `--text-display` / `--text-score: 5rem` | 80px on wide desktop |

At 761–1100px the hero becomes 64px. At ≤760px the hero is 48px and score 64px; at ≤360px the hero is 40px. Each rendered state uses at most six sizes. The hero uses line height 1.02/1.05, balanced wrapping, and −.035em tracking; the score uses 1.05 and −.025em. Changing numbers use tabular numerals. Complete long names and scores wrap instead of being clipped or abbreviated.

## Layout

The shell is at most 1440px wide and centered. The header uses 5% horizontal gutters and the scene/lower content use 7.5%. At 761–1100px these tighten to 5%; mobile uses 6%. Main spacing values are 8, 12, 16, 20, 24, 28, 32, and 48px, with 8–12px inside related controls and larger gaps between groups. The lower desktop area is a `1.12fr 1fr` grid with a 10% gap: leaderboard, then a short collectible guide. At ≤760px it becomes a vertical flow.

The 92px desktop header becomes 76px on mobile. The idle desktop scene is at least 620px high; the mobile scene uses natural content height with a 730px minimum (680px at ≤360px). A reserved vertical interval separates the mobile title from the start action. `Renderer.resize()` measures that interval to locate the wheel, personal best, and status chip, so enlarged text pushes the scene and following content down naturally. The reserved interval grows with rem units. The first action is visible at 390 × 664 and 390 × 844.

Running uses the available small viewport height, with a 510px mobile minimum. On wide, short screens the scene minimum is 280px. The result panel participates in document flow and grows with names/messages/scores; it does not cover the leaderboard. At ≤760px each leaderboard row places time under the name, with score in a separate column. This keeps long names and large numbers separate at 200% text size. At ≤360px the brand's secondary word disappears and controls tighten without reducing targets.

Canvas coordinates are independent of viewport dimensions: the inner track radius is always 210 world units. `Renderer.draw()` scales the illustration, so phone and desktop share the same physics and collision rules. DPR is capped at 2 for rendering cost. Layout was inspected at 320, 390, 760, 900, 1440, and 1920px; see validation for limitations.

## Elevation & Depth

The main page is open and unboxed. Canvas supplies depth through concentric brass rings, wheel spokes, contact shadows, floor perspective, and the warm pendant glow. The primary action has a 5px brass-colored bottom shadow, which reduces on press. Results and help use an opaque surface with a soft cast shadow, without a border. Native dialog backdrop dims and blurs the scene. Inputs and secondary buttons use structural borders. Layer order is scene, HUD/controls, result panel, pause overlay, then the native help dialog.

## Shapes

Buttons and inputs share soft corners. Primary buttons use 16px radii (14px on phones), secondary buttons and inputs 10px, and result/help panels 24px. Utilities have 12px corners and ≥44px targets. The status chip is a compact capsule. All icons use matching rounded strokes and `currentColor`; the play triangle is filled and optically inset. The favicon is an original hamster face in a rounded teal square.

## Components

- `.primary-button`: one prominent gold action per screen, verb-first label, hover, focus, and `scale(.96)` press feedback. Reused for start, replay, resume, and dismissing instructions.
- `.utility`: help, sound, pause, refresh, and close controls; icon-only variants have accessible names. Sound also exposes `aria-pressed`.
- `.hud`: large score, multiplier and timer; no rapidly repeating screen-reader announcements. The live-bonus note appears only for a qualifying measurement.
- `.hamster-status`: text plus dot; asleep before/after play, active during a run, resting while paused. Changes announce politely.
- `.result-panel` / `.claim-form`: final stats, permanent input label and character hint, inline validation, pending/claimed/timeout/rejected/cooldown states, and a replay action. The result heading receives reading focus without an interactive-control outline.
- `.leaderboard-list`: honest loading, empty, error/retry, populated, and own-score states. Rendering uses DOM `textContent` for remote names. Top eight plus the claimed row as needed.
- `#help-dialog`: native modal focus containment, Escape close, and automatic focus return.
- `Renderer`: vector-like room, wheel, hamster, items, tumble, particles, and point labels; `GameAudio` supplies gesture-activated synthetic effects.

Transitions name background/color/transform and use 150ms with `cubic-bezier(.2,0,0,1)` for transforms. Reduced motion disables CSS transitions, freezes decorative idle canvas motion and motes, and suppresses collection/trip particles. Essential running motion remains because timing is the game. Pausing freezes the simulation; hidden tabs pause automatically.

## Reuse rules

Use the existing color and type tokens, native controls, and 6% mobile gutter. Keep instructions beside the relevant action and keep the wheel visible before starting. Reuse `.primary-button` for a screen's main action and `.utility`/`.secondary-button` for supporting controls. Use complete names/numbers with wrapping. New static information can reuse the lower flow and section heading; a new overlay should use a native dialog and the existing panel styles. Preserve the canvas/DOM split and independent simulation rather than putting controls or service messages into canvas art.

Design guidance was applied from Jakub Krehel's Better Interface (MIT); the documentation method adapts Paul Bakaus's Impeccable (Apache-2.0). Notices and licenses are retained in `THIRD_PARTY_NOTICES.md` and `docs/licenses/design-guidance.txt`.
