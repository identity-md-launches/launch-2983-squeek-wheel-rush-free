/** @typedef {'seed'|'star'|'peg'} ItemKind */
/** @typedef {{ id:number, kind:ItemKind, angle:number, height:number, taken:boolean }} WheelItem */
/** @typedef {'idle'|'running'|'paused'|'tripping'|'over'} GameState */
/** @typedef {{type:'jump'|'land'|'seed'|'star'|'trip'|'step', combo:number, value:number}} GameEvent */

export const TRACK_RADIUS = 210;
export const multiplierAt = (/** @type {number} */ seconds) => Math.min(12, 1 + seconds / 12);
export const speedAt = (/** @type {number} */ seconds) => Math.min(2.8, 1.5 + seconds * 0.014 + (seconds > 25 ? Math.min(0.15, (seconds - 25) * 0.03) : 0));
export const liveFactor = (/** @type {boolean} */ live) => live ? 1.25 : 1;

/** Pure simulation. World units stay identical at every screen size. */
export class Game {
  /** @type {GameState} */ state = 'idle';
  /** @type {WheelItem[]} */ items = [];
  /** @type {GameEvent[]} */ events = [];
  seconds = 0;
  score = 0;
  rotation = 0;
  jumpY = 0;
  velocity = 0;
  held = false;
  combo = 0;
  nextPattern = 0;
  itemId = 0;
  tripTime = 0;
  stepClock = 0;
  patternIndex = 0;
  /** @param {() => number} random */
  constructor(random = Math.random) { this.random = random; }
  get multiplier() { return multiplierAt(this.seconds); }
  get speed() { return speedAt(this.seconds); }
  start() {
    this.state = 'running';
    this.items = [];
    this.events = [];
    this.seconds = 0;
    this.score = 0;
    this.jumpY = 0;
    this.velocity = 0;
    this.held = false;
    this.combo = 0;
    this.tripTime = 0;
    this.nextPattern = 0.15;
    this.stepClock = 0;
    this.patternIndex = 0;
  }
  jump() {
    if (this.state !== 'running' || this.held) return;
    this.held = true;
    if (this.jumpY > 0.5) return;
    this.velocity = 295;
    this.jumpY = 0.01;
    this.emit('jump');
  }
  release() { this.held = false; }
  pause() { if (this.state === 'running') { this.state = 'paused'; this.release(); } }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  trip() {
    if (this.state !== 'running') return;
    this.state = 'tripping';
    this.tripTime = 0;
    this.release();
    this.emit('trip');
  }
  /** @param {GameEvent['type']} type @param {number} [value] */
  emit(type, value = 0) { this.events.push({ type, combo: this.combo, value }); }
  /** @param {ItemKind} kind @param {number} angle @param {number} height */
  add(kind, angle, height) { this.items.push({ id: ++this.itemId, kind, angle, height, taken: false }); }
  spawnPattern() {
    const start = 2.6;
    const n = this.patternIndex++;
    const unlocked = this.seconds < 10 ? 2 : this.seconds < 22 ? 3 : this.seconds < 35 ? 4 : 6;
    const pick = n === 0 ? 0 : n === 1 ? 1 : Math.floor(this.random() * unlocked);
    let length = 0.7;
    if (pick === 0) {
      for (let i = 0; i < 5; i++) this.add('seed', start + i * .19, 30);
      length = .95;
    } else if (pick === 1) {
      this.add('peg', start + .35, 27);
      [35, 65, 85, 65, 35].forEach((height, i) => this.add('seed', start + i * .18, height));
      length = .9;
    } else if (pick === 2 || pick === 3) {
      const pegs = pick === 2 ? 2 : 3;
      for (let i = 0; i < pegs; i++) this.add('peg', start + i * .24, 27);
      for (let i = 0; i < 3; i++) this.add('seed', start + .05 + i * .2, 84);
      length = .24 * pegs + .25;
    } else {
      this.add('peg', start + .3, 59);
      if (pick === 5) this.add('star', start + .3, 122);
      else [65, 105, 65].forEach((height, i) => this.add('seed', start + i * .3, height));
      length = .8;
    }
    const rest = Math.max(.44, 1.15 - this.seconds * .007);
    this.nextPattern = length / this.speed + rest;
  }
  /** @param {number} delta @param {boolean} [live] */
  update(delta, live = false) {
    const dt = Math.min(Math.max(delta, 0), .05);
    if (this.state === 'idle') { this.rotation += dt * .14; return; }
    if (this.state === 'paused' || this.state === 'over') return;
    if (this.state === 'tripping') {
      this.tripTime += dt;
      const turn = dt * this.speed * Math.max(0, 1 - this.tripTime / 1.1) ** 2;
      this.rotation += turn;
      for (const item of this.items) item.angle -= turn;
      if (this.tripTime >= 1.25) this.state = 'over';
      return;
    }
    const previous = this.seconds;
    this.seconds += dt;
    this.rotation += this.speed * dt;
    // Integrate the growing multiplier using the midpoint; do not discard fractions.
    this.score += 10 * multiplierAt((previous + this.seconds) / 2) * liveFactor(live) * dt;
    if (this.jumpY > 0 || this.velocity > 0) {
      const gravity = this.held && this.velocity > 0 ? 430 : 1050;
      this.velocity -= gravity * dt;
      this.jumpY = Math.max(0, this.jumpY + this.velocity * dt);
      if (this.jumpY === 0) { this.velocity = 0; this.emit('land'); }
    } else {
      this.stepClock += dt;
      if (this.stepClock > .19) { this.stepClock = 0; this.emit('step'); }
    }
    this.nextPattern -= dt;
    if (this.nextPattern <= 0) this.spawnPattern();
    for (const item of this.items) {
      item.angle -= this.speed * dt;
      if (item.taken) continue;
      if (item.kind === 'peg') {
        if (Math.abs(item.angle) < .105 && this.jumpY < item.height - 3) { this.trip(); break; }
      } else if (Math.abs(item.angle) < .16 && Math.abs(this.jumpY + 29 - item.height) < 27) {
        item.taken = true;
        this.combo++;
        const value = (item.kind === 'star' ? 150 : 25) * this.multiplier * liveFactor(live);
        this.score += value;
        this.emit(item.kind, value);
      } else if (item.angle < -.2 && !item.taken) { item.taken = true; this.combo = 0; }
    }
    this.items = this.items.filter(item => item.angle > -.6 && item.angle < 5.5 && (!item.taken || item.kind === 'peg'));
  }
}
