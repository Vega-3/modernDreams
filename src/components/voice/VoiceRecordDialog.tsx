import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Save, X, Settings } from 'lucide-react';
import { transcribeVoiceClaude, createDream, openMicrophoneSettings } from '@/lib/tauri';
import { friendlyApiError } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useTagStore } from '@/stores/tagStore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'recording' | 'processing' | 'review';

interface VoiceRecordDialogProps {
  open: boolean;
  onClose: () => void;
  onDreamSaved: () => void;
}

/** Pick the best supported audio MIME type for MediaRecorder across platforms. */
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

/** Strip codec suffix for the Anthropic API — it only accepts the bare MIME. */
function baseMime(mimeType: string): string {
  return mimeType.split(';')[0];
}

/** Format elapsed seconds as M:SS. */
function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultTitle(): string {
  return `Dream — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function VoiceRecordDialog({ open, onClose, onDreamSaved }: VoiceRecordDialogProps) {
  const { tags } = useTagStore();

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the error is specifically a microphone permission denial,
  // so we can offer a direct link to OS settings rather than a generic message.
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Review-phase form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dreamDate, setDreamDate] = useState(todayIso());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setPhase('idle');
      setElapsed(0);
      setError(null);
      setTitle('');
      setContent('');
      setDreamDate(todayIso());
      setSelectedTagIds(new Set());
      setMicPermissionDenied(false);
      chunksRef.current = [];
    }
  }, [open]);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const startRecording = useCallback(async () => {
    setError(null);
    setMicPermissionDenied(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const isPermissionError =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      if (isPermissionError) {
        setMicPermissionDenied(true);
        setError('Microphone access was denied.');
      } else {
        setError(`Could not access microphone: ${String(err)}`);
      }
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      stopTimer();

      const actualMime = recorder.mimeType || mimeType || 'audio/webm';
      await processAudio(chunksRef.current, actualMime);
    };

    recorder.start(250); // collect a chunk every 250 ms
    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setPhase('processing');
  }, []);

  async function processAudio(chunks: Blob[], mimeType: string) {
    const apiKey = localStorage.getItem('anthropic_api_key') ?? '';
    if (!apiKey) {
      setError('No Anthropic API key found. Please add your key in Settings → Anthropic API Key.');
      setPhase('idle');
      return;
    }

    const blob = new Blob(chunks, { type: mimeType });
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    try {
      const result = await transcribeVoiceClaude(base64, baseMime(mimeType), apiKey);
      setTitle(defaultTitle());
      setContent(result.english_transcript);
      setDreamDate(todayIso());
      setSelectedTagIds(new Set());
      setPhase('review');
    } catch (err) {
      setError(friendlyApiError(String(err)));
      setPhase('idle');
    }
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setIsSaving(true);
    try {
      await createDream({
        title: title.trim(),
        content_html: `<p>${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
        content_plain: content,
        dream_date: dreamDate,
        is_lucid: false,
        mood_rating: null,
        clarity_rating: null,
        meaningfulness_rating: null,
        waking_life_context: null,
        analysis_notes: null,
        tag_ids: Array.from(selectedTagIds),
        word_tag_associations: [],
      });
      onDreamSaved();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Voice Capture</DialogTitle>
          <DialogDescription>
            {phase === 'idle' && 'Record yourself describing your dream.'}
            {phase === 'recording' && 'Speak clearly — recording in progress.'}
            {phase === 'processing' && 'Transcribing your dream…'}
            {phase === 'review' && 'Review and save your transcribed dream.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Idle ── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-6 py-8">
            {error && (
              <div className="flex flex-col items-center gap-2 px-4">
                <p className="text-sm text-destructive text-center">{error}</p>
                {micPermissionDenied && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => openMicrophoneSettings()}
                  >
                    <Settings className="h-4 w-4" />
                    Open Microphone Settings
                  </Button>
                )}
              </div>
            )}
            <button
              onClick={startRecording}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors border-2 border-primary/30 hover:border-primary"
            >
              <Mic className="h-10 w-10 text-primary" />
            </button>
            <p className="text-sm text-muted-foreground">Click the microphone to begin</p>
          </div>
        )}

        {/* ── Recording ── */}
        {phase === 'recording' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative flex h-24 w-24 items-center justify-center">
              {/* Pulsing ring */}
              <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
              <button
                onClick={stopRecording}
                className="relative flex h-24 w-24 items-center justify-center rounded-full bg-destructive/15 hover:bg-destructive/25 transition-colors border-2 border-destructive"
              >
                <MicOff className="h-10 w-10 text-destructive" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-mono tabular-nums text-foreground">
                {fmtTime(elapsed)}
              </span>
              <p className="text-sm text-muted-foreground">Click to stop recording</p>
            </div>
          </div>
        )}

        {/* ── Processing ── */}
        {phase === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Transcribing your dream…</p>
          </div>
        )}

        {/* ── Review ── */}
        {phase === 'review' && (
          <div className="flex flex-col gap-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Title
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dream Content
              </label>
              <textarea
                className={cn(
                  'min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2',
                  'text-sm shadow-sm placeholder:text-muted-foreground resize-y',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 w-40">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date
                </label>
                <Input
                  type="date"
                  value={dreamDate}
                  onChange={(e) => setDreamDate(e.target.value)}
                />
              </div>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTagIds.has(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer select-none transition-colors"
                      style={
                        selectedTagIds.has(tag.id)
                          ? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }
                          : { borderColor: tag.color, color: tag.color }
                      }
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1.5" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !title.trim() || !content.trim()}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Save Dream
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
