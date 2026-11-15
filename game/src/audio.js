// Synthesized sound: every effect is an oscillator built in code, so the game ships no
// audio file and never touches the network. The context starts on the first user gesture.

/** Short envelope shapes, in seconds. */
const ENVELOPE = { attack: 0.005, decay: 0.18 };

/**
 * The sound board. `muted` survives in memory only; call `unlock()` from a user gesture
 * before playing, and `toggleMute()` from the M key or the mute button.
 */
export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    return context;
  }

  /** Start the audio context (call from a click or key press). */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /** One tone: an oscillator that rises or falls, then fades out. */
  function tone(type, from, to, duration, volume) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + ENVELOPE.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Two tones a little apart, for a richer chime. */
  function chord(type, freqs, duration, volume) {
    for (const f of freqs) tone(type, f, f, duration, volume / freqs.length);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },

    /** Shard pickup: the pitch climbs with the combo, so a chain sounds like a ladder. */
    pickup(combo) {
      const base = 520 * Math.pow(1.059, Math.min(combo, 12));
      tone('sine', base, base * 1.5, 0.14, 0.5);
    },

    /** A wave cleared: a bright three-note rise. */
    waveClear() {
      chord('triangle', [523, 659, 784], 0.35, 0.4);
      tone('sine', 1046, 1568, 0.3, 0.25);
    },

    /** The player was hit: a low thud. */
    hit() {
      tone('sawtooth', 220, 55, 0.28, 0.5);
      tone('square', 110, 40, 0.22, 0.3);
    },

    /** A power-up collected: a soft two-note lift. */
    powerup() {
      chord('sine', [660, 990], 0.22, 0.4);
    },

    /** The boss wave begins: a warning swell. */
    boss() {
      tone('sawtooth', 98, 196, 0.6, 0.35);
      tone('sawtooth', 147, 294, 0.6, 0.25);
    },

    /** Victory: a four-note fanfare. */
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => {
        setTimeout(() => tone('triangle', f, f, 0.4, 0.4), i * 110);
      });
    },

    /** Defeat: a slow fall. */
    lose() {
      tone('sawtooth', 330, 82, 0.7, 0.35);
    },

    /** A menu click. */
    click() {
      tone('sine', 880, 660, 0.07, 0.3);
    },
  };
}
