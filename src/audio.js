/**
 * Lightweight Web Audio API retro sound engine (Phase 1 foundation for Phase 2 ZzFX).
 * Zero external audio file dependencies.
 */

let audioCtx = null;

function ensureContext() {
  if (typeof window === "undefined") return null;
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

export function playStreetBannerChime() {
  playTone({ freq: 659.25, duration: 0.09, type: "sine", volume: 0.05 }); // E5
  setTimeout(() => {
    playTone({ freq: 987.77, duration: 0.14, type: "sine", volume: 0.05 }); // B5
  }, 70);
}

export function playLookBothWaysChime(earnedXP = false) {
  // Left-look chirp -> Right-look chirp -> optional cheerful safety ding
  playTone({ freq: 523.25, duration: 0.07, type: "triangle", volume: 0.05 }); // C5
  setTimeout(() => {
    playTone({ freq: 659.25, duration: 0.07, type: "triangle", volume: 0.05 }); // E5
  }, 220);
  if (earnedXP) {
    setTimeout(() => {
      playTone({ freq: 1046.5, duration: 0.14, type: "sine", volume: 0.06 }); // C6
    }, 440);
  }
}

export function playStepTick(isGrass = false, isFast = false) {
  playTone({
    freq: (isGrass ? 110 : 170) * (isFast ? 1.25 : 1),
    endFreq: isGrass ? 80 : 120,
    duration: isFast ? 0.02 : 0.025,
    type: "triangle",
    volume: isFast ? 0.032 : 0.025,
  });
}
