import { TRACK_RADIUS } from './game.js';

const TAU = Math.PI * 2;
/** @typedef {{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string,r:number}} Particle */
/** @typedef {{text:string,y:number,life:number,gold:boolean}} FloatText */

/** A hand-drawn canvas scene, using the same 210-unit track as the simulation. */
export class Renderer {
  /** @type {Particle[]} */ particles = [];
  /** @type {FloatText[]} */ floatTexts = [];
  width = 0;
  height = 0;
  scale = 1;
  cx = 0;
  cy = 0;
  idleCy = 320;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** @param {HTMLCanvasElement} canvas @param {import('./game.js').Game} game */
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    this.ctx = ctx;
    new ResizeObserver(() => this.resize()).observe(canvas);
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { this.reduced = e.matches; });
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.width <= 760 && this.game.state === 'idle') {
      const tagline = document.querySelector('.tagline')?.getBoundingClientRect();
      const button = document.getElementById('start-button')?.getBoundingClientRect();
      if (tagline && button) {
        const titleEnd = tagline.bottom - rect.top;
        const buttonTop = button.top - rect.top;
        this.idleCy = (titleEnd + buttonTop) / 2;
        const chipHeight = document.getElementById('hamster-status')?.getBoundingClientRect().height ?? 30;
        this.canvas.parentElement?.style.setProperty('--idle-best-top', `${titleEnd + 10}px`);
        this.canvas.parentElement?.style.setProperty('--idle-status-top', `${buttonTop - chipHeight - 10}px`);
      }
    }
  }
  /** @param {number} x @param {number} y @param {number} radius @param {string|CanvasGradient} fill @param {string} [stroke] @param {number} [line] */
  circle(x, y, radius, fill, stroke, line = 1) {
    const c = this.ctx;
    c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
  }
  /** @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string|CanvasGradient} fill @param {number} [rotation] */
  ellipse(x, y, rx, ry, fill, rotation = 0) {
    const c = this.ctx;
    c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, TAU); c.fillStyle = fill; c.fill();
  }
  /** @param {number} x @param {number} y @param {number} width @param {number} height @param {number} radius @param {string|CanvasGradient} fill */
  rect(x, y, width, height, radius, fill) {
    const c = this.ctx;
    c.beginPath(); c.roundRect(x, y, width, height, radius); c.fillStyle = fill; c.fill();
  }
  /** @param {number[]} points @param {string} color @param {number} width */
  line(points, color, width) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  /** @param {number} time */
  room(time) {
    const c = this.ctx, w = this.width, h = this.height;
    const mobile = w <= 760;
    const running = this.game.state === 'running' || this.game.state === 'paused';
    const background = c.createRadialGradient(w * .67, h * .34, 0, w * .59, h * .4, w * .85);
    background.addColorStop(0, '#1b4542'); background.addColorStop(.55, '#103133'); background.addColorStop(1, '#0c292b');
    c.fillStyle = background; c.fillRect(0, 0, w, h);
    const floor = mobile && !running ? 475 : h - 70;
    // Quiet paneling and a shelf, kept out of the title's reading area.
    this.line([w * .48, 6, w * .48, floor], '#23434155', 1);
    this.line([w * .90, 6, w * .90, floor], '#23434166', 1);
    this.line([w * .98, 6, w * .98, floor], '#23434155', 1);
    this.line([mobile ? 0 : w * .43, floor, w, floor], '#51604b55', 1);
    const floorShade = c.createLinearGradient(0, floor, 0, floor + 100);
    floorShade.addColorStop(0, '#183b3766'); floorShade.addColorStop(1, '#0c292b00');
    c.fillStyle = floorShade; c.fillRect(0, floor, w, 100);
    if (!mobile) {
      for (let i = 0; i < 4; i++) this.line([w * .50, floor + 20 + i * 22, w * .98, floor + 20 + i * 22], '#23444044', 1);
    }
    // A brass pendant and its warm pool of lamplight.
    const lampX = mobile ? w * .91 : w * .905;
    const lampY = mobile ? (running ? 124 : 218) : 83;
    const glow = c.createRadialGradient(lampX, lampY + 20, 0, lampX, lampY + 50, mobile ? 130 : 240);
    glow.addColorStop(0, '#ffc76d24'); glow.addColorStop(.5, '#ffc76d0b'); glow.addColorStop(1, '#ffc76d00');
    c.fillStyle = glow; c.fillRect(0, 0, w, h);
    this.line([lampX, mobile ? lampY - 100 : -5, lampX, lampY - 22], '#7e7450', 2);
    c.beginPath(); c.moveTo(lampX - 36, lampY + 7); c.quadraticCurveTo(lampX - 26, lampY - 24, lampX, lampY - 24); c.quadraticCurveTo(lampX + 26, lampY - 24, lampX + 36, lampY + 7); c.closePath();
    const brass = c.createLinearGradient(lampX - 36, 0, lampX + 36, 0);
    brass.addColorStop(0, '#5f6244'); brass.addColorStop(.55, '#a89a62'); brass.addColorStop(1, '#69694a');
    c.fillStyle = brass; c.fill();
    this.ellipse(lampX, lampY + 7, 36, 6, '#e4bd76');
    this.ellipse(lampX, lampY + 7, 26, 3, '#ffe6a6');
    const cone = c.createLinearGradient(0, lampY + 7, 0, lampY + 260);
    cone.addColorStop(0, '#ffe1a412'); cone.addColorStop(1, '#ffe1a400');
    c.beginPath(); c.moveTo(lampX - 28, lampY + 10); c.lineTo(lampX - 140, lampY + 270); c.lineTo(lampX + 140, lampY + 270); c.lineTo(lampX + 28, lampY + 10); c.closePath(); c.fillStyle = cone; c.fill();
    if (!mobile && this.game.state !== 'running' && this.game.state !== 'paused') {
      // A tiny seed jar beside the wheel.
      const jx = w * .922, jy = floor - 45;
      this.ellipse(jx, floor + 8, 44, 9, '#061e2066');
      this.rect(jx - 22, jy, 44, 52, 9, '#46615655');
      this.rect(jx - 22, jy, 44, 52, 9, '#b6bf8c0a');
      this.rect(jx - 25, jy - 6, 50, 10, 4, '#99895c');
      for (let i = 0; i < 9; i++) { c.save(); c.translate(jx - 13 + (i % 3) * 13, jy + 23 + Math.floor(i / 3) * 9); c.rotate(i * 1.2); this.seed(0, 0, .5); c.restore(); }
      this.line([jx - 16, jy + 7, jx - 16, jy + 17], '#a0b4a15c', 2);
    }
    // A handful of dust motes, still when reduced motion is requested.
    const t = this.reduced ? 0 : time;
    for (let i = 0; i < 16; i++) {
      const x = w * (.5 + ((i * .137) % .48));
      const y = 40 + ((i * 47 + t * (i % 2 ? 3 : -2)) % (h * .7) + h * .7) % (h * .7);
      this.circle(x, y, i % 3 ? 1 : 1.5, '#d4c58c21');
    }
  }
  wheel() {
    const c = this.ctx;
    this.ellipse(0, 276, 226, 21, '#001a1e66');
    // A low, sturdy brass stand behind the wheel.
    this.line([-91, 265, 0, 82, 91, 265], '#56604b', 15);
    this.line([-90, 265, 0, 82, 90, 265], '#939063', 7);
    this.rect(-119, 261, 238, 18, 8, '#6e7153');
    this.rect(-119, 259, 238, 9, 4, '#a79a69');
    this.rect(-123, 273, 35, 7, 3, '#17322e');
    this.rect(88, 273, 35, 7, 3, '#17322e');
    const inner = c.createRadialGradient(-70, -90, 10, 0, 0, 226);
    inner.addColorStop(0, '#244941'); inner.addColorStop(1, '#102e30');
    this.circle(0, 0, 223, inner);
    // Soft depth through the drum, then the rotating spokes.
    c.save(); c.rotate(this.game.rotation);
    for (let i = 0; i < 10; i++) {
      const a = TAU * i / 10;
      const x = Math.cos(a), y = Math.sin(a);
      this.line([x * 24, y * 24, x * 218, y * 218], '#56654c55', 9);
      this.line([x * 27 - 1, y * 27 - 1, x * 216 - 1, y * 216 - 1], '#9b9b6650', 2);
    }
    c.restore();
    // The wide metallic rim is built with concentric tonal rings.
    const metal = c.createLinearGradient(-180, -210, 190, 220);
    metal.addColorStop(0, '#e3b96e'); metal.addColorStop(.23, '#b79350'); metal.addColorStop(.5, '#797146'); metal.addColorStop(.75, '#d1a560'); metal.addColorStop(1, '#e5b974');
    c.beginPath(); c.arc(0, 0, 233, 0, TAU); c.strokeStyle = '#071f20'; c.lineWidth = 28; c.stroke();
    c.beginPath(); c.arc(0, 0, 232, 0, TAU); c.strokeStyle = metal; c.lineWidth = 23; c.stroke();
    c.beginPath(); c.arc(0, 0, 241, 0, TAU); c.strokeStyle = '#e0b575'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(0, 0, 221, 0, TAU); c.strokeStyle = '#f0cf8b'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.arc(0, 0, 214, 0, TAU); c.strokeStyle = '#726843'; c.lineWidth = 10; c.stroke();
    c.beginPath(); c.arc(0, 0, 209, 0, TAU); c.strokeStyle = '#b19a62'; c.lineWidth = 2; c.stroke();
    c.save(); c.rotate(this.game.rotation);
    for (let i = 0; i < 48; i++) {
      const a = i * TAU / 48;
      this.line([Math.cos(a) * 216, Math.sin(a) * 216, Math.cos(a) * 220, Math.sin(a) * 220], '#e9c47944', 2);
    }
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      this.circle(Math.cos(a) * 232, Math.sin(a) * 232, 3, '#655a38');
      this.circle(Math.cos(a) * 232 - .6, Math.sin(a) * 232 - .7, 1.3, '#f5d399');
    }
    c.restore();
    // Axle cap and a curved highlight catch the pendant light.
    this.circle(0, 0, 29, '#172f2c', '#7f8055', 2);
    this.circle(-1, -1, 24, '#a08b52', '#d0b071', 2);
    this.circle(-1, -2, 15, '#7c754b', '#c1aa6b', 1);
    this.circle(-5, -6, 5, '#b2a271');
    this.line([-5, -2, 3, 5], '#55563c', 2);
    c.beginPath(); c.arc(0, 0, 239, -1.55, -.45); c.strokeStyle = '#ffe1a2a0'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.arc(0, 0, 238, .35, 1.1); c.strokeStyle = '#e3b77950'; c.lineWidth = 2; c.stroke();
  }
  /** @param {number} x @param {number} y @param {number} [size] */
  seed(x, y, size = 1) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(size, size); c.rotate(-.4);
    c.beginPath(); c.moveTo(0, -11); c.bezierCurveTo(12, -4, 10, 10, 0, 13); c.bezierCurveTo(-10, 8, -8, -3, 0, -11); c.closePath(); c.fillStyle = '#efcd88'; c.fill(); c.strokeStyle = '#8f7047'; c.lineWidth = 1.4; c.stroke();
    c.beginPath(); c.moveTo(0, -7); c.quadraticCurveTo(2, 1, 0, 9); c.strokeStyle = '#b18a53'; c.lineWidth = 2; c.stroke();
    c.restore();
  }
  /** @param {number} x @param {number} y @param {number} time */
  star(x, y, time) {
    const c = this.ctx;
    c.save(); c.translate(x, y);
    const shine = c.createRadialGradient(0, 0, 3, 0, 0, 31);
    shine.addColorStop(0, '#ffd27255'); shine.addColorStop(1, '#ffd27200');
    this.circle(0, 0, 31, shine);
    c.rotate(this.reduced ? 0 : Math.sin(time * 2) * .14);
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const r = i % 2 ? 8 : 18; if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#ffce65'; c.fill(); c.strokeStyle = '#ffeda5'; c.lineWidth = 2; c.stroke();
    this.line([-4,-5,-2,-8], '#fff6c7', 2);
    c.restore();
  }
  /** @param {number} angle @param {number} height */
  peg(angle, height) {
    const c = this.ctx;
    c.save(); c.translate(Math.sin(angle) * TRACK_RADIUS, Math.cos(angle) * TRACK_RADIUS); c.rotate(-angle);
    this.ellipse(0, 1, 15, 4, '#051d2088');
    this.rect(-10, -height, 20, height + 2, 8, '#8e3932');
    this.rect(-8, -height, 16, height - 2, 7, '#e47957');
    this.rect(-5, -height + 4, 4, Math.max(8, height - 13), 2, '#f6aa75');
    this.ellipse(0, -height + 5, 6, 3, '#ef9a6d');
    c.restore();
  }
  /** @param {number} time */
  hamster(time) {
    const c = this.ctx, game = this.game;
    const jogging = game.state === 'idle' || game.state === 'running';
    const airborne = game.jumpY > 0;
    const phase = this.reduced && game.state === 'idle' ? 0 : time * (game.state === 'idle' ? 10 : 22);
    const bob = jogging && !airborne ? Math.sin(phase) * 1.7 : 0;
    const stumble = game.state === 'tripping' || game.state === 'over';
    this.ellipse(0, TRACK_RADIUS - 1, Math.max(12, 38 - game.jumpY * .13), 6, '#071e2188');
    c.save();
    c.translate(0, TRACK_RADIUS - game.jumpY - 35 + bob);
    if (stumble) {
      const t = this.reduced ? 1 : Math.min(game.tripTime / .65, 1);
      c.translate(-Math.sin(t * Math.PI * .6) * 22, Math.sin(t * Math.PI) * -24 + t * 10);
      c.rotate(-t * Math.PI * 1.1);
    }
    if (airborne) c.rotate(-.09);
    // Tail, round ears, then the soft orange body.
    this.ellipse(-37, 17, 8, 6, '#dc9c73', -.4);
    this.circle(-17, -27, 13, '#a85833', '#402f25', 2);
    this.circle(-17, -28, 8, '#edb095');
    this.circle(20, -29, 13, '#d78b47', '#5a3826', 2);
    this.circle(20, -29, 7, '#edb295');
    const fur = c.createLinearGradient(-30, -30, 25, 28);
    fur.addColorStop(0, '#f9ba64'); fur.addColorStop(.55, '#eca052'); fur.addColorStop(1, '#cb7538');
    c.beginPath(); c.moveTo(-34, 10); c.bezierCurveTo(-40,-13,-26,-31,-5,-31); c.bezierCurveTo(22,-36,38,-15,36,9); c.bezierCurveTo(40,34,5,41,-19,33); c.bezierCurveTo(-32,30,-37,23,-34,10); c.closePath(); c.fillStyle = fur; c.fill(); c.strokeStyle = '#6b412a'; c.lineWidth = 2; c.stroke();
    // Cream tummy, and the satisfyingly overstuffed cheek on the leading side.
    this.ellipse(-3, 19, 27, 17, '#ffe0a7');
    this.ellipse(21, 10, 22, 21, '#ffe6b2', -.15);
    this.ellipse(30, 9, 10, 9, '#ffd4a2', -.2);
    this.ellipse(25, 9, 5, 3, '#f0b18d');
    // Little fur tufts at the crown.
    this.line([-12,-28,-8,-32,-4,-29,1,-32,4,-29], '#f9c57c', 2);
    if (stumble) {
      this.line([4,-11,12,-4,4,-4,12,-11], '#423129', 2);
      this.line([24,-12,30,-5,24,-5,30,-12], '#423129', 2);
    } else {
      this.ellipse(9,-8, 4.2, 6.2, '#312f26');
      this.ellipse(29,-9, 3.4, 5.4, '#312f26');
      this.circle(10,-10,1.5,'#fff8dd'); this.circle(30,-11,1.2,'#fff8dd');
      this.line([4,-19,11,-20], '#9f6234', 1.4);
    }
    this.ellipse(35,1,4,3,'#734935');
    this.line([34,4,32,8,28,8], '#9a6b4b', 1.3);
    this.line([36,9,45,7], '#d7b486', 1);
    this.line([36,12,46,13], '#d7b486', 1);
    // Paws and alternating feet; squashed forward while in the air.
    const stride = airborne || !jogging ? 0 : Math.sin(phase);
    this.ellipse(-14 + stride * 8, 34, 12, 5, '#da976c', -.12 - stride * .25);
    this.ellipse(16 - stride * 8, 34, 12, 5, '#f4bf88', .1 + stride * .25);
    this.ellipse(4, 18, 7, 5, '#f4b771', -.6);
    this.line([6,20,9,21], '#cc8f56', 1);
    c.restore();
  }
  /** @param {import('./game.js').GameEvent} event */
  event(event) {
    if (event.type === 'seed' || event.type === 'star') {
      this.floatTexts.push({ text: `+${Math.round(event.value)}`, y: TRACK_RADIUS - this.game.jumpY - 60, life: .8, gold: event.type === 'star' });
      if (this.reduced) return;
      for (let i = 0; i < (event.type === 'star' ? 18 : 6); i++) {
        const a = Math.random() * TAU;
        this.particles.push({ x: 12, y: TRACK_RADIUS - this.game.jumpY - 30, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70 - 20, life: .6, max: .6, color: i % 2 ? '#ffdc91' : '#f2b34b', r: Math.random() * 2 + 1 });
      }
    }
    if (event.type === 'trip' && !this.reduced) {
      for (let i = 0; i < 12; i++) this.particles.push({ x: 0, y: TRACK_RADIUS - 8, vx: (Math.random() - .5) * 180, vy: -Math.random() * 110, life: .7, max: .7, color: '#c4ae70', r: 2 + Math.random() * 3 });
    }
  }
  /** @param {number} delta @param {number} time */
  draw(delta, time) {
    const c = this.ctx, w = this.width, h = this.height;
    if (!w || !h) return;
    this.room(time);
    const mobile = w <= 760, idle = this.game.state === 'idle';
    const over = this.game.state === 'over' || this.game.state === 'tripping';
    if (mobile) {
      this.scale = idle ? Math.min(w / 640, .78) : Math.min(w / 550, (h - 220) / 540, .98);
      this.cx = w * .5;
      this.cy = idle ? this.idleCy : over ? h * .47 : 155 + (h - 230) * .45;
    } else {
      this.scale = Math.min(w * .00091, h / 620, 1.16);
      this.cx = w * (idle || over ? .685 : .5);
      this.cy = h * .46 + 12;
    }
    c.save(); c.translate(this.cx, this.cy); c.scale(this.scale, this.scale);
    if (mobile && over) c.globalAlpha = .27;
    this.wheel();
    const game = this.game;
    const demoItems = [
      { kind: 'seed', angle: .57, height: 32 }, { kind: 'seed', angle: .79, height: 32 }, { kind: 'seed', angle: 1.01, height: 32 },
      { kind: 'peg', angle: 1.55, height: 27 }, { kind: 'seed', angle: 1.9, height: 48 }, { kind: 'seed', angle: 2.12, height: 35 },
    ];
    for (const item of idle ? demoItems : game.items) {
      if ('taken' in item && item.taken) continue;
      if (item.kind === 'peg') this.peg(item.angle, item.height);
      else {
        const radius = TRACK_RADIUS - item.height;
        const x = Math.sin(item.angle) * radius, y = Math.cos(item.angle) * radius;
        if (item.kind === 'seed') { c.save(); c.translate(x, y); c.rotate(-item.angle + .3); this.seed(0, 0, .82); c.restore(); }
        else this.star(x, y, time);
      }
    }
    this.hamster(time);
    const dt = game.state === 'paused' ? 0 : delta;
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt;
      if (p.life > 0) { c.globalAlpha = Math.max(0, p.life / p.max); this.circle(p.x, p.y, p.r, p.color); }
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floatTexts) {
      f.life -= dt; if (!this.reduced) f.y -= dt * 35;
      c.globalAlpha = Math.min(1, Math.max(0, f.life * 3)); c.font = `600 ${f.gold ? 26 : 21}px "Fredoka Variable", sans-serif`; c.textAlign = 'center'; c.fillStyle = f.gold ? '#ffe4a0' : '#f8dfad'; c.fillText(f.text, 22, f.y);
    }
    this.floatTexts = this.floatTexts.filter(f => f.life > 0);
    c.restore();
  }
}
