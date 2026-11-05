import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, multiplierAt, speedAt } from '../src/game.js';
import { isLiveMeasurement } from '../src/api.js';

function blankRun() { const game = new Game(() => .1); game.start(); game.nextPattern = Infinity; return game; }
function advance(game, seconds, live = false, dt = 1 / 120) { for (let t = 0; t < seconds - .000001; t += dt) game.update(Math.min(dt, seconds - t), live); }

test('multiplier grows every 12 seconds and caps at x12', () => {
  assert.equal(multiplierAt(0), 1); assert.equal(multiplierAt(12), 2); assert.equal(multiplierAt(132), 12); assert.equal(multiplierAt(9999), 12);
});
test('speed ramps, surges after 25 seconds, and stays capped at 2.8 rad/s', () => {
  assert.equal(speedAt(0), 1.5); assert.ok(speedAt(26) - speedAt(25) > speedAt(25) - speedAt(24)); assert.equal(speedAt(1000), 2.8);
  for (let t = 1; t < 200; t++) assert.ok(speedAt(t) >= speedAt(t - 1));
});
test('survival scoring integrates 10 times multiplier per second', () => {
  const game = blankRun(); advance(game, 12); assert.ok(Math.abs(game.score - 180) < .00001); assert.equal(game.state, 'running');
});
test('live survival points get exactly 25% extra', () => {
  const base = blankRun(), live = blankRun(); advance(base, 60); advance(live, 60, true); assert.ok(Math.abs(live.score - base.score * 1.25) < .000001);
});
test('live bonus can begin and end without changing earned points', () => {
  const game = blankRun(); advance(game, 3); const first = game.score; advance(game, 3, true); const second = game.score; advance(game, 3); assert.ok(first > 0 && second > first && game.score > second);
});
for (const [kind, amount, height] of [['seed', 25, 29], ['star', 150, 29]]) {
  test(`${kind} awards its multiplier-scaled value exactly once, with the live bonus`, () => {
    const game = blankRun(); game.seconds = 12; game.add(kind, .05, height); game.update(1 / 120, true);
    const event = game.events.find(e => e.type === kind); assert.ok(event); assert.ok(Math.abs(event.value - amount * game.multiplier * 1.25) < .00001);
    const count = game.events.filter(e => e.type === kind).length; advance(game, .4, true); assert.equal(game.events.filter(e => e.type === kind).length, count);
  });
}
test('holding a jump is higher than a tap and clears tall pegs', () => {
  const tap = blankRun(), hold = blankRun(); tap.jump(); tap.release(); hold.jump(); let tapMax = 0, holdMax = 0;
  for (let i = 0; i < 140; i++) { tap.update(1 / 120); hold.update(1 / 120); tapMax = Math.max(tapMax, tap.jumpY); holdMax = Math.max(holdMax, hold.jumpY); }
  assert.ok(tapMax > 27 && tapMax < 50); assert.ok(holdMax > 90 && holdMax < 110); assert.ok(holdMax > tapMax * 2); assert.equal(hold.jumpY, 0);
});
test('holding does not auto-jump, repeat keys do not reset upward velocity', () => {
  const game = blankRun(); game.jump(); advance(game, .1); const velocity = game.velocity; game.jump(); assert.equal(game.velocity, velocity); advance(game, 2); assert.equal(game.jumpY, 0); game.release(); game.jump(); assert.ok(game.velocity > 0);
});
test('red peg trips immediately; tall peg needs a full jump', () => {
  const game = blankRun(); game.add('peg', .02, 27); game.update(1 / 120); assert.equal(game.state, 'tripping');
  const low = blankRun(); low.jumpY = 35; low.velocity = 0; low.add('peg', .02, 59); low.update(1 / 120); assert.equal(low.state, 'tripping');
  const high = blankRun(); high.jumpY = 80; high.velocity = 0; high.add('peg', .02, 59); high.update(1 / 120); assert.equal(high.state, 'running');
});
test('trip preserves all points, tumbles, winds down the wheel and attached objects', () => {
  const game = blankRun(); advance(game, 4); game.add('seed', .7, 30); const points = game.score, secs = game.seconds, rotation = game.rotation, angle = game.items[0].angle; game.trip(); advance(game, 2);
  assert.equal(game.score, points); assert.equal(game.seconds, secs); assert.equal(game.state, 'over'); assert.ok(game.rotation > rotation); assert.ok(game.items[0].angle < angle);
});
test('paused runs freeze timer, wheel, obstacles, and score; resume continues', () => {
  const game = blankRun(); advance(game, 1); game.jump(); game.pause(); const frozen = [game.score, game.seconds, game.rotation, game.jumpY]; advance(game, 10); assert.deepEqual([game.score, game.seconds, game.rotation, game.jumpY], frozen); assert.equal(game.held, false); game.resume(); advance(game, 1); assert.ok(game.score > frozen[0]);
});
test('restart clears a completed run and resets the difficulty', () => {
  const game = blankRun(); game.seconds = 100; game.score = 999; game.jumpY = 30; game.combo = 10; game.trip(); advance(game, 2); game.start(); assert.equal(game.state, 'running'); assert.equal(game.score, 0); assert.equal(game.seconds, 0); assert.equal(game.jumpY, 0); assert.equal(game.combo, 0); assert.deepEqual(game.items, []); assert.equal(game.multiplier, 1);
});
test('every unlocked pattern is generated, with short rest gaps and collectible arcs', () => {
  const patterns = [];
  for (let pick = 0; pick < 6; pick++) {
    const game = new Game(() => (pick + .01) / 6); game.start(); game.seconds = 70; game.patternIndex = 5; game.spawnPattern(); patterns.push(game.items);
    assert.ok(game.nextPattern > .44); assert.ok(game.items.every(item => item.angle >= 2.6));
  }
  assert.equal(patterns[0].filter(item => item.kind === 'seed').length, 5);
  assert.equal(patterns[1].filter(item => item.kind === 'peg').length, 1);
  assert.equal(patterns[2].filter(item => item.kind === 'peg').length, 2);
  assert.equal(patterns[3].filter(item => item.kind === 'peg').length, 3);
  assert.ok(patterns[4].some(item => item.kind === 'peg' && item.height === 59));
  assert.ok(patterns[5].some(item => item.kind === 'star' && item.height === 122));
});
test('first patterns teach seeds and a single peg before advanced patterns unlock', () => {
  const game = new Game(() => .999); game.start(); game.spawnPattern(); assert.ok(game.items.every(i => i.kind === 'seed')); game.items = []; game.spawnPattern(); assert.equal(game.items.filter(i => i.kind === 'peg').length, 1);
});
test('every obstacle pattern can be cleared with a timed held jump at early and maximum speed', () => {
  for (const seconds of [0, 100, 180]) for (let pattern = 1; pattern < 6; pattern++) {
    const game = new Game(() => (pattern + .01) / 6); game.start(); game.seconds = 100; game.patternIndex = 5; game.spawnPattern(); game.seconds = seconds; game.nextPattern = Infinity;
    let jumped = false;
    for (let i = 0; i < 900 && game.state === 'running'; i++) {
      const peg = game.items.find(item => item.kind === 'peg' && item.angle > 0);
      if (!jumped && peg && peg.angle < game.speed * .37) { game.jump(); jumped = true; }
      game.update(1 / 120);
      if (game.items.every(item => item.kind !== 'peg')) break;
    }
    assert.equal(game.state, 'running', `pattern ${pattern}, speed at ${seconds}s`);
    if (pattern === 5) assert.ok(game.events.some(event => event.type === 'star'), 'the star above the tall peg is reachable');
  }
});
test('trip happens in a real unattended run; no placeholder or scripted result', () => {
  const game = new Game(() => .5); game.start(); advance(game, 12); assert.equal(game.state, 'over'); assert.ok(game.score > 100); assert.ok(game.seconds > 2 && game.seconds < 6);
});
test('only online status with a strictly positive numeric RPM enables live scoring', () => {
  assert.equal(isLiveMeasurement({ measurement: { freshness: 'online', rpmMilli: 1 } }), true);
  for (const value of [null, {}, { measurement: null }, { measurement: { freshness: 'online', rpmMilli: 0 } }, { measurement: { freshness: 'stale', rpmMilli: 500 } }, { measurement: { freshness: 'offline', rpmMilli: 500 } }, { measurement: { freshness: 'online', rpmMilli: '500' } }]) assert.equal(isLiveMeasurement(value), false);
});
test('120 seeded runs preserve score monotonicity, finite state, and bounded entities', () => {
  for (let seed = 1; seed <= 120; seed++) {
    let rng = seed;
    const random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
    const game = new Game(random); game.start(); let previous = 0;
    for (let i = 0; i < 12000 && game.state !== 'over'; i++) {
      if (i % 58 === 0) { game.release(); game.jump(); }
      if (i % 58 === 32) game.release();
      game.update(1 / 120, i % 1200 > 600);
      assert.ok(Number.isFinite(game.score) && game.score >= previous); assert.ok(game.items.length < 50); assert.ok(game.jumpY >= 0); previous = game.score;
    }
  }
});
