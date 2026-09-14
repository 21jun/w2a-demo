# Wake2Adapt — Voice practice

Use Node.js 22.13+ (Node 24 recommended).

```sh
nvm use
npm ci
npm run dev
```

Open the local URL printed by the server. First choose a greeting (안녕 or Hello), record it, then continue to word practice. You can listen back or re-record before continuing. Microphone recording requires localhost or HTTPS. Allow microphone access, then hold the record button (mouse/touch) or Space and release to upload. If the permission dialog interrupts the first hold, hold again after allowing access. Recordings stop at 60 seconds, when the window loses focus, or when the tab is hidden. Audio playback is available after recording.

## Word lists

The default practice list loads directly from `data/roads_P001.jsonl`, using each row’s `text` as the practice word in file order. Edit this file to change the default list (rebuild for production). Empty `audioBase64` values are allowed for word lists; they do not set a voice reference. Set up your reference by recording or uploading audio as before.

Use **Import words** to load JSON/JSONL/CSV for the current session. JSONL has one object per line, using `text` or `korean`, with optional `id` and `meaning`. Examples of the older formats remain in `public/words.json` and `public/words.csv`.

JSON accepts an array of `{ "id": "1", "korean": "안녕하세요", "meaning": "Hello" }` or an array of strings. CSV uses `korean` with optional `id` and `meaning` columns. The importer supports quoted fields, commas, and UTF-8 BOMs.

## Recording JSON uploads

Both setup and word practice accept a JSON file through **Upload reference JSON** / **Upload recording JSON**, as an alternative to microphone recording. Open **JSON 포맷 안내** on either screen for the schema.

Reference JSON (one UTF-8 object):

```json
{
  "mimeType": "audio/wav",
  "audioBase64": "<Base64 of the entire audio file>",
  "text": "안녕"
}
```

Practice JSON uses the same `mimeType` and `audioBase64` fields; omit `text`. It is attached to the currently displayed word and automatically sent with the saved reference. Reference `text` must match the spoken audio and contain 1–200 characters; it can be a greeting other than the preset choices.

Replace the placeholder with standard Base64, including padding where needed, without a `data:` prefix, whitespace, or line breaks. Supported MIME values: `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`, `audio/mpeg` (MP3). The MIME type must match the encoded audio file. Each JSON file is limited to 14 MiB; decoded audio is limited to 9 MiB total for the reference plus current recording, leaving room for multipart metadata within the API's 10 MiB request limit. The importer validates the JSON fields and Base64; playback depends on the browser's audio codec support.

For example, create reference JSON from a WAV file using Python:

```sh
python3 - <<'PYTHON'
import base64, json
from pathlib import Path
payload = {
    "mimeType": "audio/wav",
    "audioBase64": base64.b64encode(Path("reference.wav").read_bytes()).decode("ascii"),
    "text": "안녕",
}
Path("reference.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
PYTHON
```

For a practice file, change the input/output filenames and omit `text`. Upload the reference first, then select **Start practice**. Imported audio supports the same playback and session-only reference handling as microphone recordings. The browser decodes the JSON into an audio Blob and submits the existing multipart API request; the API does not directly accept JSON bodies.

## STT integration

`POST /api/stt` receives multipart fields `audio` (File), `word`, `wordId`, and `purpose` (`greeting` or `practice`). Greeting uploads are validated and acknowledged. After a successful greeting upload, the browser retains its Blob and text in React memory for the current session. Every practice upload includes `referenceAudio` (File) and `referenceText`. Missing or invalid references are rejected. The combined multipart upload limit is 10 MB.

The greeting is not a continuously listening wake-word detector. Recording remains hold-to-record. The sample is sent with each practice request so a future STT provider can use it for adaptation. The server does not persist audio or train/adapt a model. Reloading or leaving the page clears the sample and starts setup again. “Record a new greeting” discards the old reference and requires a new recording.

Practice responses return HTTP 202 with `{ status: "received", transcript: null, wordId, bytes, referenceReceived: true, adaptationStatus: "not_configured" }`. Implement your provider in `app/api/stt/route.ts` at the TODO. A provider must explicitly support reference-audio adaptation; supplying a greeting alone does not implement adaptation. Keep future provider credentials on the server.

The result panel appears when the API returns a `transcript` string and displays it alongside the original Korean word. Return an empty string for no speech detected, or `null` while STT is unimplemented. Until then, users can record and listen back, with a brief “Transcription is coming soon” note. No sample transcription is fabricated.

## Release checks

```sh
npm run check
```

This runs formatting, lint, TypeScript, the word-import and upload API tests, and the production build. GitHub Actions runs the same checks on pushes to `main` and pull requests with Node 24. No STT credentials are needed.

Use `npm run format` to apply formatting. Generated output, local environment files, and TypeScript build caches are ignored by Git. The lint configuration keeps narrowly scoped exceptions for generated UI primitives whose roles, content, and label associations are supplied through composition, and the existing carousel’s effect synchronization. Application code retains the accessibility and React rules.

After a successful build, `npm start` serves the production Worker locally. Sites deployment uses the project in `.openai/hosting.json` and the `dist/server` and `dist/client` build output; preserve that project ID when publishing updates. Keep future STT provider credentials in server-side environment variables.
