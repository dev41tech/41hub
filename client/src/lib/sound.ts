let audio: HTMLAudioElement | null = null;
let primed = false;

export function primeAudio() {
  if (primed) return;
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
        primed = true;
        if (import.meta.env.DEV) console.log("[SoundManager] primeAudio() succeeded");
      }).catch((err) => {
        if (import.meta.env.DEV) console.log("[SoundManager] primeAudio() failed:", err.name);
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) console.log("[SoundManager] primeAudio() exception:", err);
  }
}

export async function playNotify() {
  if (!primed || !audio) {
    if (import.meta.env.DEV) console.log("[SoundManager] playNotify() skipped (not primed)");
    return;
  }
  try {
    audio.volume = 0.6;
    audio.currentTime = 0;
    await audio.play();
    if (import.meta.env.DEV) console.log("[SoundManager] playNotify() played");
  } catch (err) {
    if (import.meta.env.DEV) console.log("[SoundManager] playNotify() error:", err);
  }
}
