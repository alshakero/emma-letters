const KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
const DISPLAY = Object.fromEntries(
  KEYS.map((key) => [key, /[a-z]/.test(key) ? key.toUpperCase() : key]),
);
const SPARKLE_COLORS = ["#ffffff", "#ffed6b", "#31d0aa", "#20a4f3", "#ff4fa3"];

const nowKey = document.querySelector("#now-key");
const nowCaption = document.querySelector("#now-caption");
const stage = document.querySelector(".stage");

let manifest = {};
let currentAudio = null;
let currentAudioReject = null;
let playbackId = 0;
let fallbackAudioContext = null;
let soundsReady = false;
let soundsReadyPromise = Promise.resolve();
const audioCache = new Map();

init();

async function init() {
  manifest = await loadManifest();
  nowKey.textContent = "Loading…";
  nowCaption.textContent = "Emma’s sounds are getting ready.";
  soundsReadyPromise = cacheAllSounds().then(() => {
    soundsReady = true;
    nowKey.textContent = "Ready?";
    nowCaption.textContent = "Emma, press any letter or number on your keyboard.";
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const key = resolveSupportedKey(event);
    if (key) {
      event.preventDefault();
      void playJingle(key);
    }
  });
}

function resolveSupportedKey(event) {
  const typedKey = event.key?.toLowerCase?.() || "";
  if (KEYS.includes(typedKey)) {
    return typedKey;
  }

  const numpadMatch = /^Numpad([0-9])$/.exec(event.code || "");
  if (numpadMatch) {
    return numpadMatch[1];
  }

  return null;
}

async function cacheAllSounds() {
  const paths = getAudioPaths();
  let cachedCount = 0;
  const failedPaths = [];

  await Promise.all(
    paths.map(async (src) => {
      try {
        await cacheAudio(src);
      } catch (error) {
        failedPaths.push(src);
        console.info(`Unable to preload ${src}; it will be loaded on demand if needed.`, error);
      } finally {
        cachedCount += 1;
        nowCaption.textContent = `Loading Emma’s sounds ${cachedCount}/${paths.length}…`;
      }
    }),
  );

  if (failedPaths.length > 0) {
    console.info(`Finished preloading with ${failedPaths.length} missing sound(s).`, failedPaths);
  }
}

function getAudioPaths() {
  const paths = new Set([manifest.music?.src || "assets/jingles/jingle.mp3"]);

  for (const key of KEYS) {
    paths.add(manifest.items?.[key]?.voiceSrc || `assets/jingles/voice/${key}.mp3`);
  }

  return [...paths];
}

async function cacheAudio(src) {
  if (audioCache.has(src)) {
    return audioCache.get(src);
  }

  const response = await fetch(src, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Audio request failed: ${response.status}`);
  }

  const blob = await response.blob();
  const cachedSrc = URL.createObjectURL(blob);
  audioCache.set(src, cachedSrc);
  return cachedSrc;
}

async function loadManifest() {
  try {
    const response = await fetch("assets/jingles/manifest.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Manifest request failed: ${response.status}`);
    }
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.info("Using default jingle paths until generated assets exist.", error);
    return {};
  }
}

async function playJingle(key) {
  const label = DISPLAY[key];
  const caption = `This is ${label}!`;

  const token = playbackId + 1;
  playbackId = token;
  stopCurrentAudio();

  if (!soundsReady) {
    nowKey.textContent = "Loading…";
    nowCaption.textContent = `Getting ${label} ready.`;
    stage.classList.add("is-playing");
    await soundsReadyPromise;
    if (!isCurrentPlayback(token)) {
      return;
    }
  }

  nowKey.textContent = label;
  nowCaption.textContent = caption;
  stage.classList.add("is-playing");
  throwSparkles(stage);

  const musicPath = manifest.music?.src || "assets/jingles/jingle.mp3";
  const voicePath = manifest.items?.[key]?.voiceSrc || `assets/jingles/voice/${key}.mp3`;

  try {
    await playAudioFile(musicPath, token);
  } catch (error) {
    if (!isCurrentPlayback(token)) {
      return;
    }
    console.info("Using built-in music fallback; shared jingle file is not playable yet.", error);
    await playFallbackMusic();
  }

  if (!isCurrentPlayback(token)) {
    return;
  }

  try {
    await playAudioFile(voicePath, token);
  } catch (error) {
    if (!isCurrentPlayback(token)) {
      return;
    }
    console.info(`Using speech fallback for ${label}; generated voice line is not playable yet.`, error);
    await speakLabel(label);
  }

  if (isCurrentPlayback(token)) {
    stage.classList.remove("is-playing");
  }
}

