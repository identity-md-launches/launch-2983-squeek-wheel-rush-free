import './style.css';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { GameAudio } from './audio.js';
import { topScores, submitScore, STATUS_URL, isLiveMeasurement } from './api.js';

/** @template {HTMLElement} T @param {string} id @returns {T} */
function el(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return /** @type {T} */ (element);
}
/** @param {string} key @param {string} fallback */
function stored(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
/** @param {string} key @param {string} value */
function save(key, value) { try { localStorage.setItem(key, value); } catch { /* Private mode still plays. */ } }
const numbers = new Intl.NumberFormat('en-US');
/** @param {number} value */
const format = value => numbers.format(Math.floor(value));
/** @param {number} value */
const time = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

const game = new Game();
const canvas = /** @type {HTMLCanvasElement} */ (el('game-canvas'));
const renderer = new Renderer(canvas, game);
const audio = new GameAudio();
audio.muted = stored('squeek-muted', 'false') === 'true';
const storedBest = Number(stored('squeek-best', '0'));
let best = Number.isSafeInteger(storedBest) && storedBest >= 0 ? storedBest : 0;
let live = false;
let runId = 0;
let resultShown = false;
let lastFrame = 0;
let hudClock = 0;
let lastPollStarted = 0;
let polling = false;
let leaderboardBusy = false;
let cooldownTimer = 0;
let cooldownUntil = 0;
/** @type {import('./api.js').ScoreRow[]} */
let scores = [];
/** @type {{rank:number,name:string,score:number,secs:number}|null} */
let claimed = null;
/** @type {Set<string>} */
const heldInputs = new Set();

const startScreen = el('start-screen');
const resultPanel = el('game-over');
const hud = el('hud');
const muteButton = /** @type {HTMLButtonElement} */ (el('mute-button'));
const claimButton = /** @type {HTMLButtonElement} */ (el('claim-button'));
const againButton = /** @type {HTMLButtonElement} */ (el('again-button'));
const runnerName = /** @type {HTMLInputElement} */ (el('runner-name'));
const claimMessage = el('claim-message');
const helpDialog = /** @type {HTMLDialogElement} */ (el('help-dialog'));

/** @param {'idle'|'running'|'paused'|'over'} state */
function screen(state) {
  document.body.dataset.state = state;
  startScreen.hidden = state !== 'idle';
  el('idle-best').hidden = state !== 'idle';
  hud.hidden = state !== 'running' && state !== 'paused';
  el('run-controls').hidden = hud.hidden;
  el('jump-button').hidden = hud.hidden;
  el('pause-screen').hidden = state !== 'paused';
  resultPanel.hidden = state !== 'over';
  const active = state === 'running';
  el('hamster-status').classList.toggle('active', active);
  el('hamster-status-text').textContent = active ? 'Squeektoshi is active' : state === 'paused' ? 'Squeektoshi is resting' : 'Squeektoshi is asleep';
  el('personal-best').textContent = format(best);
  if (state === 'running') el('jump-button').tabIndex = 0;
}
function updateHud() {
  el('score').textContent = format(game.score);
  el('score').setAttribute('aria-label', `Score ${format(game.score)}`);
  el('multiplier').textContent = `x${game.multiplier.toFixed(1)}`;
  el('timer').textContent = time(game.seconds);
  el('live-bonus').hidden = !live;
}
function start() {
  runId++;
  clearInterval(cooldownTimer);
  cooldownUntil = 0;
  audio.unlock();
  game.start();
  heldInputs.clear();
  renderer.particles = [];
  renderer.floatTexts = [];
  claimed = null;
  resultShown = false;
  claimMessage.textContent = '';
  claimMessage.classList.remove('success', 'error');
  runnerName.removeAttribute('aria-invalid');
  runnerName.disabled = false;
  claimButton.disabled = false;
  claimButton.textContent = 'Claim score';
  againButton.disabled = false;
  updateHud();
  screen('running');
  window.scrollTo({ top: 0, behavior: 'instant' });
  canvas.focus({ preventScroll: true });
}
function showResult() {
  resultShown = true;
  const isBest = Math.floor(game.score) > best;
  best = Math.max(best, Math.floor(game.score));
  save('squeek-best', String(best));
  el('result-title').textContent = isBest ? 'New best!' : 'Tripped!';
  el('final-score').textContent = format(game.score);
  el('final-time').textContent = time(game.seconds);
  el('final-best').textContent = format(best);
  screen('over');
  el('result-title').focus({ preventScroll: true });
  void refreshBoard();
}
function pause() {
  if (game.state !== 'running') return;
  heldInputs.clear();
  game.pause(); screen('paused');
  el('resume-button').focus({ preventScroll: true });
}
function resume() {
  if (game.state !== 'paused') return;
  game.resume(); screen('running');
  canvas.focus({ preventScroll: true });
  lastFrame = performance.now();
}
function home() {
  runId++;
  game.state = 'idle';
  game.items = [];
  game.jumpY = 0;
  renderer.floatTexts = [];
  renderer.particles = [];
  clearInterval(cooldownTimer);
  heldInputs.clear();
  screen('idle');
  el('start-button').focus({ preventScroll: true });
  renderBoard();
}
function setMute() {
  muteButton.setAttribute('aria-pressed', String(audio.muted));
  muteButton.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  muteButton.title = `${audio.muted ? 'Unmute' : 'Mute'} sound (M)`;
}
function toggleMute() { audio.muted = !audio.muted; save('squeek-muted', String(audio.muted)); setMute(); if (!audio.muted) audio.unlock(); }

/** @param {string} input */
function press(input) {
  if (game.state !== 'running' || heldInputs.has(input)) return;
  const wasHeld = heldInputs.size > 0;
  heldInputs.add(input);
  if (!wasHeld) { audio.unlock(); game.jump(); }
}
/** @param {string} input */
function release(input) { heldInputs.delete(input); if (!heldInputs.size) game.release(); }
const jumpKeys = new Set(['Space', 'ArrowUp', 'KeyW']);
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || helpDialog.open) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'KeyM' && !event.repeat) toggleMute();
  if (event.code === 'Escape' && !event.repeat) { if (game.state === 'running') pause(); else if (game.state === 'paused') resume(); }
  const nativeControl = event.target instanceof Element && event.target.closest('button, a') && event.target !== el('jump-button');
  if (jumpKeys.has(event.code) && game.state === 'running' && !nativeControl) { event.preventDefault(); if (!event.repeat) press(event.code); }
});
document.addEventListener('keyup', event => { if (jumpKeys.has(event.code)) { if (heldInputs.has(event.code)) event.preventDefault(); release(event.code); } });
for (const target of [canvas, el('jump-button')]) {
  target.addEventListener('pointerdown', event => {
    if (event.button !== 0 || game.state !== 'running') return;
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    press(`pointer-${event.pointerId}`);
  });
  target.addEventListener('pointerup', event => release(`pointer-${event.pointerId}`));
  target.addEventListener('pointercancel', event => release(`pointer-${event.pointerId}`));
  target.addEventListener('lostpointercapture', event => release(`pointer-${event.pointerId}`));
  target.addEventListener('contextmenu', event => event.preventDefault());
}
// Enter activates the touch jump button too; Space is handled by the global jump keys.
el('jump-button').addEventListener('keydown', event => { if (event.code === 'Enter') { event.preventDefault(); press('Enter'); } });
el('jump-button').addEventListener('keyup', event => { if (event.code === 'Enter') release('Enter'); });
window.addEventListener('blur', () => { heldInputs.clear(); game.release(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { live = false; pause(); } else { lastFrame = performance.now(); void pollStatus(); } });
el('start-button').addEventListener('click', start);
againButton.addEventListener('click', start);
el('home-button').addEventListener('click', home);
el('pause-button').addEventListener('click', pause);
el('resume-button').addEventListener('click', resume);
muteButton.addEventListener('click', toggleMute);
el('help-button').addEventListener('click', () => { pause(); helpDialog.showModal(); });
el('close-help').addEventListener('click', () => helpDialog.close());
el('got-it-button').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', event => { if (event.target === helpDialog) { const r = helpDialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) helpDialog.close(); } });

function renderBoard() {
  const list = el('leaderboard-list');
  list.replaceChildren();
  const visible = scores.slice(0, 8);
  const ownRow = claimed && scores.find(row => row.name === claimed?.name);
  if (ownRow && !visible.includes(ownRow)) visible.push(ownRow);
  for (const row of visible) {
    const li = document.createElement('li');
    const own = row.name === claimed?.name;
    if (own) li.classList.add('own-score');
    const rank = scores.indexOf(row) + 1;
    for (const [className, value] of [['rank', String(rank)], ['runner', row.name], ['runner-time', time(row.secs)], ['runner-score', format(row.score)]]) {
      const span = document.createElement('span'); span.className = className; span.textContent = value; li.append(span);
    }
    li.setAttribute('aria-label', `Rank ${rank}, ${row.name}${own ? ', you' : ''}, ${format(row.score)} points, ${time(row.secs)}`);
    list.append(li);
  }
  el('leaderboard-table').hidden = scores.length === 0;
  el('leaderboard-state').hidden = scores.length > 0;
  if (!scores.length) el('leaderboard-state').textContent = 'The wheel is waiting. Claim a run to be the first on the board.';
  // A claimed runner outside the top 20 stays visible with the rank returned by the server.
  if (claimed && !ownRow) {
    const li = document.createElement('li'); li.className = 'own-score';
    for (const [className, value] of [['rank', String(claimed.rank)], ['runner', claimed.name], ['runner-time', time(claimed.secs)], ['runner-score', format(claimed.score)]]) {
      const span = document.createElement('span'); span.className = className; span.textContent = value; li.append(span);
    }
    list.append(li);
    el('leaderboard-table').hidden = false;
    el('leaderboard-state').hidden = true;
  }
}
async function refreshBoard() {
  if (leaderboardBusy) return;
  leaderboardBusy = true;
  const button = /** @type {HTMLButtonElement} */ (el('refresh-button'));
  button.disabled = true;
  const state = el('leaderboard-state');
  if (!scores.length) { state.hidden = false; state.textContent = 'Loading the runners…'; }
  try { scores = await topScores(); renderBoard(); }
  catch {
    state.hidden = false;
    state.replaceChildren();
    const text = document.createElement('span'); text.textContent = scores.length ? 'Showing the last loaded scores. Refresh to try again.' : 'The board is taking a breather. Try again.';
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'secondary-button'; retry.textContent = 'Retry leaderboard'; retry.addEventListener('click', () => void refreshBoard());
    state.append(text, retry);
  } finally { leaderboardBusy = false; button.disabled = false; }
}
el('refresh-button').addEventListener('click', () => void refreshBoard());

/** @param {string} text */
function claimError(text) { claimMessage.classList.remove('success'); claimMessage.classList.add('error'); claimMessage.textContent = text; }
el('claim-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (game.state !== 'over' || claimButton.disabled || claimed || Date.now() < cooldownUntil) return;
  const name = runnerName.value.trim();
  if (!name || [...name].length > 14 || /[\u0000-\u001f\u007f]/.test(name)) {
    runnerName.setAttribute('aria-invalid', 'true'); claimError('Enter a runner name of 1 to 14 characters.'); runnerName.focus(); return;
  }
  runnerName.removeAttribute('aria-invalid');
  save('squeek-name', name);
  const submittedRun = runId;
  claimButton.disabled = true;
  runnerName.disabled = true;
  claimButton.textContent = 'Claiming…';
  claimMessage.classList.remove('error');
  claimMessage.textContent = 'Sending your run to the worldwide board…';
  try {
    const result = await submitScore(name, game.score, game.seconds);
    if (submittedRun !== runId) return;
    claimed = { ...result, score: Math.floor(game.score), secs: Math.floor(game.seconds) };
    claimMessage.classList.add('success');
    claimMessage.textContent = `Claimed. You're #${format(result.rank)} in the world.`;
    claimButton.textContent = 'Claimed';
    renderBoard();
    await refreshBoard();
  } catch (error) {
    if (submittedRun !== runId) return;
    const code = error instanceof Error ? error.message : '';
    claimButton.disabled = false;
    runnerName.disabled = false;
    claimButton.textContent = 'Claim score';
    if (code === 'slow_down') {
      cooldownUntil = Date.now() + 5000;
      claimButton.disabled = true;
      claimError('Too many claims. Wait a few seconds, then try again.');
      cooldownTimer = window.setInterval(() => {
        const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
        claimButton.textContent = remaining > 0 ? `Retry in ${remaining}s` : 'Claim score';
        if (remaining <= 0) { clearInterval(cooldownTimer); claimButton.disabled = false; }
      }, 250);
    } else if (code === 'bad_score' || code === 'bad_time') {
      claimError('This run was rejected by the board. Start a new run to try again.');
      claimButton.disabled = true;
    } else claimError('Couldn’t claim this run. Check your connection and try again.');
  }
});
runnerName.addEventListener('input', () => runnerName.removeAttribute('aria-invalid'));

