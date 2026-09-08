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
  const response = await POST(
    new Request('http://localhost/api/stt', { method: 'POST', body: data }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    status: 'received',
    transcript: null,
    wordId: '1',
    bytes: 6,
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
