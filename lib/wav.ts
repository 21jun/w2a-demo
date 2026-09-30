const SAMPLE_RATE = 16000;
const MAX_WAV_BYTES = 9 * 1024 * 1024;

/** Mix decoded channels to mono and write a complete RIFF/PCM16 WAV file. */
export function encodePcm16Wav(channels: Float32Array[], sampleRate: number) {
  const frames = channels[0]?.length ?? 0;
  if (!frames || channels.some((channel) => channel.length !== frames))
    throw new Error('녹음에 오디오 데이터가 없습니다. 다시 녹음하세요.');
  if (!Number.isInteger(sampleRate) || sampleRate <= 0)
    throw new Error('Invalid audio sample rate.');
  const dataBytes = frames * 2;
  if (44 + dataBytes > MAX_WAV_BYTES)
    throw new Error('변환한 음성 파일은 9 MiB 이하여야 합니다.');
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  function label(offset: number, value: string) {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  }
  label(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let frame = 0; frame < frames; frame++) {
    let sample = 0;
    for (const channel of channels) sample += channel[frame];
    sample = Math.max(-1, Math.min(1, sample / channels.length));
    view.setInt16(
      44 + frame * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    );
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Decode the completed browser recording before retaining it as a reference.
 * decodeAudioData resamples to this offline context's 16 kHz sample rate.
 * No microphone playback or live AudioContext is created. */
export async function recordingToWav(recording: Blob) {
  if (typeof OfflineAudioContext === 'undefined')
    throw new Error(
      '이 브라우저는 음성 변환을 지원하지 않습니다. WAV 파일을 업로드하세요.',
    );
  let decoded: AudioBuffer;
  try {
    const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
    decoded = await context.decodeAudioData(await recording.arrayBuffer());
  } catch {
    throw new Error(
      '녹음한 음성을 읽을 수 없습니다. 버튼을 1초 이상 누르고 다시 녹음하세요.',
    );
  }
  if (decoded.duration < 0.25)
    throw new Error(
      '녹음이 너무 짧습니다. 버튼을 1초 이상 누르고 다시 녹음하세요.',
    );
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
    decoded.getChannelData(i),
  );
  return encodePcm16Wav(channels, decoded.sampleRate);
}
