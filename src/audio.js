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

/** Gentle 2-tone curb-stop reminder when trying to cross a road without looking both ways */
export function playCurbStopBoop() {
  playTone({ freq: 349.23, duration: 0.065, type: "triangle", volume: 0.055 }); // F4
  setTimeout(() => {
    playTone({ freq: 261.63, duration: 0.1, type: "triangle", volume: 0.055 }); // C4
  }, 75);
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

/** Gentle kid-friendly retro spooky graveyard chime (eerie descending minor sine + ghostly shimmer) */
export function playSpookyChime() {
  const notes = [659.25, 622.25, 493.88, 392.0]; // E5 -> Eb5 -> B4 -> G4
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({
        freq,
        endFreq: freq * 0.96,
        duration: idx === 3 ? 0.28 : 0.13,
        type: "sine",
        volume: 0.04,
      });
    }, idx * 115);
  });
}

/** Crisp wooden sign-tap + brass compass chime when reading an active street sign */
export function playSignpostReadChime(isNewSign = false) {
  playTone({ freq: 587.33, duration: 0.065, type: "triangle", volume: 0.05 }); // D5
  setTimeout(() => {
    playTone({ freq: 880.0, duration: 0.1, type: "sine", volume: 0.05 }); // A5
  }, 65);
  if (isNewSign) {
    setTimeout(() => {
      playTone({ freq: 1174.66, duration: 0.16, type: "sine", volume: 0.055 }); // D6 sparkle
    }, 145);
  }
}

/** Hilarious rapid warbling retro wild Newton turkey gobble! */
export function playTurkeyGobble() {
  const warble = [380, 510, 340, 480, 310];
  warble.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({
        freq,
        endFreq: freq * 0.78,
        duration: 0.055,
        type: "triangle",
        volume: 0.055,
      });
    }, idx * 52);
  });
}

/** Funny nasal retro megaphone protestor chant squawk! */
export function playProtestorShout() {
  zzfx(0.055, 0.06, 260, 0.005, 0.03, 0.09, 2, 1.2, 0.9, 0.18);
  setTimeout(() => {
    zzfx(0.05, 0.06, 330, 0.005, 0.02, 0.08, 2, 1.1, -0.5, 0.16);
  }, 115);
}

/** Classic 16-bit SNES RPG hit/bonk knockback SFX when bumped by a wild turkey or protestor! */
export function playBumpHurtSfx() {
  zzfx(0.085, 0.05, 190, 0.003, 0.02, 0.12, 4, 1.1, -2.6, 0.35);
  setTimeout(() => {
    playTone({ freq: 240, endFreq: 110, duration: 0.11, type: "square", volume: 0.055 });
  }, 45);
}

/** Playful spooky graveyard "BOO!" warble SFX when a skeleton, phantom, or ghost spooks Liam! */
export function playSpookyBooSfx() {
  playTone({ freq: 587.33, endFreq: 311.13, duration: 0.16, type: "sine", volume: 0.065 });
  setTimeout(() => {
    playTone({ freq: 466.16, endFreq: 220.0, duration: 0.18, type: "triangle", volume: 0.06 });
  }, 75);
}

/** Crisp 16-bit Link-to-the-Past style sword swing swoosh! */
export function playSwordSlashSfx() {
  zzfx(0.09, 0.05, 620, 0.002, 0.015, 0.09, 3, 1.0, -4.5, 0.45);
  playTone({ freq: 880, endFreq: 260, duration: 0.09, type: "sawtooth", volume: 0.045 });
}

/** Radiant ascending harp/chime harmonic chord when raising the Pocket Siddur to dispel bad guys! */
export function playSiddurDispelSfx() {
  const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
  chord.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({ freq, duration: idx === 4 ? 0.34 : 0.16, type: "triangle", volume: 0.055 });
    }, idx * 55);
  });
}

/** Joyful heart-heal chime when getting a band-aid, treat, or completing a quest! */
export function playHealHeartSfx() {
  const notes = [587.33, 783.99, 1174.66]; // D5 -> G5 -> D6
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({ freq, duration: idx === 2 ? 0.22 : 0.09, type: "sine", volume: 0.06 });
    }, idx * 75);
  });
}

