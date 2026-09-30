# Wake2Adapt

Use Node.js 22.13+ (Node 24 recommended).

```sh
nvm use
npm ci
npm run dev
```

Open the local URL printed by the server. First choose a greeting (안녕 or Hello), record it, then continue to word practice. You can listen back or re-record before continuing. Microphone recording requires localhost or HTTPS. Allow microphone access, then hold the record button (mouse/touch) or Space and release to upload. If the permission dialog interrupts the first hold, hold again after allowing access. Recordings stop at 60 seconds, when the window loses focus, or when the tab is hidden. Audio playback is available after recording.

## Access from other devices

Both `npm run dev` and `npm start` listen on `0.0.0.0` (all network interfaces). Restart an already running server after changing this configuration. From another device on the same network, open `http://<server-LAN-IP>:<port>` using the port printed by the server. `0.0.0.0` is the bind address, not the address to enter in the browser. Allow inbound connections to that port in the host firewall if needed.

Access over the public internet additionally requires routing, such as a deployed HTTPS site or an HTTPS reverse proxy/tunnel; the bind setting alone does not configure the router. For a custom development hostname, set Vite's `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` environment variable to the exact hostname. IP addresses are accepted by default.

Microphone recording on another device requires HTTPS with a trusted certificate. Plain HTTP over a LAN IP can display the app and accept JSON uploads, but browser microphone access is unavailable.

## Word lists

The default practice list loads directly from `data/roads_P001.jsonl`, using each row’s `text` as the practice word in file order. Edit this file to change the default list (rebuild for production). Empty `audioBase64` values are allowed for word lists; they do not set a voice reference. Set up your reference by recording or uploading audio as before.

Use **Import words** to load JSON/JSONL/CSV for the current session. JSONL has one object per line, using `text` or `korean`, with optional `id` and `meaning`. Examples of the older formats remain in `public/words.json` and `public/words.csv`.

JSON accepts an array of `{ "id": "1", "korean": "안녕하세요", "meaning": "Hello" }` or an array of strings. CSV uses `korean` with optional `id` and `meaning` columns. The importer supports quoted fields, commas, and UTF-8 BOMs.

## Reference and recording uploads

The voice reference does not have to come from the microphone. On the setup screen, type the spoken sentence into **Reference text** (the preset 안녕 / Hello buttons just fill it in, and any 1–200 character sentence works), then use **Upload reference audio** to pick a `wav`, `m4a`, `mp3`, `webm`, `ogg` or `flac` file. The file and that text are submitted as the reference, exactly as a microphone recording would be, and playback works the same way. Editing the text after a reference is registered clears it, because the audio would no longer match.

On the practice screen, **Upload recording audio** does the same for the current word, and the stored reference is attached automatically.

Files are checked in the browser: an unsupported type is rejected, and the reference plus the current recording must stay within 9 MiB of audio (the API request limit is 10 MiB). A file whose type the browser leaves empty — common for `.m4a` — is labelled from its extension.

## Recording JSON uploads

Both setup and word practice also accept a JSON file through **Upload reference JSON** / **Upload recording JSON**, which carries the audio as Base64 — useful for scripted uploads. Open **JSON 포맷 안내** on either screen for the schema.

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

`POST /api/stt` receives multipart fields `audio` (File), `word`, `wordId`, and `purpose` (`greeting` or `practice`). Greeting uploads are validated and acknowledged; the browser keeps the Blob and its text in React memory for the session. Every practice upload includes `referenceAudio` (File) and `referenceText`. Missing or invalid references are rejected. The combined multipart upload limit is 10 MB.

Practice uploads are forwarded to the wake2adapt serving API (`../server.py`), which runs Qwen2.5-Omni with the greeting as its 1-shot reference and then retrieves the closest L2-KPNS entities by phonetic edit distance. Configure it in `.env` (gitignored, loaded by `npm run dev`):

```sh
W2A_API_URL=http://127.0.0.1:8000   # required; unset keeps the demo standalone
W2A_DOMAIN=roads                    # roads | content | restaurants | stations | all
W2A_TOP_K=10
```

Start the API first (see `../README.md`), then `npm run dev`. `wrangler dev` does not read the project-root `.env`; pass the same values with `--var W2A_API_URL:… W2A_TOP_K:…` when testing the production Worker with `npm start`.

With `W2A_API_URL` set, a practice upload answers HTTP 200:

```json
{
  "status": "ok",
  "transcript": "상국안길",
  "asrIpa": "saŋkukankil",
  "wordId": "1",
  "bytes": 75244,
  "referenceReceived": true,
  "adaptationStatus": "reference_audio",
  "domain": "roads",
  "lexiconSize": 200,
  "retrieved": [
    {
      "rank": 1,
      "entity": "상곡안길",
      "score": 0.91,
      "distance": 1,
      "ipa": "saŋkokankil"
    }
  ],
  "timing": {
    "decode_s": 0.01,
    "asr_s": 2.35,
    "retrieval_s": 0.03,
    "total_s": 2.39
  }
}
```

The result panel shows the transcription and its IPA next to the original word, followed by the ranked retrieval table; a hit equal to the practiced word is highlighted. `score` is 1 − (phoneme edit distance / longer IPA length), so 1.00 is an exact phonetic match.

Without `W2A_API_URL` the route still validates the upload and answers HTTP 202 with `{ status: "received", transcript: null, …, adaptationStatus: "not_configured" }`; the UI then shows the "Transcription is coming soon" note instead of a fabricated result. If the API is unreachable or returns an error, the route answers HTTP 502 and the UI shows that message.

The greeting is not a continuously listening wake-word detector. Recording remains hold-to-record, and the sample is sent with each practice request so the API can use it for 1-shot adaptation. Neither the demo nor the API persists audio or trains a model. Reloading or leaving the page clears the sample and starts setup again. "Record a new greeting" discards the old reference and requires a new recording. Keep any future provider credentials in server-side environment variables.

## Release checks

```sh
npm run check
```

This runs formatting, lint, TypeScript, the word-import and upload API tests, and the production build. GitHub Actions runs the same checks on pushes to `main` and pull requests with Node 24. No STT credentials are needed.

Use `npm run format` to apply formatting. Generated output, local environment files, and TypeScript build caches are ignored by Git. The lint configuration keeps narrowly scoped exceptions for generated UI primitives whose roles, content, and label associations are supplied through composition, and the existing carousel’s effect synchronization. Application code retains the accessibility and React rules.

After a successful build, `npm start` serves the production Worker locally. Sites deployment uses the project in `.openai/hosting.json` and the `dist/server` and `dist/client` build output; preserve that project ID when publishing updates. Keep future STT provider credentials in server-side environment variables.
