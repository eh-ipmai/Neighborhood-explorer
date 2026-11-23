/**
 * Phase 2 Retro Chiptune & ZzFX Sound Engine (Web Audio API).
 * Zero external audio asset dependencies.
 */

let audioCtx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function ensureContext() {
  if (muted || typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCtor) {
      audioCtx = new AudioContextCtor();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Lightweight ZzFX procedural retro sound synthesizer (Web Audio API).
 * Inspired by Frank Force's ZzFX micro-synth.
 */
export function zzfx(
  volume = 0.2,
  randomness = 0.05,
  frequency = 220,
  attack = 0,
  sustain = 0,
  release = 0.1,
  shape = 0,
  shapeCurve = 1,
  slide = 0,
  noise = 0,
  bitCrush = 0
) {
  const ctx = ensureContext();
  if (!ctx) return;

  const sampleRate = ctx.sampleRate || 44100;
  const PI2 = Math.PI * 2;
  const freq = frequency * (1 + randomness * (Math.random() * 2 - 1));
  const aSamples = Math.max(1, Math.floor(attack * sampleRate));
  const sSamples = Math.floor(sustain * sampleRate);
  const rSamples = Math.max(1, Math.floor(release * sampleRate));
  const length = aSamples + sSamples + rSamples;

  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let phase = 0;
  let curFreq = freq;
  const slideDelta = (slide * 500 * PI2) / (sampleRate * sampleRate);
  let lastNoise = 0;

  for (let i = 0; i < length; i++) {
    // Envelope
    let env = 1;
    if (i < aSamples) env = i / aSamples;
    else if (i > aSamples + sSamples) {
      env = Math.max(0, 1 - (i - aSamples - sSamples) / rSamples);
    }

    // Oscillator wave shape: 0=sine, 1=triangle, 2=saw, 3=noise, 4=square
    phase += (curFreq * PI2) / sampleRate;
    curFreq = Math.max(20, curFreq + (slideDelta * sampleRate) / PI2);

    let sample;
    if (shape === 0) {
      sample = Math.sin(phase);
    } else if (shape === 1) {
      sample = Math.asin(Math.sin(phase)) * (2 / Math.PI);
    } else if (shape === 2) {
      sample = ((phase / PI2) % 1) * 2 - 1;
    } else if (shape === 3) {
      sample = Math.random() * 2 - 1;
    } else {
      sample = Math.sin(phase) >= 0 ? 1 : -1;
    }

    if (shapeCurve !== 1) {
      sample = Math.sign(sample) * Math.pow(Math.abs(sample), shapeCurve);
    }
    if (noise > 0) {
      lastNoise = (Math.random() * 2 - 1) * noise + lastNoise * (1 - noise);
      sample = sample * (1 - noise) + lastNoise;
    }
    if (bitCrush > 0 && i % Math.max(1, Math.floor(bitCrush * 10)) !== 0) {
      sample = data[i - 1] || 0;
    }

    data[i] = Math.max(-1, Math.min(1, sample * env * volume));
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

export function playTone({ freq = 440, endFreq = null, duration = 0.08, type = "square", volume = 0.06 } = {}) {
  const ctx = ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
  }

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/** Dual-tone sine arpeggio (E5 -> B5) per GDD Section 5.1 */
export function playStreetBannerChime() {
  playTone({ freq: 659.25, duration: 0.09, type: "sine", volume: 0.05 });
  setTimeout(() => {
    playTone({ freq: 987.77, duration: 0.14, type: "sine", volume: 0.05 });
  }, 75);
}

/** Left-look -> Right-look -> optional Safety XP sparkle chime */
export function playLookBothWaysChime(earnedXP = false) {
  playTone({ freq: 523.25, duration: 0.07, type: "triangle", volume: 0.05 }); // C5
  setTimeout(() => {
    playTone({ freq: 659.25, duration: 0.07, type: "triangle", volume: 0.05 }); // E5
  }, 220);
  if (earnedXP) {
    setTimeout(() => {
      playTone({ freq: 1046.5, duration: 0.16, type: "sine", volume: 0.06 }); // C6
    }, 430);
  }
}

/** Soft ZzFX footstep burst pitch-shifted for sidewalk vs grass vs scooter */
export function playStepTick(isGrass = false, isFast = false) {
  const baseFreq = isGrass ? 115 : 185;
  zzfx(
    isFast ? 0.055 : 0.04,
    0.08,
    baseFreq * (isFast ? 1.25 : 1),
    0.002,
    0,
    isFast ? 0.025 : 0.032,
    1,
    1,
    -0.8,
    isGrass ? 0.45 : 0.15
  );
}

/** Tall grass rustle noise burst */
export function playGrassRustle() {
  zzfx(0.05, 0.1, 420, 0.005, 0.01, 0.07, 3, 1, -1.2, 0.6);
}

/** Classic 2-note coin/acorn pickup ding (B5 -> E6) */
export function playCoinPickup() {
  playTone({ freq: 987.77, duration: 0.06, type: "square", volume: 0.045 });
  setTimeout(() => {
    playTone({ freq: 1318.51, duration: 0.14, type: "square", volume: 0.045 });
  }, 65);
}

/** Kick-scooter speed boost whoosh */
export function playBoostWhoosh() {
  zzfx(0.06, 0.04, 180, 0.01, 0.02, 0.09, 1, 1, 2.5, 0.2);
}

/** 4-note NES-style Quest Item Fanfare (C5 -> E5 -> G5 -> C6) */
export function playItemFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({
        freq,
        duration: idx === 3 ? 0.28 : 0.09,
        type: "square",
        volume: 0.05,
      });
    }, idx * 95);
  });
}

/** Soft SNES dialogue typewriter text blip */
export function playTextBlip() {
  playTone({ freq: 520 + Math.random() * 60, duration: 0.022, type: "triangle", volume: 0.02 });
}

/** Ascending 3-note landmark discovery chime (G5 -> B5 -> D6) */
export function playLandmarkDiscover() {
  const notes = [783.99, 987.77, 1174.66];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({ freq, duration: 0.12, type: "sine", volume: 0.05 });
    }, idx * 80);
  });
}
