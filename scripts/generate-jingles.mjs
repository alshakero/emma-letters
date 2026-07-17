import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const outputDir = resolve(root, "src/assets/jingles");
const env = {
  ...process.env,
  ...loadDotEnv(resolve(root, ".env")),
};

const apiKey = env.ELEVENLABS_API_KEY;
const mode = (env.ELEVENLABS_JINGLE_MODE || "music").toLowerCase();
const force = parseBoolean(env.FORCE_REGENERATE);
const keys = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

if (!apiKey) {
  throw new Error("Missing ELEVENLABS_API_KEY. Copy .env.example to .env and add your key.");
}

if (!["music", "speech", "sound"].includes(mode)) {
  throw new Error(`Unsupported ELEVENLABS_JINGLE_MODE "${mode}". Use music, speech, or sound.`);
}

await mkdir(outputDir, { recursive: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  mode,
  items: {},
};

for (const key of keys) {
  const label = displayKey(key);
  const filename = `${key}.mp3`;
  const outputPath = resolve(outputDir, filename);

  if (!force && existsSync(outputPath)) {
    console.log(`Skipping ${label}; ${filename} already exists.`);
    manifest.items[key] = manifestEntry(key, filename);
    continue;
  }

  console.log(`Generating ${label} with ElevenLabs ${mode} mode...`);
  const audio = await generateAudio({ key, label, mode, env, apiKey });
  await writeFile(outputPath, audio);
  manifest.items[key] = manifestEntry(key, filename);
}

await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${Object.keys(manifest.items).length} jingles in ${outputDir}`);

async function generateAudio({ key, label, mode, env, apiKey }) {
  if (mode === "music") {
    return generateMusicJingle({ key, label, env, apiKey });
  }

  if (mode === "sound") {
    return generateSoundJingle({ key, label, env, apiKey });
  }

  return generateSpeechJingle({ label, env, apiKey });
}

async function generateMusicJingle({ key, label, env, apiKey }) {
  const endpoint = "https://api.elevenlabs.io/v1/music/stream";
  const body = {
    prompt: [
      "A bright, playful kids TV educational jingle.",
      `A friendly singer clearly says exactly: "This is ${label}".`,
      label.length === 1 && /[A-Z]/.test(label)
        ? `Make the letter ${label} feel magical and easy for preschool children to remember.`
        : `Make the number ${label} feel exciting and easy for preschool children to remember.`,
      "After the words, add a short cheerful xylophone-and-clap musical sparkle.",
      "No copyrighted melodies, no brand names, no extra lyrics, no scary sounds.",
    ].join(" "),
    music_length_ms: numberFromEnv(env.ELEVENLABS_MUSIC_LENGTH_MS, 4000),
    model_id: env.ELEVENLABS_MUSIC_MODEL_ID || "music_v2",
    force_instrumental: false,
  };

  return postAudio(endpoint, apiKey, body);
}

async function generateSoundJingle({ key, label, env, apiKey }) {
  const endpoint = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";
  const body = {
    text: [
      "Short colorful kids TV button jingle.",
      `A happy voice says "This is ${label}" once, then a bright xylophone sparkle and soft clap.`,
      key >= "0" && key <= "9" ? "Number-learning game sound." : "Alphabet-learning game sound.",
      "Clean, friendly, under four seconds.",
    ].join(" "),
    duration_seconds: numberFromEnv(env.ELEVENLABS_SOUND_DURATION_SECONDS, 4),
    prompt_influence: numberFromEnv(env.ELEVENLABS_SOUND_PROMPT_INFLUENCE, 0.45),
    model_id: env.ELEVENLABS_SOUND_MODEL_ID || "eleven_text_to_sound_v2",
  };

  return postAudio(endpoint, apiKey, body);
}

async function generateSpeechJingle({ label, env, apiKey }) {
  const voiceId = env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voiceId,
  )}?output_format=mp3_44100_128`;
  const body = {
    text: `This is ${label}!`,
    model_id: env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2",
    voice_settings: {
      stability: numberFromEnv(env.ELEVENLABS_VOICE_STABILITY, 0.5),
      similarity_boost: numberFromEnv(env.ELEVENLABS_VOICE_SIMILARITY_BOOST, 0.8),
      style: numberFromEnv(env.ELEVENLABS_VOICE_STYLE, 0.35),
      use_speaker_boost: true,
    },
  };

  return postAudio(endpoint, apiKey, body);
}

async function postAudio(endpoint, apiKey, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status} ${response.statusText}): ${detail}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function manifestEntry(key, filename) {
  const label = displayKey(key);
  return {
    label,
    src: `assets/jingles/${filename}`,
    caption: `This is ${label}!`,
  };
}

function displayKey(key) {
  return /[a-z]/.test(key) ? key.toUpperCase() : key;
}

function parseBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadDotEnv(path) {
  if (!existsSync(path)) {
    return {};
  }

  const text = readFileSyncSafe(path);
  const values = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function readFileSyncSafe(path) {
  try {
    return String(readFileSync(path));
  } catch (error) {
    throw new Error(`Unable to read ${basename(path)}: ${error.message}`);
  }
}