async function pollStatus() {
  if (polling || document.hidden || performance.now() - lastPollStarted < 2500) return;
  polling = true;
  lastPollStarted = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2800);
  try {
    const response = await fetch(STATUS_URL, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Status unavailable');
    const status = await response.json();
    live = isLiveMeasurement(status);
    const resting = status?.measurement?.freshness === 'online' && status?.measurement?.rpmMilli === 0;
    el('connection-note').textContent = live ? 'Real wheel is running. All points get +25%.' : resting ? 'Real wheel is resting. Your run is always on.' : 'Live wheel unavailable. Keep running as usual.';
  } catch {
    live = false;
    el('connection-note').textContent = 'Live wheel unavailable. Keep running as usual.';
  } finally {
    clearTimeout(timeout); polling = false;
    el('connection-dot').classList.toggle('live', live);
    el('live-bonus').hidden = !live;
  }
}
/** @param {number} now */
function frame(now) {
  const delta = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0;
  lastFrame = now;
  if (!(renderer.reduced && game.state === 'idle')) game.update(delta, live);
  for (const event of game.events.splice(0)) {
    audio.play(event); renderer.event(event);
    if (event.type === 'trip') {
      el('hamster-status').classList.remove('active');
      el('hamster-status-text').textContent = 'Squeektoshi is asleep';
      heldInputs.clear();
    }
  }
  if (game.state === 'over' && !resultShown) showResult();
  hudClock += delta;
  if (hudClock > .06 && game.state === 'running') { updateHud(); hudClock = 0; }
  renderer.draw(delta, now / 1000);
  requestAnimationFrame(frame);
}

runnerName.value = stored('squeek-name', '').slice(0, 14);
screen('idle'); setMute();
void refreshBoard();
// Poll immediately, then every three seconds; neither API gates the game loop.
lastPollStarted = -Infinity;
void pollStatus();
setInterval(() => void pollStatus(), 3000);
requestAnimationFrame(frame);
