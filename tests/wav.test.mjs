import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePcm16Wav } from '../lib/wav.ts';

// Independently check the file contract consumed by WAV decoders.
test('writes a complete mono PCM16 WAV with valid sizes and clipped samples', async () => {
  const wav = encodePcm16Wav([new Float32Array([-2, -1, 0, 0.5, 1, 2])], 16000);
  const buffer = await wav.arrayBuffer();
  const view = new DataView(buffer);
  assert.equal(wav.type, 'audio/wav');
  assert.equal(new TextDecoder().decode(buffer.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(buffer.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint32(4, true) + 8, buffer.byteLength);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint32(28, true), 32000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), buffer.byteLength - 44);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => view.getInt16(44 + 2 * i, true)),
    [-32768, -32768, 0, 16384, 32767, 32767],
  );
});

test('preserves duration when mixing stereo down to mono', async () => {
  const wav = encodePcm16Wav(
    [new Float32Array([1, 1]), new Float32Array([-1, 0])],
    16000,
  );
  const view = new DataView(await wav.arrayBuffer());
  assert.equal(wav.size, 48);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 16384);
});

test('rejects empty channels, inconsistent lengths, invalid rates, and oversized decoded audio', () => {
  for (const channels of [
    [],
    [new Float32Array()],
    [new Float32Array(1), new Float32Array(2)],
  ])
    assert.throws(() => encodePcm16Wav(channels, 16000));
  assert.throws(() => encodePcm16Wav([new Float32Array(1)], 0));
  assert.throws(
    () => encodePcm16Wav([new Float32Array(5 * 1024 * 1024)], 16000),
    /9 MiB/,
  );
});
