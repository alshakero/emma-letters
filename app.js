const KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
const DISPLAY = Object.fromEntries(
  KEYS.map((key) => [key, /[a-z]/.test(key) ? key.toUpperCase() : key]),
);
const SPARKLE_COLORS = ["#ffffff", "#ffed6b", "#31d0aa", "#20a4f3", "#ff4fa3"];

const grid = document.querySelector("#button-grid");
const nowKey = document.querySelector("#now-key");
const nowCaption = document.querySelector("#now-caption");
const stage = document.querySelector(".stage");

let manifest = {};
let currentAudio = null;
let currentAudioReject = null;
let playbackId = 0;
let fallbackAudioContext = null;

init();

async function init() {
  renderButtons();
  manifest = await loadManifest();

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

function renderButtons() {
  const fragment = document.createDocumentFragment();

  for (const key of KEYS) {
    const button = document.createElement("button");
    button.className = "letter-button";
    button.type = "button";
    button.dataset.key = key;
    button.textContent = DISPLAY[key];
    button.setAttribute("aria-label", `Play ${describeKey(key)} jingle`);
    button.addEventListener("click", () => void playJingle(key));
    fragment.append(button);
  }

  grid.append(fragment);
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
  const button = document.querySelector(`[data-key="${key}"]`);
  const caption = `This is ${label}!`;

  nowKey.textContent = label;
  nowCaption.textContent = caption;
  stage.classList.add("is-playing");
  pulseButton(button);
  throwSparkles(button || stage);

  const token = playbackId + 1;
  playbackId = token;
  stopCurrentAudio();

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

    const audio = new Audio(src);
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

function pulseButton(button) {
  if (!button) {
    return;
  }

  button.classList.add("is-active");
  window.setTimeout(() => button.classList.remove("is-active"), 220);
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

function describeKey(key) {
  return /[a-z]/.test(key) ? `letter ${key.toUpperCase()}` : `number ${key}`;
}
