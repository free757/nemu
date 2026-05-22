import { stabilizeTranscript } from '@/lib/transcriptStabilizer';
import { addChunk, getBufferedTranscript, clearBuffer } from '@/lib/incrementalBuffer';
import { analyzeQuestionCompletion } from '@/lib/semanticCompletion';
import { throttleAIRequest, PipelineDebounce, abortAllActiveRequests, enterCooldown, isInCooldown } from './pipelineDebounce';
import { calculateDynamicThreshold, calculateStability, calculateNoise } from '@/lib/confidenceThreshold';
import { shouldGenerateAnswer } from '@/lib/smartTriggerController';
import { scheduleDelayedTrigger, cancelPendingTrigger, resetTriggerState } from '@/lib/delayedAutoTrigger';
import { startDraftPreGeneration, cancelDraftGeneration, clearDraft } from '@/lib/draftPreGenerator';
import { evaluateFinalization } from '@/lib/finalizationDecisionEngine';

export enum PipelineState {
  IDLE,
  LISTENING,
  ANALYZING,
  PREPARING_DRAFT,
  WAITING_TRIGGER,
  GENERATING_ANSWER,
  ANSWER_COMPLETED,
  SPEAKING,
  CLEANUP,
  ERROR
}

export interface PipelineEvents {
  onTranscriptUpdate?: (transcript: string) => void;
  onDraftReady?: (draft: string) => void;
  onTriggerScheduled?: (delayMs: number) => void;
  onTriggerCancelled?: (reason: string) => void;
  onAnswerGenerating?: (question: string) => void;
  onAnswerGenerated?: (answer: string) => void;
  onRateLimited?: (cooldownMs: number) => void;
  onPipelineError?: (error: Error) => void;
}

export interface ProcessSpeechParams {
  chunk: string;
  isPartial: boolean;
  incomingConfidence?: number;
  silenceDuration: number;
  isUserSpeaking: boolean;
  cvText?: string;
  systemPrompt?: string;
  sessionId?: string;
}

/**
 * Central Realtime Pipeline Orchestrator.
 * Coordinates transcript stabilization, buffering, semantic evaluation, dynamic thresholding,
 * trigger controllers, delayed auto triggers, and background answer pre-generation.
 * Employs robust protection against race conditions and parallel latency optimizations.
 */
export class RealtimePipeline {
  private state: PipelineState = PipelineState.IDLE;
  private currentStabilizedTranscript = '';
  private currentConfidenceScore = 1.0;
  private latestSemanticConfidence = 0.0;
  private latestDraft = '';
  private isProcessing = false;
  private debouncer = new PipelineDebounce();
  private sessionId = '';

  // Tracks whether a final answer generation is currently protected from reset/abort
  private isFinalGenerationActive = false;

  constructor(private events: PipelineEvents = {}) {}

  public registerEvents(events: PipelineEvents) {
    this.events = { ...this.events, ...events };
  }

  public debounceAndProcess(params: ProcessSpeechParams) {
    this.debouncer.debounceSpeech(params, (approvedParams) => {
      this.processIncomingSpeech(approvedParams);
    });
  }

  /**
   * Resets the pipeline. If a final generation is active and this is NOT an explicit
   * user-initiated cancellation, it will wait and skip throttler abort to preserve the answer.
   */
  public reset(explicit: boolean = false) {
    // PROTECTED STATE: if a final answer is actively generating, do not abort it
    // unless the user explicitly cancels (new mic session, user cancels button, etc.)
    if (this.isFinalGenerationActive && !explicit) {
      console.log('[Pipeline] waiting for final completion before reset');
      console.log('[Pipeline] protected final request preserved');
      return;
    }

    console.log('[Pipeline] Resetting entire pipeline orchestrator');
    this.state = PipelineState.IDLE;
    this.currentStabilizedTranscript = '';
    this.currentConfidenceScore = 1.0;
    this.latestSemanticConfidence = 0.0;
    this.latestDraft = '';
    this.isProcessing = false;
    this.isFinalGenerationActive = false;
    this.sessionId = '';

    clearBuffer();
    resetTriggerState();
    clearDraft();
    cancelDraftGeneration();
    cancelPendingTrigger('manual');
    this.debouncer.reset();

    // Only abort active requests on explicit user-initiated reset,
    // NOT on automatic post-answer cleanup (to avoid aborting the final answer mid-flight)
    if (explicit) {
      abortAllActiveRequests('explicit_reset');
    }

    console.log('[Pipeline] full reset completed');
  }

