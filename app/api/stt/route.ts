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
    const purpose = data.get('purpose') ?? 'practice';
    if (purpose !== 'greeting' && purpose !== 'practice')
      return Response.json(
        { error: 'Unknown recording purpose.' },
        { status: 400 },
      );
    if (purpose === 'greeting') {
      // TODO: Optional enrollment with your future adaptation provider.
      // The client retains the sample for this session; nothing is persisted here.
      return Response.json(
        { status: 'received', purpose, bytes: audio.size },
        { status: 202 },
      );
    }
    const referenceAudio = data.get('referenceAudio');
    const referenceText = data.get('referenceText');
    if (
      !(referenceAudio instanceof File) ||
      !referenceAudio.size ||
      !referenceAudio.type.startsWith('audio/') ||
      typeof referenceText !== 'string' ||
      !referenceText.trim() ||
      referenceText.length > 200
    )
      return Response.json(
        {
          error:
            'Record your greeting first. A reference audio file and text are required.',
        },
        { status: 400 },
      );
    // TODO: Send audio + referenceAudio + referenceText to an STT provider
    // that supports voice adaptation. No recognition, adaptation, or storage yet.
    return Response.json(
      {
        status: 'received',
        transcript: null,
        wordId,
        bytes: audio.size,
        referenceReceived: true,
        adaptationStatus: 'not_configured',
      },
      { status: 202 },
    );
  } catch {
    return Response.json(
      { error: 'Invalid recording upload.' },
      { status: 400 },
    );
  }
}
