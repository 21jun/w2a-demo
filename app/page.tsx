'use client';
/* oxlint-disable react/react-compiler -- Compiler lint crashes with PruneHoistedContexts on the recorder callbacks. */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  Mic,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseWords, type Word } from '@/lib/words';
import examples from '@/public/words.json';

type Phase =
  | 'idle'
  | 'permission'
  | 'recording'
  | 'sending'
  | 'success'
  | 'error';
export default function Home() {
  const [step, setStep] = useState<'greeting' | 'practice'>('greeting');
  const [greeting, setGreeting] = useState('안녕');
  const [voiceSample, setVoiceSample] = useState<{
    audio: Blob;
    text: string;
  } | null>(null);
  const [words, setWords] = useState<Word[]>(examples);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('Ready when you are');
  const [seconds, setSeconds] = useState(0);
  const [source, setSource] = useState('Everyday Korean');
  const [audio, setAudio] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const held = useRef<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const recordingStart = useRef(0);
  const word =
    step === 'greeting'
      ? {
          id: 'greeting',
          korean: greeting,
          meaning: 'Your greeting / wake word',
        }
      : words[index];
  const locked =
    phase === 'permission' || phase === 'recording' || phase === 'sending';
  const visibleState = useRef({ word, transcript, phase, step });
  visibleState.current = { word, transcript, phase, step };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: object,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'read_practice_result',
            description:
              'Read the current Korean word, recording status and actual transcription result.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object.');
              return visibleState.current;
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      held.current = null;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio);
    },
    [audio],
  );
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - recordingStart.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= 60) stop();
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  function stop(input?: string) {
    if (input && held.current !== input) return;
    held.current = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }
  async function start(input: string) {
    if (busy.current || held.current) return;
    if (step === 'practice' && !voiceSample) return;
    if (step === 'greeting') setVoiceSample(null);
    held.current = input;
    busy.current = true;
    setPhase('permission');
    setMessage('Allow microphone access to begin');
    setAudio('');
    setTranscript(null);
    setSeconds(0);
    let stream: MediaStream | undefined;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      )
        throw new Error(
          'Recording needs a supported browser on HTTPS or localhost.',
        );
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (held.current !== input || !mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        busy.current = false;
        if (mounted.current) {
          setPhase('idle');
          setMessage('Microphone ready. Hold again to record.');
        }
        return;
      }
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = rec;
      const chunks: Blob[] = [];
      let failed = false;
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onerror = () => {
        failed = true;
        stop();
        stream?.getTracks().forEach((t) => t.stop());
        busy.current = false;
        setPhase('error');
        setMessage('Recording failed. Please try again.');
      };
      rec.onstop = async () => {
        stream?.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        held.current = null;
        if (!mounted.current || failed) {
          busy.current = false;
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (!blob.size) {
          busy.current = false;
          setPhase('error');
          setMessage('No audio captured. Hold a little longer and try again.');
          return;
        }
        setAudio(URL.createObjectURL(blob));
        setPhase('sending');
        setMessage('Sending your recording…');
        const data = new FormData();
        data.append(
          'audio',
          blob,
          `recording.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`,
        );
        data.append('word', word.korean);
        data.append('wordId', word.id);
        data.append('purpose', step);
        if (step === 'practice' && voiceSample) {
          data.append(
            'referenceAudio',
            voiceSample.audio,
            'greeting.' +
              (voiceSample.audio.type.includes('mp4')
                ? 'mp4'
                : voiceSample.audio.type.includes('ogg')
                  ? 'ogg'
                  : 'webm'),
          );
          data.append('referenceText', voiceSample.text);
        }
        try {
          const response = await fetch('/api/stt', {
            method: 'POST',
            body: data,
            signal: AbortSignal.timeout(30000),
          });
          const result = (await response.json()) as {
            error?: string;
            transcript?: string | null;
          };
          if (!response.ok)
            throw new Error(result.error || 'Upload failed. Please try again.');
          if (mounted.current) {
            if (step === 'greeting') {
              setVoiceSample({ audio: blob, text: greeting });
              setPhase('success');
              setMessage('Greeting received. You’re ready for word practice.');
              return;
            }
            setTranscript(
              typeof result.transcript === 'string' ? result.transcript : null,
            );
            setPhase('success');
            setMessage(
              typeof result.transcript === 'string'
                ? 'Transcription complete'
                : 'Recording received. Transcription is coming soon.',
            );
          }
        } catch (error) {
          if (mounted.current) {
            setPhase('error');
            setMessage(
              error instanceof Error
                ? error.message
                : 'Could not send recording. Please try again.',
            );
          }
        } finally {
          busy.current = false;
        }
      };
      rec.start();
      recordingStart.current = Date.now();
      setPhase('recording');
      setMessage('Listening… release to send');
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop());
      held.current = null;
      busy.current = false;
      setPhase('error');
      setMessage(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow it in your browser and try again.'
          : error instanceof Error
            ? error.message
            : 'Could not access your microphone.',
      );
    }
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.altKey || e.ctrlKey || e.metaKey)
        return;
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, select, audio, [contenteditable="true"], button:not([data-record])',
        )
      )
        return;
      e.preventDefault();
      void start('keyboard');
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && held.current === 'keyboard') {
        e.preventDefault();
        stop('keyboard');
      }
    };
    const blur = () => stop();
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
    };
  });
  function resetRecording() {
    setPhase('idle');
    setMessage('Ready when you are');
    setAudio('');
    setTranscript(null);
    setSeconds(0);
  }
  function continueToPractice() {
    if (busy.current || !voiceSample) return;
    resetRecording();
    setStep('practice');
  }
  function changeGreeting(value: string) {
    if (busy.current) return;
    setGreeting(value);
    setVoiceSample(null);
    resetRecording();
  }
  function redoGreeting() {
    if (busy.current) return;
    setVoiceSample(null);
    resetRecording();
    setStep('greeting');
  }
  function move(delta: number) {
    if (busy.current) return;
    setIndex((i) => Math.max(0, Math.min(words.length - 1, i + delta)));
    setPhase('idle');
    setMessage('Ready when you are');
    setAudio('');
    setTranscript(null);
    setSeconds(0);
  }
  async function importFile(selected?: File) {
    if (!selected || busy.current) return;
    try {
      const parsed = parseWords(await selected.text(), selected.name);
      setWords(parsed);
      setIndex(0);
      setSource(selected.name.replace(/\.(json|csv)$/i, ''));
      setPhase('idle');
      setMessage('Word list loaded. Ready when you are');
      setAudio('');
      setTranscript(null);
    } catch (e) {
      setPhase('error');
      setMessage(
        e instanceof Error ? e.message : 'Could not read this word list.',
      );
    }
  }
  return (
    <div className="app-shell">
      <header className="header">
        <Link className="brand" href="/" aria-label="Wake2Adapt home">
          <span className="brand-icon">
            <AudioLines size={23} />
          </span>
          Wake2Adapt
        </Link>
        <span className="header-caption">Your voice. One word at a time.</span>
      </header>
      <main>
        <div className="intro">
          <div className="eyebrow">
            {step === 'greeting'
              ? 'STEP 1 · VOICE SETUP'
              : 'STEP 2 · WORD PRACTICE'}
          </div>
          <h1>
            {step === 'greeting'
              ? 'Start with a hello.'
              : 'One word at a time.'}
          </h1>
          <p>
            {step === 'greeting'
              ? 'Record a greeting to use as your voice reference.'
              : 'Read the word aloud. Hold to record, release to send.'}
          </p>
        </div>
        <section
          className="practice-card"
          aria-label={
            step === 'greeting'
              ? 'Record your greeting'
              : 'Korean word practice'
          }
        >
          <div className="card-top">
            <span className="collection">
              <span className="blue-dot" />
              {step === 'greeting' ? 'Your voice reference' : source}
            </span>
            <span className="count">
              {step === 'greeting'
                ? '01 / 02'
                : `${String(index + 1).padStart(2, '0')} / ${String(words.length).padStart(2, '0')}`}
            </span>
          </div>
          <div className="word-area">
            <span className="word-label">
              {step === 'greeting' ? 'SAY YOUR GREETING' : 'READ THIS WORD'}
            </span>
            <h2
              lang={step === 'greeting' && greeting === 'Hello' ? 'en' : 'ko'}
            >
              {word.korean}
            </h2>
            {word.meaning && <p className="meaning">{word.meaning}</p>}
          </div>
          {step === 'greeting' && (
            <div className="greeting-choices" aria-label="Choose a greeting">
              {['안녕', 'Hello'].map((text) => (
                <Button
                  key={text}
                  variant="outline"
                  className={
                    greeting === text
                      ? 'greeting-choice selected'
                      : 'greeting-choice'
                  }
                  aria-pressed={greeting === text}
                  disabled={locked}
                  onClick={() => changeGreeting(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          )}
          <div
            className={`record-area ${phase === 'recording' ? 'is-recording' : ''}`}
          >
            <div className="soundline" aria-hidden="true">
              {Array.from({ length: 31 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      '--bar': `${8 + ((i * 7) % 23)}px`,
                      animationDelay: `${i * 0.045}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <Button
              data-record
              className="record-button"
              aria-label={
                step === 'greeting'
                  ? 'Hold to record your greeting'
                  : 'Hold to record Korean word'
              }
              aria-pressed={phase === 'recording'}
              disabled={phase === 'sending'}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                void start('pointer');
              }}
              onPointerUp={() => stop('pointer')}
              onPointerCancel={() => stop('pointer')}
              onLostPointerCapture={() => stop('pointer')}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Mic size={22} />
              {phase === 'recording'
                ? 'Release to send'
                : phase === 'sending'
                  ? 'Sending…'
                  : phase === 'permission'
                    ? 'Waiting for microphone…'
                    : 'Hold to record'}
            </Button>
            <p className="keyboard-hint">
              or hold the <kbd>space bar</kbd>
            </p>
            <output className={`status ${phase}`} aria-live="polite">
              {phase === 'success' ? (
                <Check size={15} />
              ) : (
                <span className="status-dot" />
              )}
              <span>{message}</span>
              {phase === 'recording' && (
                <span className="timer">{seconds.toFixed(1)}s</span>
              )}
            </output>
            {/* Recording playback has no captions until the STT service is connected. */}
            {/* oxlint-disable jsx-a11y/media-has-caption */}
            {audio && (
              <audio
                className="playback"
                controls
                src={audio}
                aria-label="Listen to your recording"
              />
            )}
          </div>
          {step === 'practice' &&
            (phase === 'sending' || phase === 'success' || audio) && (
              <section
                className="comparison"
                aria-label="Transcription result"
                aria-live="polite"
              >
                <div>
                  <h3>Original word</h3>
                  <p lang="ko">{word.korean}</p>
                </div>
                <div>
                  <h3>Transcribed output</h3>
                  {transcript !== null ? (
                    <p lang="ko">{transcript || 'No speech detected'}</p>
                  ) : (
                    <p className="transcript-placeholder">
                      {phase === 'sending'
                        ? 'Waiting for transcription…'
                        : phase === 'error'
                          ? 'Transcription unavailable. Try recording again.'
                          : 'Transcription isn’t connected yet.'}
                    </p>
                  )}
                </div>
              </section>
            )}
          {step === 'greeting' ? (
            <div className="greeting-bottom">
              <p>
                {voiceSample
                  ? 'Listen back or hold to record again.'
                  : 'Hold the button or Space, then release to send.'}
              </p>
              <Button
                className="continue-button"
                disabled={locked || !voiceSample}
                onClick={continueToPractice}
              >
                Continue to word practice
                <ArrowRight size={17} />
              </Button>
            </div>
          ) : (
            <div className="card-bottom">
              <Button
                variant="ghost"
                className="nav-button"
                disabled={locked || index === 0}
                onClick={() => move(-1)}
              >
                <ArrowLeft size={17} />
                Previous
              </Button>
              <span className="word-position">
                Word {index + 1} of {words.length}
              </span>
              <Button
                variant="ghost"
                className="nav-button"
                disabled={locked || index === words.length - 1}
                onClick={() => move(1)}
              >
                Next word
                <ArrowRight size={17} />
              </Button>
            </div>
          )}
        </section>
        {step === 'practice' && (
          <div className="voice-reference">
            <span>
              <Check size={15} />
              Greeting ready: <strong>{voiceSample?.text}</strong>
            </span>
            <Button variant="ghost" disabled={locked} onClick={redoGreeting}>
              Record a new greeting
            </Button>
          </div>
        )}
        {step === 'practice' && (
          <div className="below-card">
            <span>Make it your own.</span>
            <Button
              variant="ghost"
              className="import-button"
              disabled={locked}
              onClick={() => file.current?.click()}
            >
              <Upload size={15} />
              Import words<span className="file-types">JSON / CSV</span>
            </Button>
            <input
              ref={file}
              type="file"
              accept=".json,.csv"
              hidden
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}
        <p className="privacy-note">
          Your greeting stays in this session and is sent with each word
          recording.
          <br />
          Voice adaptation and transcription are not connected yet.
        </p>
      </main>
      <footer>
        Wake2Adapt · Your microphone is only on while you’re recording.
      </footer>
    </div>
  );
}
