import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWords } from '../lib/words.ts';
import { POST } from '../app/api/stt/route.ts';
test('imports JSON strings and CSV with BOM and escaped fields', () => {
  assert.equal(parseWords('["하늘"]', 'words.json')[0].korean, '하늘');
  assert.deepEqual(
    parseWords(
      '\uFEFFid,korean,meaning\r\n1,안녕,"Hello, ""friend"""',
      'words.csv',
    )[0],
    { id: '1', korean: '안녕', meaning: 'Hello, "friend"' },
  );
  assert.throws(() => parseWords('[]', 'words.json'));
  assert.throws(() => parseWords('meaning\nhello', 'words.csv'));
});
test('accepts audio and leaves transcription empty', async () => {
  const data = new FormData();
  data.append(
    'audio',
    new Blob(['sample'], { type: 'audio/webm' }),
    'recording.webm',
  );
  data.append('word', '안녕');
  data.append('wordId', '1');
  data.append('purpose', 'practice');
  data.append(
    'referenceAudio',
    new Blob(['greeting'], { type: 'audio/webm' }),
    'greeting.webm',
  );
  data.append('referenceText', 'Hello');
  const response = await POST(
    new Request('http://localhost/api/stt', { method: 'POST', body: data }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    status: 'received',
    transcript: null,
    wordId: '1',
    bytes: 6,
    referenceReceived: true,
    adaptationStatus: 'not_configured',
  });
});
test('rejects missing audio, incorrect media, and oversized uploads', async () => {
  assert.equal(
    (
      await POST(
        new Request('http://localhost/api/stt', { method: 'POST', body: '{}' }),
      )
    ).status,
    415,
  );
  const data = new FormData();
  data.append('word', '안녕');
  assert.equal(
    (
      await POST(
        new Request('http://localhost/api/stt', { method: 'POST', body: data }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        new Request('http://localhost/api/stt', {
          method: 'POST',
          headers: {
            'content-type': 'multipart/form-data',
            'content-length': String(11 * 1024 * 1024),
          },
          body: 'test',
        }),
      )
    ).status,
    413,
  );
});

test('accepts greeting enrollment without claiming adaptation', async () => {
  const data = new FormData();
  data.append(
    'audio',
    new Blob(['hello'], { type: 'audio/mp4' }),
    'greeting.mp4',
  );
  data.append('word', 'Hello');
  data.append('wordId', 'greeting');
  data.append('purpose', 'greeting');
  const response = await POST(
    new Request('http://localhost/api/stt', { method: 'POST', body: data }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    status: 'received',
    purpose: 'greeting',
    bytes: 5,
  });
});
test('requires a usable greeting reference for word practice', async () => {
  for (const reference of [
    null,
    new Blob([], { type: 'audio/webm' }),
    new Blob(['bad'], { type: 'text/plain' }),
  ]) {
    const data = new FormData();
    data.append(
      'audio',
      new Blob(['word'], { type: 'audio/webm' }),
      'word.webm',
    );
    data.append('word', '하늘');
    data.append('wordId', '1');
    data.append('purpose', 'practice');
    if (reference) data.append('referenceAudio', reference, 'greeting.webm');
    data.append('referenceText', '안녕');
    const response = await POST(
      new Request('http://localhost/api/stt', { method: 'POST', body: data }),
    );
    assert.equal(response.status, 400);
  }
});
