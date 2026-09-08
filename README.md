# Sori — Korean speaking practice

Use Node.js 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by the server. Microphone recording requires localhost or HTTPS. Allow microphone access, then hold the record button (mouse/touch) or Space and release to upload. If the permission dialog interrupts the first hold, hold again after allowing access. Recordings stop at 60 seconds, when the window loses focus, or when the tab is hidden. Audio playback is available after recording.

## Word lists

Replace `public/words.json` for the default list, or use **Import words** to load JSON/CSV without changing the server. Examples are in `public/words.json` and `public/words.csv`.

JSON accepts an array of `{ "id": "1", "korean": "안녕하세요", "meaning": "Hello" }` or an array of strings. CSV uses `korean` with optional `id` and `meaning` columns. The importer supports quoted fields, commas, and UTF-8 BOMs.

## STT integration

`POST /api/stt` receives multipart fields `audio` (File), `word`, and `wordId`. The server validates uploads (10 MB limit) and returns HTTP 202 with `{ status: "received", transcript: null, wordId, bytes }`. Implement your STT provider in `app/api/stt/route.ts` at the TODO. No recognition is performed and audio is not stored. Keep future provider credentials on the server.

```sh
npm run build
npm run lint
npx tsc --noEmit
```

The result panel displays the original Korean word alongside `transcript` from the API. Return a string to display recognized speech, an empty string for no speech detected, or `null` while STT is unimplemented. No sample transcription is fabricated.
