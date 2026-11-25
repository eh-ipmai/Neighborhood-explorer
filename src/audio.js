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

/** Soft ZzFX footstep burst pitch-shifted by surface type & speed */
export function playStepTick(surfaceOrGrass = false, isFast = false) {
  let baseFreq = 185;
  let noise = 0.15;
  let shape = 1;
  if (surfaceOrGrass === true || surfaceOrGrass === "grass" || surfaceOrGrass === "park" || surfaceOrGrass === "tall_grass") {
    baseFreq = 118;
    noise = 0.45;
  } else if (surfaceOrGrass === "dirt") {
    baseFreq = 142;
    noise = 0.52;
  } else if (surfaceOrGrass === "sand") {
    baseFreq = 105;
    noise = 0.65;
    shape = 3;
  } else if (surfaceOrGrass === "indoors" || surfaceOrGrass === "dungeon") {
    baseFreq = 235;
    noise = 0.08;
  } else if (surfaceOrGrass === "residential_road" || surfaceOrGrass === "main_road" || surfaceOrGrass === "highway" || surfaceOrGrass === "parking_lot") {
    baseFreq = 215;
    noise = 0.22;
  }
  zzfx(
    isFast ? 0.055 : 0.04,
    0.08,
    baseFreq * (isFast ? 1.25 : 1),
    0.002,
    0,
    isFast ? 0.025 : 0.032,
    shape,
    1,
    -0.8,
    noise
  );
}

/** Tall grass rustle noise burst */
export function playGrassRustle() {
  zzfx(0.05, 0.1, 420, 0.005, 0.01, 0.07, 3, 1, -1.2, 0.6);
}

/** Bubbly retro water-wading splash SFX when wading/swimming in lakes & ponds */
export function playWaterSplash(isFast = false) {
  zzfx(
    isFast ? 0.065 : 0.048,
    0.12,
    isFast ? 310 : 240,
    0.004,
    0.015,
    isFast ? 0.095 : 0.075,
    3,
    1.1,
    isFast ? 1.8 : 1.1,
    0.72
  );
  playTone({
    freq: isFast ? 520 : 410,
    endFreq: isFast ? 780 : 590,
    duration: isFast ? 0.075 : 0.055,
    type: "sine",
    volume: 0.028,
  });
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

/**
 * Classify a speaker name into a distinct character voice profile so Mom, kids/friends,
 * coaches, librarians, rabbis/shul hosts, bakers, firefighters, spooky characters, and
 * marchers all sound genuinely distinct when speaking!
 */
export function resolveVoiceProfile(speaker = "") {
  const s = String(speaker || "").toLowerCase();
  if (s.includes("mom") || s.includes("dad") || s.includes("kitchen") || s.includes("home")) {
    return { id: "family", baseFreq: 465, spread: 55, type: "triangle", dur: 0.028, vol: 0.026 };
  }
  if (s.includes("coach") || s.includes("fire") || s.includes("chief") || s.includes("guard") || s.includes("police")) {
    return { id: "coach", baseFreq: 235, spread: 40, type: "sawtooth", dur: 0.032, vol: 0.02 };
  }
  if (/\bfriend\b/.test(s) || s.includes("ross") || s.includes("salzberg") || s.includes("bella") || s.includes("sydney") || s.includes("champion") || /\bkid\b/.test(s)) {
    return { id: "kid", baseFreq: 690, spread: 110, type: "square", dur: 0.02, vol: 0.018 };
  }
  if (s.includes("rabbi") || s.includes("kiddush") || s.includes("shul") || s.includes("beth el") || s.includes("shaarei") || s.includes("emanuel") || s.includes("chabad") || s.includes("chapel")) {
    return { id: "shul", baseFreq: 315, spread: 45, type: "triangle", dur: 0.036, vol: 0.026 };
  }
  if (s.includes("librarian") || s.includes("clara") || s.includes("library") || s.includes("book") || s.includes("professor") || s.includes("college") || s.includes("bc")) {
    return { id: "scholar", baseFreq: 560, spread: 60, type: "sine", dur: 0.026, vol: 0.026 };
  }
  if (s.includes("baker") || s.includes("bagel") || s.includes("licks") || s.includes("scoop") || s.includes("cafe") || s.includes("café") || s.includes("taqueria") || s.includes("donut") || s.includes("pretzel")) {
    return { id: "shop", baseFreq: 610, spread: 90, type: "triangle", dur: 0.024, vol: 0.025 };
  }
  if (s.includes("ghost") || s.includes("spooky") || s.includes("grave") || s.includes("dungeon") || s.includes("d&d") || s.includes("secret") || s.includes("cemetery")) {
    return { id: "spooky", baseFreq: 380, spread: 70, type: "sine", dur: 0.04, vol: 0.024, slide: 0.88 };
  }
  if (s.includes("doctor") || s.includes("dr.") || s.includes("clinic") || s.includes("emt") || s.includes("paramedic")) {
    return { id: "medic", baseFreq: 360, spread: 50, type: "triangle", dur: 0.026, vol: 0.024 };
  }
  return { id: "neighbor", baseFreq: 515, spread: 65, type: "triangle", dur: 0.024, vol: 0.022 };
}

/** Character-specific SNES dialogue typewriter voice blip! */
export function playTextBlip(speaker = "") {
  const v = resolveVoiceProfile(speaker);
  const freq = v.baseFreq + Math.random() * v.spread;
  playTone({
    freq,
    endFreq: v.slide ? freq * v.slide : null,
    duration: v.dur,
    type: v.type,
    volume: v.vol,
  });
}

/** Distinct character greeting motif when opening dialogue with different Newton characters! */
export function playDialogueOpenSfx(speaker = "") {
  const v = resolveVoiceProfile(speaker);
  const motifs = {
    family: [523.25, 659.25],          // Warm C5 -> E5
    coach: [261.63, 392.0],            // Punchy C4 -> G4
    kid: [659.25, 880.0, 1046.5],      // Bouncy kid triad
    shul: [392.0, 440.0, 523.25],      // Warm resonant step
    scholar: [587.33, 739.99],         // Crisp scholarly D5 -> F#5
    shop: [659.25, 783.99, 987.77],    // Cheerful shop bell
    spooky: [493.88, 466.16, 392.0],   // Eerie minor descend
    medic: [440.0, 587.33],            // Reassuring A4 -> D5
    neighbor: [493.88, 659.25],        // Friendly B4 -> E5
  };
  const notes = motifs[v.id] || motifs.neighbor;
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({ freq, duration: 0.075, type: v.type === "sawtooth" ? "triangle" : v.type, volume: 0.042 });
    }, idx * 55);
  });
}

