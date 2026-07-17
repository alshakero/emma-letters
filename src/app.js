const KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
const DISPLAY = Object.fromEntries(
  KEYS.map((key) => [key, /[a-z]/.test(key) ? key.toUpperCase() : key]),
);
const SPARKLE_COLORS = ["#ffffff", "#ffed6b", "#31d0aa", "#20a4f3", "#ff4fa3"];

const grid = document.querySelector("#button-grid");
const nowKey = document.querySelector("#now-key");
const nowCaption = document.querySelector("#now-caption");
const stage = document.querySelector(".stage");
const muteButton = document.querySelector("#mute-button");

let manifest = {};
let currentAudio = null;
let muted = false;
let fallbackAudioContext = null;

init();

async function init() {
  renderButtons();
  manifest = await loadManifest();

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (KEYS.includes(key)) {
      event.preventDefault();
      void playJingle(key);
    }
  });

  muteButton.addEventListener("click", () => {
    muted = !muted;
    muteButton.textContent = muted ? "Sound off" : "Sound on";
    muteButton.setAttribute("aria-pressed", String(muted));
    if (muted && currentAudio) {
      currentAudio.pause();
    }
  });
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
    return data.items || {};
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

  if (muted) {
    window.setTimeout(() => stage.classList.remove("is-playing"), 520);
    return;
  }

  stopCurrentAudio();

  const audioPath = manifest[key]?.src || `assets/jingles/${key}.mp3`;
  let handledAudioError = false;
  const useFallback = async () => {
    if (handledAudioError) {
      return;
    }
    handledAudioError = true;
    stage.classList.remove("is-playing");
    await playFallbackJingle(label);
  };

  try {
    currentAudio = new Audio(audioPath);
    currentAudio.preload = "auto";
    currentAudio.addEventListener("ended", () => stage.classList.remove("is-playing"), { once: true });
    currentAudio.addEventListener("error", () => void useFallback(), { once: true });
    await currentAudio.play();
  } catch (error) {
    console.info(`Falling back for ${label}; generated MP3 not playable yet.`, error);
    await useFallback();
  }
}

function stopCurrentAudio() {
  if (!currentAudio) {
    return;
  }

  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
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

async function playFallbackJingle(label) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`This is ${label}!`);
    utterance.rate = 0.9;
    utterance.pitch = 1.35;
    window.speechSynthesis.speak(utterance);
  }

  await playFallbackNotes();
}

async function playFallbackNotes() {
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
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((frequency, index) => {
    const oscillator = fallbackAudioContext.createOscillator();
    const gain = fallbackAudioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now + index * 0.1);
    gain.gain.setValueAtTime(0, now + index * 0.1);
    gain.gain.linearRampToValueAtTime(0.12, now + index * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.34);
    oscillator.connect(gain).connect(fallbackAudioContext.destination);
    oscillator.start(now + index * 0.1);
    oscillator.stop(now + index * 0.1 + 0.35);
  });
}

function describeKey(key) {
  return /[a-z]/.test(key) ? `letter ${key.toUpperCase()}` : `number ${key}`;
}
