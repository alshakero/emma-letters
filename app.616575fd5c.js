const VIDEO_ID = "Ypz3bsr6SZc";
const SONG_END_SECONDS = 239.12;
const START_EARLY_SECONDS = 0.5;
const STOP_EARLY_SECONDS = 0.5;
const SPARKLE_COLORS = ["#ffffff", "#ffed6b", "#31d0aa", "#20a4f3", "#ff4fa3"];

// Derived from the supplied YouTube timedtext. The captions are auto-generated,
// so a few ASR words are odd, but these are the A-Z introduction timestamps.
const LETTER_STARTS = [
  ["a", 9.2],
  ["b", 17.16],
  ["c", 25.6],
  ["d", 33.079],
  ["e", 41.12],
  ["f", 53.16],
  ["g", 61.039],
  ["h", 69.24],
  ["i", 77.24],
  ["j", 85.119],
  ["k", 97.159],
  ["l", 105.079],
  ["m", 113.159],
  ["n", 121.2],
  ["o", 129.16],
  ["p", 141.16],
  ["q", 149.08],
  ["r", 157.08],
  ["s", 165.159],
  ["t", 173.12],
  ["u", 189.12],
  ["v", 197.12],
  ["w", 205.159],
  ["x", 213.159],
  ["y", 221.2],
  ["z", 229.04],
];

const LETTER_SEGMENTS = LETTER_STARTS.map(([key, start], index) => {
  const next = LETTER_STARTS[index + 1];
  return {
    key,
    label: key.toUpperCase(),
    start,
    end: next ? next[1] : SONG_END_SECONDS,
  };
});

const SEGMENTS_BY_KEY = new Map(LETTER_SEGMENTS.map((segment) => [segment.key, segment]));
const nowKey = document.querySelector("#now-key");
const nowCaption = document.querySelector("#now-caption");
const playerStatus = document.querySelector("#player-status");
const stage = document.querySelector(".stage");
const videoFrame = document.querySelector(".video-frame");

let player = null;
let playerReady = false;
let queuedSegment = null;
let activeToken = 0;
let stopInterval = 0;

init();

function init() {
  document.body.tabIndex = -1;
  focusPage();
  document.addEventListener("keydown", handleKeyDown);
  loadYouTubeApi();
}

function handleKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const key = resolveLetterKey(event);
  if (!key) {
    return;
  }

  event.preventDefault();
  playLetter(SEGMENTS_BY_KEY.get(key));
}

function resolveLetterKey(event) {
  const typedKey = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (SEGMENTS_BY_KEY.has(typedKey)) {
    return typedKey;
  }

  const codeMatch = /^Key([A-Z])$/.exec(event.code || "");
  if (codeMatch) {
    return codeMatch[1].toLowerCase();
  }

  return null;
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) {
    createPlayer();
    return;
  }

  window.onYouTubeIframeAPIReady = createPlayer;

  const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  if (existingScript) {
    return;
  }

  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.async = true;
  script.onerror = () => {
    stage.classList.add("has-error");
    playerStatus.textContent = "The alphabet video could not load on this TV.";
    nowKey.textContent = "Oops";
    nowCaption.textContent = "YouTube is unavailable here, so Emma cannot play the song yet.";
  };
  document.head.append(script);
}

function createPlayer() {
  player = new window.YT.Player("youtube-player", {
    videoId: VIDEO_ID,
    playerVars: {
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError,
      onAutoplayBlocked: handleAutoplayBlocked,
    },
  });
}

function handlePlayerReady(event) {
  player = event.target;
  playerReady = true;
  stage.classList.add("is-ready");
  playerStatus.textContent = "Alphabet song ready";
  nowKey.textContent = "A-Z";
  nowCaption.textContent = "Emma, press a letter on your keyboard.";

  const iframe = player.getIframe();
  iframe.title = "Alphabet song for kids";
  iframe.tabIndex = -1;

  player.cueVideoById({
    videoId: VIDEO_ID,
    startSeconds: 0,
  });

  if (queuedSegment) {
    const segment = queuedSegment;
    queuedSegment = null;
    playLetter(segment);
  }
}

function handlePlayerStateChange(event) {
  if (!window.YT || !window.YT.PlayerState) {
    return;
  }

  if (event.data === window.YT.PlayerState.PLAYING) {
    stage.classList.add("is-playing");
    return;
  }

  if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
    stage.classList.remove("is-playing");
  }
}

function handlePlayerError() {
  clearStopTimer();
  stage.classList.remove("is-playing");
  stage.classList.add("has-error");
  playerStatus.textContent = "The alphabet video could not play on this TV.";
  nowKey.textContent = "Oops";
  nowCaption.textContent = "No fallback sounds are enabled, so try reloading the page.";
}

function handleAutoplayBlocked() {
  clearStopTimer();
  stage.classList.remove("is-playing");
  playerStatus.textContent = "Press the letter again to start the video.";
  nowCaption.textContent = "The TV blocked the first play attempt, but the song is ready.";
}

function playLetter(segment) {
  const token = activeToken + 1;
  activeToken = token;
  queuedSegment = null;
  clearStopTimer();
  updateNowPlaying(segment);
  throwSparkles(stage);
  focusPage();

  if (!playerReady) {
    queuedSegment = segment;
    playerStatus.textContent = "Loading alphabet song…";
    nowCaption.textContent = `Getting ${segment.label} ready for Emma.`;
    return;
  }

  try {
    player.seekTo(getStartTime(segment), true);
    player.playVideo();
    scheduleStop(segment, token);
  } catch {
    stage.classList.add("has-error");
    nowKey.textContent = "Oops";
    nowCaption.textContent = "The YouTube player is not ready yet. Press the letter again.";
  }
}

function updateNowPlaying(segment) {
  nowKey.textContent = segment.label;
  nowCaption.textContent = `Emma picked ${segment.label}.`;
  playerStatus.textContent = `Playing ${formatTime(getStartTime(segment))} – ${formatTime(segment.end)}`;
  stage.classList.add("is-playing");
  stage.classList.remove("has-error");
  videoFrame.style.setProperty("--letter-color", getLetterColor(segment.key));
}

function getStartTime(segment) {
  return Math.max(0, segment.start - START_EARLY_SECONDS);
}

function scheduleStop(segment, token) {
  const stopAt = Math.max(segment.start + 0.5, segment.end - STOP_EARLY_SECONDS);

  stopInterval = window.setInterval(() => {
    if (token !== activeToken || !playerReady || !player) {
      clearStopTimer();
      return;
    }

    const currentTime = player.getCurrentTime();
    if (currentTime >= stopAt) {
      player.pauseVideo();
      clearStopTimer();
      stage.classList.remove("is-playing");
      playerStatus.textContent = `${segment.label} finished`;
    }
  }, 80);
}

function clearStopTimer() {
  if (stopInterval) {
    window.clearInterval(stopInterval);
    stopInterval = 0;
  }
}

function focusPage() {
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }

  try {
    document.body.focus({ preventScroll: true });
  } catch {
    document.body.focus();
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getLetterColor(key) {
  const index = key.charCodeAt(0) - "a".charCodeAt(0);
  return SPARKLE_COLORS[index % SPARKLE_COLORS.length];
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