/** Dramatic tire-screech + crash impact when hit by a car or bike on the road! */
export function playCarCrashSfx() {
  zzfx(0.11, 0.05, 960, 0.005, 0.08, 0.16, 2, 1.4, -3.2, 0.35);
  setTimeout(() => {
    zzfx(0.14, 0.08, 120, 0.002, 0.05, 0.28, 3, 1.0, -1.8, 0.85);
    playTone({ freq: 180, endFreq: 55, duration: 0.28, type: "sawtooth", volume: 0.08 });
  }, 110);
}

/** Classic two-tone retro EMS ambulance wee-woo siren! */
export function playAmbulanceSirenSfx() {
  playTone({ freq: 784.0, endFreq: 840.0, duration: 0.24, type: "square", volume: 0.04 });
  setTimeout(() => {
    playTone({ freq: 587.33, endFreq: 560.0, duration: 0.26, type: "square", volume: 0.04 });
  }, 245);
}

/**
 * Mournful 16-bit SNES dark-boss Game Over dirge (solemn minor arpeggio + descending tragic cadence,
 * inspired by classic Link vs Ganondorf defeat themes).
 */
export function playGameOverDirge() {
  // Solemn D-minor descending melody + low ominous bass organ
  const melody = [
    { t: 0, freq: 440.0, dur: 0.26, type: "triangle", vol: 0.065 },    // A4
    { t: 260, freq: 392.0, dur: 0.26, type: "triangle", vol: 0.065 },  // G4
    { t: 520, freq: 349.23, dur: 0.28, type: "triangle", vol: 0.065 }, // F4
    { t: 820, freq: 329.63, dur: 0.32, type: "triangle", vol: 0.065 }, // E4
    { t: 1180, freq: 349.23, dur: 0.22, type: "triangle", vol: 0.06 }, // F4
    { t: 1420, freq: 311.13, dur: 0.28, type: "triangle", vol: 0.06 }, // Eb4 (dark Neapolitan!)
    { t: 1740, freq: 293.66, dur: 0.72, type: "triangle", vol: 0.07 }, // D4 (final solemn rest)
    // Low somber bass accompaniment
    { t: 0, freq: 146.83, dur: 0.75, type: "sawtooth", vol: 0.035 },   // D3
    { t: 820, freq: 130.81, dur: 0.55, type: "sawtooth", vol: 0.035 }, // C3
    { t: 1420, freq: 116.54, dur: 0.30, type: "sawtooth", vol: 0.035 },// Bb2
    { t: 1740, freq: 110.0, dur: 0.45, type: "sawtooth", vol: 0.035 }, // A2
    { t: 1740, freq: 73.42, dur: 0.85, type: "triangle", vol: 0.06 },  // D2 deep pedal
  ];
  for (const n of melody) {
    setTimeout(() => {
      playTone({ freq: n.freq, duration: n.dur, type: n.type, volume: n.vol });
    }, n.t);
  }
}

/** Obnoxious rapid brass bicycle bell ("DING-DING-DING!!") + pompous cyclist squawk! */
export function playAnnoyingBikerSfx() {
  [0, 85, 170].forEach((delay, idx) => {
    setTimeout(() => {
      playTone({ freq: idx === 2 ? 2093.0 : 1760.0, duration: 0.08, type: "sine", volume: 0.055 });
      playTone({ freq: 2637.0, duration: 0.06, type: "triangle", volume: 0.03 });
    }, delay);
  });
}

/** Crisp two-beep EMS paramedic radio dispatch chirp when EMTs hop out of the ambulance! */
export function playEmtRadioBeepSfx() {
  playTone({ freq: 1174.66, duration: 0.05, type: "square", volume: 0.04 });
  setTimeout(() => {
    playTone({ freq: 1567.98, duration: 0.07, type: "square", volume: 0.04 });
  }, 65);
}
