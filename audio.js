/*
 * Complete Audio & Typewriter Sound Engine matching https://block.youtest.me/
 */
(function () {
  const ROOT_BASE = location.protocol === "file:"
    ? new URL("./", document.currentScript?.src || document.baseURI).href
    : "/";
  const AUDIO_BASE = `${ROOT_BASE}assets/original/audio/`;

  const SOUND_FILES = [
    "aaapo", "bounce", "complete-bg", "dun-dun", "huh",
    "pop", "pop1", "result-high", "result-low", "result-medium",
    "scorePop", "swipe", "umm", "walk", "whoosh"
  ];

  const activeInstances = new Set();
  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try {
          audioCtx = new Ctx();
        } catch {}
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function unlockAudio() {
    ensureAudioContext();
  }

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });

  function play(name, options = {}) {
    if (!SOUND_FILES.includes(name)) return null;
    try {
      const audio = new Audio(`${AUDIO_BASE}${name}.mp3`);
      if (typeof options.volume === "number") audio.volume = Math.max(0, Math.min(1, options.volume));
      if (typeof options.playbackRate === "number") audio.playbackRate = options.playbackRate;
      if (options.loop) audio.loop = true;
      activeInstances.add(audio);
      const cleanup = () => activeInstances.delete(audio);
      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      const promise = audio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => cleanup());
      }
      return audio;
    } catch {
      return null;
    }
  }

  function stop(audio) {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
    activeInstances.delete(audio);
  }

  function stopAll() {
    activeInstances.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    activeInstances.clear();
  }

  function playTypeTick() {
    const ctx = ensureAudioContext();
    if (!ctx || ctx.state !== "running") return;
    try {
      const duration = 0.024;
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        const env = Math.pow(1 - i / length, 2.2);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1750 + Math.random() * 450;
      filter.Q.value = 3.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.055, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch {}
  }

  window.dbmAudio = {
    play,
    stop,
    stopAll,
    playTypeTick,
    unlockAudio
  };
})();
