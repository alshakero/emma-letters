# Emma Letters

A colorful, TV-friendly kids game for GitHub Pages. Press any key from `A-Z` or `0-9`, or select an on-screen tile, and the page plays that character’s jingle.

## Generate ElevenLabs jingles

1. Copy `.env.example` to `.env`.
2. Add your ElevenLabs API key.
3. Run:

```bash
npm run generate:jingles
npm run build
```

The generator writes MP3 files into `src/assets/jingles/` and a manifest at `src/assets/jingles/manifest.json`. The deployed site only serves static files; it never exposes your ElevenLabs key in browser code.

By default, generation uses the Eleven Music API for short, musical jingles. If your ElevenLabs account does not have Music API access, set this in `.env`:

```bash
ELEVENLABS_JINGLE_MODE=speech
```

That mode uses text-to-speech instead, which is less musical but keeps the letter/number wording exact.

## Run locally

```bash
npm run build
npm run serve
```

Then open the printed local URL.

## Deploy to GitHub Pages

This project deploys with the `gh-pages` npm package.

Generate the jingles locally first so your ElevenLabs key stays in `.env` and never reaches the browser:

```bash
npm run generate:jingles
npm run deploy
```

`npm run deploy` builds the static site and publishes `dist/` to the `gh-pages` branch.

In GitHub, set Pages to deploy from the `gh-pages` branch, root folder.
