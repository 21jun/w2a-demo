# Wake2Adapt — Voice practice

Use Node.js 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by the server. First choose a greeting (안녕 or Hello), record it, then continue to word practice. You can listen back or re-record before continuing. Microphone recording requires localhost or HTTPS. Allow microphone access, then hold the record button (mouse/touch) or Space and release to upload. If the permission dialog interrupts the first hold, hold again after allowing access. Recordings stop at 60 seconds, when the window loses focus, or when the tab is hidden. Audio playback is available after recording.

## Word lists

Replace `public/words.json` for the default list, or use **Import words** to load JSON/CSV without changing the server. Examples are in `public/words.json` and `public/words.csv`.

JSON accepts an array of `{ "id": "1", "korean": "안녕하세요", "meaning": "Hello" }` or an array of strings. CSV uses `korean` with optional `id` and `meaning` columns. The importer supports quoted fields, commas, and UTF-8 BOMs.

## STT integration

`POST /api/stt` receives multipart fields `audio` (File), `word`, `wordId`, and `purpose` (`greeting` or `practice`). Greeting uploads are validated and acknowledged. After a successful greeting upload, the browser retains its Blob and text in React memory for the current session. Every practice upload includes `referenceAudio` (File) and `referenceText`. Missing or invalid references are rejected. The combined multipart upload limit is 10 MB.

The greeting is not a continuously listening wake-word detector. Recording remains hold-to-record. The sample is sent with each practice request so a future STT provider can use it for adaptation. The server does not persist audio or train/adapt a model. Reloading or leaving the page clears the sample and starts setup again. “Record a new greeting” discards the old reference and requires a new recording.

Practice responses return HTTP 202 with `{ status: "received", transcript: null, wordId, bytes, referenceReceived: true, adaptationStatus: "not_configured" }`. Implement your provider in `app/api/stt/route.ts` at the TODO. A provider must explicitly support reference-audio adaptation; supplying a greeting alone does not implement adaptation. Keep future provider credentials on the server.

```sh
npm run build
npm run lint
npx tsc --noEmit
```

The result panel displays the original Korean word alongside `transcript` from the API. Return a string to display recognized speech, an empty string for no speech detected, or `null` while STT is unimplemented. No sample transcription is fabricated.
