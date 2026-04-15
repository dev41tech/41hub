let audio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let primed = false;
let mp3Failed = false;

export function primeAudio() {
  if (primed) return;
  primed = true;

  // Initialize AudioContext for WebAudio fallback (unlocked by user gesture)
  try {
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      audioCtx = new AC() as AudioContext;
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    }
  } catch (_) {}

  // Try to prime MP3 at volume 0 (browser autoplay unlock)
  try {
    audio = new Audio("/notify.mp3");
    audio.preload = "auto";
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0.6;
        }
        if (import.meta.env.DEV) console.log("[Sound] primeAudio MP3 ok");
      }).catch((err) => {
        mp3Failed = true;
        if (import.meta.env.DEV)
          console.log("[Sound] primeAudio MP3 failed, WebAudio fallback active:", err.name);
      });
    }
  } catch (err) {
    mp3Failed = true;
    if (import.meta.env.DEV) console.log("[Sound] primeAudio MP3 exception:", err);
  }
}

function playWebAudioBeep() {
  try {
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!audioCtx && AC) audioCtx = new AC() as AudioContext;
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
    if (import.meta.env.DEV) console.log("[Sound] WebAudio beep played");
  } catch (err) {
    if (import.meta.env.DEV) console.log("[Sound] WebAudio beep failed:", err);
  }
}

export async function playNotify() {
  if (!primed) {
    if (import.meta.env.DEV) console.log("[Sound] playNotify skipped (not primed)");
    return;
  }

  // Try MP3 first
  if (audio && !mp3Failed) {
    try {
      audio.volume = 0.6;
      audio.currentTime = 0;
      await audio.play();
      if (import.meta.env.DEV) console.log("[Sound] MP3 played");
      return;
    } catch (err) {
      mp3Failed = true;
      if (import.meta.env.DEV)
        console.log("[Sound] MP3 playback failed, switching to WebAudio:", err);
    }
  }

  // WebAudio oscillator fallback (~120ms beep)
  playWebAudioBeep();
}