/** Crisp subtle page-advance click when advancing dialogue lines */
export function playDialogueAdvanceSfx() {
  playTone({ freq: 720, endFreq: 920, duration: 0.038, type: "triangle", volume: 0.032 });
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

/** Rapid high-pitched staccato wild squirrel chitter! */
export function playSquirrelChitter() {
  const chirps = [1180, 1420, 1260, 1520, 1140];
  chirps.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({
        freq,
        endFreq: freq * 0.84,
        duration: 0.036,
        type: "square",
        volume: 0.035,
      });
    }, idx * 42);
  });
}

/** Expressive retro pitch-bent sassy neighborhood cat meow! */
export function playCatMeow() {
  playTone({ freq: 720, endFreq: 960, duration: 0.08, type: "triangle", volume: 0.055 });
  setTimeout(() => {
    playTone({ freq: 940, endFreq: 490, duration: 0.18, type: "triangle", volume: 0.055 });
  }, 75);
}

/** Punchy double retro runaway-dog bark ("WOOF! WOOF!") */
export function playDogBark() {
  [0, 125].forEach((delay, idx) => {
    setTimeout(() => {
      zzfx(0.08, 0.06, idx === 0 ? 220 : 245, 0.004, 0.025, 0.085, 2, 1.2, -2.4, 0.35);
      playTone({ freq: idx === 0 ? 290 : 320, endFreq: 135, duration: 0.08, type: "sawtooth", volume: 0.045 });
    }, delay);
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

/** Warm wooden home door knock/chime when stepping inside or outside Home Base */
export function playDoorChime() {
  playTone({ freq: 392.0, duration: 0.065, type: "triangle", volume: 0.055 }); // G4
  setTimeout(() => {
    playTone({ freq: 523.25, duration: 0.1, type: "sine", volume: 0.055 }); // C5
  }, 65);
}

/** Classic 16-bit Zelda-style secret reveal jingle (for sliding bookshelf & D&D puzzle solve!) */
export function playSecretRevealSfx() {
  const notes = [392.0, 369.99, 311.13, 220.0, 207.65, 329.63, 415.3, 523.25];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({ freq, duration: idx === 7 ? 0.28 : 0.085, type: "triangle", volume: 0.06 });
    }, idx * 75);
  });
}

/** Cheerful Golden D20 clatter & sparkle roll chime */
export function playDiceRollSfx(isCrit = false) {
  const ticks = [620, 740, 560, 820, isCrit ? 1318.51 : 987.77];
  ticks.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({
        freq,
        duration: idx === 4 ? 0.24 : 0.045,
        type: idx === 4 ? "sine" : "square",
        volume: idx === 4 ? 0.06 : 0.035,
      });
    }, idx * 55);
  });
}

