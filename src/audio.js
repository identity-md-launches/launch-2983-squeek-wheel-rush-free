/** Gesture-activated Web Audio. No files, autoplay, or network audio. */
export class GameAudio {
  /** @type {AudioContext|null} */ context = null;
  muted = false;
  unlock() {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Gameplay works when audio is unavailable. */ }
  }
  /** @param {number} frequency @param {number} duration @param {number} [volume] @param {OscillatorType} [type] @param {number} [delay] @param {number} [end] */
  tone(frequency, duration, volume = .045, type = 'sine', delay = 0, end = frequency) {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  /** @param {import('./game.js').GameEvent} event */
  play(event) {
    switch (event.type) {
      case 'jump': this.tone(240, .15, .035, 'sine', 0, 540); break;
      case 'seed': this.tone(660 * 2 ** (Math.min(event.combo, 12) / 12), .11, .035, 'triangle'); break;
      case 'star': [659, 831, 988, 1318].forEach((f, i) => this.tone(f, .22, .04, 'sine', i * .065)); break;
      case 'trip': this.tone(130, .3, .07, 'triangle', 0, 35); break;
      case 'step': this.tone(90, .035, .009, 'sine'); break;
      case 'land': this.tone(110, .06, .016, 'sine'); break;
    }
  }
}