  /**
   * Graceful cleanup after answer completion — transitions through the
   * ANSWER_COMPLETED → CLEANUP → IDLE state machine without aborting anything.
   */
  private gracefulCleanup() {
    console.log('[Pipeline] graceful cleanup started');
    this.state = PipelineState.CLEANUP;
    this.isFinalGenerationActive = false;
    this.currentStabilizedTranscript = '';
    this.currentConfidenceScore = 1.0;
    this.latestSemanticConfidence = 0.0;
    this.latestDraft = '';
    this.isProcessing = false;
    this.sessionId = '';

    clearBuffer();
    resetTriggerState();
    clearDraft();
    // NOTE: do NOT call abortAllActiveRequests here — the final request already completed
    cancelPendingTrigger('manual');
    this.debouncer.reset();

    this.state = PipelineState.IDLE;
  }

  public getState(): PipelineState {
    return this.state;
  }

  public getTranscript(): string {
    return this.currentStabilizedTranscript;
  }

  public async processIncomingSpeech({
    chunk,
    isPartial,
    incomingConfidence,
    silenceDuration,
    isUserSpeaking,
    cvText = '',
    systemPrompt = '',
    sessionId = ''
  }: ProcessSpeechParams): Promise<void> {

    if (this.isProcessing) {
      return;
    }

    // Protect against new speech interrupting an active final generation
    if (this.state === PipelineState.GENERATING_ANSWER || this.isFinalGenerationActive) {
      return;
    }

    if (sessionId) {
      this.sessionId = sessionId;
    }

    this.isProcessing = true;

    try {
      if (this.state === PipelineState.IDLE) {
        this.state = PipelineState.LISTENING;
      }

      // --- 1. Transcript Stabilization ---
      const stabResult = stabilizeTranscript({
        previousTranscript: this.currentStabilizedTranscript,
        incomingChunk: chunk,
        previousConfidence: this.currentConfidenceScore,
        incomingConfidence,
        isPartial,
        semanticConfidence: this.latestSemanticConfidence
      });

      if (!stabResult.changesDetected && this.currentStabilizedTranscript.length > 0) {
        this.isProcessing = false;
        return;
      }

      this.currentStabilizedTranscript = stabResult.stabilizedTranscript;
      this.currentConfidenceScore = stabResult.stabilityScore;

      console.log('[Pipeline] transcript updated');
      this.events.onTranscriptUpdate?.(this.currentStabilizedTranscript);

      // --- 2. Incremental Buffer Update ---
      addChunk(this.currentStabilizedTranscript);
      const bufferedTranscript = getBufferedTranscript();

      // --- 3. Parallel: Semantic Analysis & Draft Pre-generation ---
      this.state = PipelineState.ANALYZING;

      const [semanticResult] = await Promise.all([
        analyzeQuestionCompletion(bufferedTranscript, this.sessionId),
        startDraftPreGeneration({
          transcript: bufferedTranscript,
          semanticResult: {
            isComplete: false,
            confidence: 0.7,
            reason: 'Parallel background run'
          },
          cvText,
          systemPrompt,
          onDraftUpdate: (draft) => {
            this.latestDraft = draft;
            console.log('[Pipeline] draft ready');
            this.events.onDraftReady?.(draft);
          },
          sessionId: this.sessionId
        }).catch(err => {
          console.error('[Pipeline] Background pre-generation error:', err);
          return null;
        })
      ]);

      this.latestSemanticConfidence = semanticResult.confidence;
      console.log('[Pipeline] semantic analysis complete');

      // --- 4. Confidence Threshold Evaluation ---
      const stability = calculateStability(bufferedTranscript);
      const noise = calculateNoise(bufferedTranscript);
      const wordCount = bufferedTranscript.split(/\s+/).filter(Boolean).length;

      const thresholdResult = calculateDynamicThreshold({
        transcriptLength: wordCount,
        semanticConfidence: semanticResult.confidence,
        silenceDuration,
        transcriptStability: stability,
        noiseLevel: noise,
        speakingSpeed: 0.5
      });

      // --- 5. Smart Trigger Decision ---
      const triggerResult = await shouldGenerateAnswer({
        transcript: bufferedTranscript,
        semanticResult: {
          isComplete: semanticResult.isComplete,
          confidence: thresholdResult.adjustedConfidence,
          reason: thresholdResult.reason
        },
        silenceDuration,
        isUserSpeaking
      });

      // --- 6. Delayed Trigger Scheduling ---
      if (triggerResult.shouldTrigger) {
        console.log('[Pipeline] trigger approved');
        this.state = PipelineState.WAITING_TRIGGER;

        scheduleDelayedTrigger({
          transcript: bufferedTranscript,
          confidenceResult: thresholdResult,
          onTrigger: () => {
            this.triggerAnswerGeneration(bufferedTranscript, cvText, systemPrompt);
          },
          onCancel: (reason) => {
            console.log(`[Pipeline] Trigger cancelled: ${reason}`);
            this.state = PipelineState.LISTENING;
            this.events.onTriggerCancelled?.(reason);
          }
        });

        const delayMs = thresholdResult.adjustedConfidence >= 0.90 ? 600 : thresholdResult.adjustedConfidence >= 0.80 ? 1000 : 1400;
        this.events.onTriggerScheduled?.(delayMs);
      } else {
        this.state = this.latestDraft ? PipelineState.PREPARING_DRAFT : PipelineState.LISTENING;
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Suppress UI error for intentional aborts
        console.log('[Pipeline] processIncomingSpeech aborted (intentional)');
        return;
      }
      console.error('[Pipeline] Orchestrator processing error:', error);
      this.state = PipelineState.ERROR;
      this.events.onPipelineError?.(error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Finalizes the response generation. Uses pre-generated draft or falls back to API.
   * Protects the final request from being reset/aborted mid-flight via isFinalGenerationActive.
   *
   * Pre-flight semantic validation is intentionally NOT repeated here — it was already
   * performed by requestFinalization() or the auto-trigger path. Repeating it causes
   * double LLM calls and creates divergent rejection behavior.
   */
  private async triggerAnswerGeneration(
    questionText: string,
    cvText: string,
    systemPrompt: string
  ): Promise<void> {
    if (this.state === PipelineState.GENERATING_ANSWER || this.isFinalGenerationActive) {
      return;
    }

    // Block if currently in rate-limit cooldown
    if (isInCooldown()) {
      console.log('[Pipeline] answer generation blocked — in rate-limit cooldown');
      this.gracefulCleanup();
      return;
    }

    // Mark as protected BEFORE any async work
    this.isFinalGenerationActive = true;
    this.state = PipelineState.GENERATING_ANSWER;
    console.log('[Pipeline] answer generation started');
    this.events.onAnswerGenerating?.(questionText);

    cancelDraftGeneration();
    cancelPendingTrigger('manual');

    // Serve pre-generated draft instantly if available
    if (this.latestDraft) {
      console.log('[Pipeline] Serving pre-generated draft instantly!');
      this.state = PipelineState.ANSWER_COMPLETED;
      this.events.onAnswerGenerated?.(this.latestDraft);
      this.gracefulCleanup();
      return;
    }

    // Fallback: fresh API call with 429-aware retry + backoff
    const RETRY_DELAYS_MS = [1000, 2000, 4000];
    let lastError: Error | null = null;

    try {
      const throttledAnswer = await throttleAIRequest<string | null>(
        'final',
        questionText,
        async (signal) => {
          for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                question: questionText,
                cvText,
                systemPrompt: systemPrompt || undefined
              }),
              signal
            });

            if (res.status === 429) {
              const retryAfterHeader = res.headers.get('retry-after');
              const cooldownMs = retryAfterHeader ? parseInt(retryAfterHeader) * 1000 : 8000;
              enterCooldown(cooldownMs);
              console.log(`[Provider] rate limited — /api/chat returned 429, attempt=${attempt + 1}`);

              if (attempt < RETRY_DELAYS_MS.length) {
                const delay = RETRY_DELAYS_MS[attempt];
                console.log(`[Request] retrying in ${delay}ms (attempt ${attempt + 2})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
              }

              // All retries exhausted — notify UI, do not surface as error
              console.log('[Provider] rate limited — all retries exhausted, skipping answer');
              this.events.onRateLimited?.(8000);
              return null;
            }

            if (!res.ok) {
              throw new Error(`Chat API status: ${res.status}`);
            }

            const data = await res.json();
            return data.answer || null;
          }
          return null;
        },
        this.sessionId
      );

      if (throttledAnswer) {
        this.state = PipelineState.ANSWER_COMPLETED;
        this.events.onAnswerGenerated?.(throttledAnswer);
      } else {
        console.log('[Pipeline] Final answer skipped (throttled, rate-limited, or empty)');
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Pipeline] Final answer request aborted (intentional)');
        this.isFinalGenerationActive = false;
        this.state = PipelineState.IDLE;
        return;
      }
      // 429 errors are already handled above and return null — this catches other failures
      console.error('[Pipeline] Final answer generation failed:', error);
      this.isFinalGenerationActive = false;
      this.state = PipelineState.ERROR;
      this.events.onPipelineError?.(error);
      return;
    }

    this.gracefulCleanup();
  }

  /**
   * Manually requests final response generation.
   * Uses the unified FinalizationDecisionEngine as the single validation authority.
   * Does NOT call shouldGenerateAnswer separately — the engine already covers all those checks.
   */
  public async requestFinalization(
    cvText: string = '',
    systemPrompt: string = '',
    overrideText?: string
  ): Promise<void> {
    // Guard: do not stack another finalization while one is active
    if (this.isFinalGenerationActive || this.state === PipelineState.GENERATING_ANSWER) {
      console.log('[Pipeline] requestFinalization skipped — final generation already active');
      return;
    }

    if (overrideText !== undefined) {
      clearBuffer();
      addChunk(overrideText);
    }

    const bufferedTranscript = getBufferedTranscript();
    console.log(`[Pipeline] Manual requestFinalization received for: "${bufferedTranscript}"`);

    // Run semantic analysis + dynamic threshold
    const stability = calculateStability(bufferedTranscript);
    const noise = calculateNoise(bufferedTranscript);
    const words = bufferedTranscript.trim().split(/\s+/).filter(Boolean);
    const semanticResult = await analyzeQuestionCompletion(bufferedTranscript, this.sessionId);
    const thresholdResult = calculateDynamicThreshold({
      transcriptLength: words.length,
      semanticConfidence: semanticResult.confidence,
      silenceDuration: 2000,
      transcriptStability: stability,
      noiseLevel: noise,
      speakingSpeed: 0.5
    });

    // Single unified decision — no separate canFinalizeTranscript or shouldGenerateAnswer call
    const decision = evaluateFinalization({
      transcript: bufferedTranscript,
      isComplete: semanticResult.isComplete,
      confidence: thresholdResult.adjustedConfidence,
      isManual: true, // Bypass completeness checks since user manually triggered this!
    });

    if (!decision.shouldGenerate) {
      console.log(`[ManualSubmit] final generation blocked — ${decision.reason}`);
      this.gracefulCleanup();
      return;
    }

    console.log('[Pipeline] Manual finalization approved.');
    await this.triggerAnswerGeneration(bufferedTranscript, cvText, systemPrompt);
  }
}