/** Breath of the Wild Sheikah-style crystalline dematerialize teleport SFX! */
export function playBotwTeleportOutSfx() {
  // Shimmering ascending pentatonic blue-energy chimes + airy upward harmonic whoosh
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({ freq, endFreq: freq * 1.12, duration: 0.14, type: "sine", volume: 0.048 });
      playTone({ freq: freq * 0.5, duration: 0.12, type: "triangle", volume: 0.03 });
    }, idx * 72);
  });
  setTimeout(() => {
    zzfx(0.06, 0.04, 880, 0.04, 0.14, 0.22, 0, 1.3, 4.8, 0.2);
  }, 360);
}

/** Breath of the Wild Sheikah-style crystalline arrival rematerialize SFX! */
export function playBotwTeleportInSfx() {
  const notes = [1567.98, 1318.51, 1046.5, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone({
        freq,
        duration: idx === 4 ? 0.34 : 0.11,
        type: idx === 4 ? "triangle" : "sine",
        volume: idx === 4 ? 0.065 : 0.048,
      });
    }, idx * 75);
  });
  setTimeout(() => {
    playTone({ freq: 523.25, duration: 0.32, type: "sine", volume: 0.05 });
  }, 300);
}

/** Playful snack-toss arc whoosh + cheerful munch chime when tossing a snack to a wild animal! */
export function playSnackTossSfx() {
  playTone({ freq: 420, endFreq: 760, duration: 0.1, type: "triangle", volume: 0.05 });
  setTimeout(() => {
    playTone({ freq: 880, endFreq: 1174.66, duration: 0.11, type: "sine", volume: 0.055 });
  }, 140);
}

/** Species-specific delighted munch & happy reaction SFX when Liam feeds a wild animal! */
export function playAnimalFeedSfx(kind = "turkey") {
  // Initial snack-toss arc whoosh
  playTone({ freq: 400, endFreq: 780, duration: 0.09, type: "triangle", volume: 0.048 });
  if (kind === "turkey") {
    // Happy warm gobble-munch + grateful sparkle chord!
    [130, 195, 260].forEach((d, idx) => {
      setTimeout(() => {
        playTone({ freq: 420 + idx * 95, endFreq: 520 + idx * 105, duration: 0.06, type: "triangle", volume: 0.05 });
      }, d);
    });
    setTimeout(() => playTone({ freq: 1046.5, duration: 0.14, type: "sine", volume: 0.05 }), 340);
  } else if (kind === "squirrel") {
    // Rapid crunchy acorn-nibbling chitter!
    [120, 165, 210, 255].forEach((d, idx) => {
      setTimeout(() => {
        zzfx(0.05, 0.08, 920 + idx * 140, 0.002, 0.008, 0.03, 1, 1, 1.4, 0.25);
      }, d);
    });
    setTimeout(() => playTone({ freq: 1318.5, duration: 0.12, type: "sine", volume: 0.045 }), 320);
  } else if (kind === "cat") {
    // Sweet ascending delighted purr-trill ("mrrr-ow! ♥")
    setTimeout(() => {
      playTone({ freq: 560, endFreq: 860, duration: 0.12, type: "sine", volume: 0.052 });
    }, 125);
    setTimeout(() => {
      playTone({ freq: 880, endFreq: 1120, duration: 0.15, type: "triangle", volume: 0.05 });
    }, 240);
  } else if (kind === "dog") {
    // Happy bouncy double-yip + cheerful tail-wag ding!
    [120, 220].forEach((d, idx) => {
      setTimeout(() => {
        playTone({ freq: idx === 0 ? 520 : 660, endFreq: idx === 0 ? 740 : 940, duration: 0.07, type: "triangle", volume: 0.052 });
      }, d);
    });
    setTimeout(() => playTone({ freq: 1046.5, duration: 0.14, type: "sine", volume: 0.05 }), 320);
  } else {
    playSnackTossSfx();
  }
}

/** Obnoxious marathon-bro runner SFX: sharp GPS watch split-beep + loud "HUFF-PUFF! ON YOUR LEFT!" whistle-chirp! */
export function playAnnoyingJoggerSfx(jostled = false) {
  // Annoying high-pitched Garmin/Strava split-lap double-beep!
  playTone({ freq: 2217.46, duration: 0.045, type: "square", volume: 0.036 });
  setTimeout(() => {
    playTone({ freq: 2637.02, duration: 0.055, type: "square", volume: 0.038 });
  }, 60);
  // Dramatic loud athletic huff-shout / jostle thump!
  setTimeout(() => {
    zzfx(jostled ? 0.08 : 0.055, 0.06, jostled ? 310 : 390, 0.004, 0.025, 0.09, 2, 1.2, jostled ? -1.8 : 1.5, 0.3);
  }, 115);
}