function stopCurrentAudio() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (!currentAudio) {
    return;
  }

  const reject = currentAudioReject;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
  currentAudioReject = null;
  reject?.(new Error("Playback was stopped."));
}

function playAudioFile(src, token) {
  return new Promise((resolve, reject) => {
    if (!isCurrentPlayback(token)) {
      reject(new Error("Playback was replaced."));
      return;
    }

    const audio = new Audio(audioCache.get(src) || src);
    currentAudio = audio;
    currentAudioReject = reject;
    audio.preload = "auto";
    audio.addEventListener(
      "ended",
      () => {
        if (currentAudio === audio) {
          currentAudio = null;
          currentAudioReject = null;
        }
        resolve();
      },
      { once: true },
    );
    audio.addEventListener(
      "error",
      () => {
        if (currentAudio === audio) {
          currentAudio = null;
          currentAudioReject = null;
        }
        reject(new Error(`Unable to play ${src}`));
      },
      { once: true },
    );
    audio.play().catch((error) => {
      if (currentAudio === audio) {
        currentAudio = null;
        currentAudioReject = null;
      }
      reject(error);
    });
  });
}

function isCurrentPlayback(token) {
  return token === playbackId;
}

function throwSparkles(anchor) {
  const rect = anchor.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let index = 0; index < 12; index += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.style.left = `${centerX}px`;
    sparkle.style.top = `${centerY}px`;
    sparkle.style.setProperty("--sparkle-color", SPARKLE_COLORS[index % SPARKLE_COLORS.length]);
    sparkle.style.setProperty("--sparkle-x", `${Math.cos(index) * (80 + index * 7)}px`);
    sparkle.style.setProperty("--sparkle-y", `${Math.sin(index) * (70 + index * 6)}px`);
    document.body.append(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove(), { once: true });
  }
}

async function playFallbackMusic() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  if (!fallbackAudioContext) {
    fallbackAudioContext = new AudioContext();
  }
  if (fallbackAudioContext.state === "suspended") {
    await fallbackAudioContext.resume();
  }

  const now = fallbackAudioContext.currentTime;
  const notes = [
    { frequency: 523.25, start: 0, duration: 0.26 },
    { frequency: 659.25, start: 0.18, duration: 0.28 },
    { frequency: 783.99, start: 0.36, duration: 0.3 },
    { frequency: 1046.5, start: 0.56, duration: 0.3 },
    { frequency: 1318.51, start: 0.74, duration: 0.22 },
  ];
  notes.forEach(({ frequency, start, duration }) => {
    const oscillator = fallbackAudioContext.createOscillator();
    const gain = fallbackAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + start);
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.12, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    oscillator.connect(gain).connect(fallbackAudioContext.destination);
    oscillator.start(now + start);
    oscillator.stop(now + start + duration);
  });

  await new Promise((resolve) => window.setTimeout(resolve, 1000));
}

function speakLabel(label) {
  if (!("speechSynthesis" in window)) {
    return Promise.resolve();
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`This is ${label}.`);
  utterance.rate = 0.92;
  utterance.pitch = 1.12;
  utterance.voice = chooseFallbackVoice();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 1800);
    utterance.addEventListener(
      "end",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    utterance.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    window.speechSynthesis.speak(utterance);
  });
}

function chooseFallbackVoice() {
  const voices = window.speechSynthesis.getVoices?.() || [];
  return (
    voices.find((voice) => /female|woman|samantha|victoria|zira|google uk english female/i.test(voice.name)) ||
    voices.find((voice) => /^en[-_]/i.test(voice.lang)) ||
    null
  );
}
