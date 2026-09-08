const MAX_BYTES = 10 * 1024 * 1024;
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
    return Response.json(
      { error: 'Expected multipart form data.' },
      { status: 415 },
    );
  if (Number(request.headers.get('content-length')) > MAX_BYTES)
    return Response.json(
      { error: 'Recording must be smaller than 10 MB.' },
      { status: 413 },
    );
  // Bound streamed requests too, including those without Content-Length.
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: 'Missing recording.' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return Response.json(
          { error: 'Recording must be smaller than 10 MB.' },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data = await new Response(body, {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
    const audio = data.get('audio');
    const word = data.get('word');
    const wordId = data.get('wordId');
    if (
      !(audio instanceof File) ||
      !audio.size ||
      !audio.type.startsWith('audio/') ||
      typeof word !== 'string' ||
      !word.trim() ||
      word.length > 200 ||
      typeof wordId !== 'string'
    )
      return Response.json(
        { error: 'Provide an audio file, word, and wordId.' },
        { status: 400 },
      );
    // TODO: Pass audio to your STT provider here. No transcription or storage yet.
    return Response.json(
      { status: 'received', transcript: null, wordId, bytes: audio.size },
      { status: 202 },
    );
  } catch {
    return Response.json(
      { error: 'Invalid recording upload.' },
      { status: 400 },
    );
  }
}