/** Classic wooden treasure-chest lid creak + bright loot chime */
export function playChestOpenSfx() {
  zzfx(0.06, 0.05, 190, 0.01, 0.04, 0.1, 2, 1.1, 2.2, 0.25);
  [110, 185, 260].forEach((d, idx) => {
    setTimeout(() => {
      playTone({ freq: [659.25, 880.0, 1318.51][idx], duration: idx === 2 ? 0.2 : 0.08, type: "triangle", volume: 0.055 });
    }, d);
  });
}

/** Crisp parchment paper fold/unfold rustle when toggling the Folded Paper Map */
export function playMapToggleSfx(opening = true) {
  zzfx(0.055, 0.08, opening ? 520 : 380, 0.004, 0.015, 0.075, 3, 1.0, opening ? 2.4 : -2.2, 0.78);
  playTone({
    freq: opening ? 440 : 587.33,
    endFreq: opening ? 659.25 : 392.0,
    duration: 0.07,
    type: "triangle",
    volume: 0.03,
  });
}

/** Playful wet-paintbrush swish + bright color sparkle when repainting a neighborhood house */
export function playPaintHouseSfx() {
  zzfx(0.065, 0.07, 460, 0.005, 0.02, 0.09, 3, 1.0, 3.0, 0.65);
  [70, 135].forEach((d, idx) => {
    setTimeout(() => {
      playTone({ freq: idx === 0 ? 783.99 : 1174.66, duration: 0.11, type: "sine", volume: 0.048 });
    }, d);
  });
}

/** Distinct outfit-change flair (Link chime, Wetsuit splash, Baseball organ trill, Polo pop!) */
export function playOutfitSwapSfx(outfit = "polo") {
  if (outfit === "link") {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => playTone({ freq: f, duration: 0.09, type: "triangle", volume: 0.052 }), i * 55);
    });
  } else if (outfit === "wetsuit") {
    playWaterSplash(true);
    setTimeout(() => playTone({ freq: 880, endFreq: 1318.5, duration: 0.12, type: "sine", volume: 0.045 }), 70);
  } else if (outfit === "baseball") {
    [523.25, 659.25, 783.99, 659.25, 783.99].forEach((f, i) => {
      setTimeout(() => playTone({ freq: f, duration: i === 4 ? 0.16 : 0.065, type: "square", volume: 0.036 }), i * 62);
    });
  } else {
    playTone({ freq: 587.33, endFreq: 880.0, duration: 0.09, type: "triangle", volume: 0.045 });
  }
}

/** Distinct navigation-mode switch sound (Compass click / GPS radar ping / Hard-mode brass horn) */
export function playNavModeSwitchSfx(mode = "signs") {
  if (mode === "hard") {
    playTone({ freq: 293.66, duration: 0.09, type: "sawtooth", volume: 0.038 });
    setTimeout(() => playTone({ freq: 440.0, duration: 0.18, type: "sawtooth", volume: 0.042 }), 90);
  } else if (mode === "gps") {
    playTone({ freq: 880, endFreq: 1760, duration: 0.11, type: "sine", volume: 0.045 });
    setTimeout(() => playTone({ freq: 1318.5, duration: 0.12, type: "sine", volume: 0.04 }), 105);
  } else {
    playTone({ freq: 659.25, duration: 0.055, type: "triangle", volume: 0.045 });
    setTimeout(() => playTone({ freq: 523.25, duration: 0.08, type: "triangle", volume: 0.045 }), 60);
  }
}

/** Nutty wooden marimba pop when picking up a Lucky Acorn (distinct from metallic coin ding!) */
export function playAcornPickupSfx() {
  playTone({ freq: 523.25, endFreq: 698.46, duration: 0.065, type: "triangle", volume: 0.055 });
  setTimeout(() => {
    playTone({ freq: 880.0, duration: 0.09, type: "sine", volume: 0.045 });
  }, 55);
}

/** Cheerful pretzel-jar snack restock jingle */
export function playSnackRestockSfx() {
  [587.33, 739.99, 880.0, 1174.66].forEach((f, i) => {
    setTimeout(() => playTone({ freq: f, duration: i === 3 ? 0.18 : 0.065, type: "triangle", volume: 0.05 }), i * 55);
  });
}
