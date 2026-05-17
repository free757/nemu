import { stabilizeTranscript, cleanTranscript, calculateTranscriptStability } from '@/lib/transcriptStabilizer';
import { addChunk, getBufferedTranscript, clearBuffer } from '@/lib/incrementalBuffer';
import { analyzeQuestionCompletion } from '@/lib/semanticCompletion';
import { calculateDynamicThreshold, calculateStability, calculateNoise } from '@/lib/confidenceThreshold';
import { shouldGenerateAnswer } from '@/lib/smartTriggerController';
import { scheduleDelayedTrigger, cancelPendingTrigger, resetTriggerState } from '@/lib/delayedAutoTrigger';
import { startDraftPreGeneration, cancelDraftGeneration, clearDraft } from '@/lib/draftPreGenerator';

export enum PipelineState {
  IDLE,
  LISTENING,
  ANALYZING,
  PREPARING_DRAFT,
  WAITING_TRIGGER,
  GENERATING_ANSWER,
  SPEAKING,
  ERROR
}

export interface PipelineEvents {
  onTranscriptUpdate?: (transcript: string) => void;
  onDraftReady?: (draft: string) => void;
  onTriggerScheduled?: (delayMs: number) => void;
  onTriggerCancelled?: (reason: string) => void;
  onAnswerGenerated?: (answer: string) => void;
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

  constructor(private events: PipelineEvents = {}) {}

  /**
   * Registers or updates the pipeline event listeners.
   */
  public registerEvents(events: PipelineEvents) {
    this.events = { ...this.events, ...events };
  }

  /**
   * Resets the entire pipeline state, buffers, timers, and pre-generators.
   */
  public reset() {
    console.log('[Pipeline] Resetting entire pipeline orchestrator');
    this.state = PipelineState.IDLE;
    this.currentStabilizedTranscript = '';
    this.currentConfidenceScore = 1.0;
    this.latestSemanticConfidence = 0.0;
    this.latestDraft = '';
    this.isProcessing = false;
    
    clearBuffer();
    resetTriggerState();
    clearDraft();
  }

  /**
   * Gets the current pipeline state.
   */
  public getState(): PipelineState {
    return this.state;
  }

  /**
   * Gets the active stabilized transcript.
   */
  public getTranscript(): string {
    return this.currentStabilizedTranscript;
  }

  /**
   * Processing entry point for new incoming microphone speech segments.
   */
  public async processIncomingSpeech({
    chunk,
    isPartial,
    incomingConfidence,
    silenceDuration,
    isUserSpeaking,
    cvText = '',
    systemPrompt = ''
  }: ProcessSpeechParams): Promise<void> {
    
    // Protect against overlapping speech processing loops (race condition check)
    if (this.isProcessing) {
      return;
    }
    
    // Protect against stale processing if we are actively generating the final answer
    if (this.state === PipelineState.GENERATING_ANSWER) {
      return;
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

      // If no change or stability was recorded, stop early to optimize cycles
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

      // --- 3. Parallel Execution: Semantic Analysis & Draft Pre-generation ---
      // We run both tasks in parallel to optimize latency and minimize post-completion delay!
      this.state = PipelineState.ANALYZING;

      const [semanticResult] = await Promise.all([
        analyzeQuestionCompletion(bufferedTranscript),
        startDraftPreGeneration({
          transcript: bufferedTranscript,
          semanticResult: {
            isComplete: false, // dummy for early pre-generation check
            confidence: 0.7,
            reason: 'Parallel background run'
          },
          cvText,
          systemPrompt,
          onDraftUpdate: (draft) => {
            this.latestDraft = draft;
            console.log('[Pipeline] draft ready');
            this.events.onDraftReady?.(draft);
          }
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
        speakingSpeed: 0.5 // Normal default speaking speed index
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

        // Schedule confidence-based delayed trigger
        scheduleDelayedTrigger({
          transcript: bufferedTranscript,
          confidenceResult: thresholdResult,
          onTrigger: () => {
            // --- 7. Final Answer Generation Triggered ---
            this.triggerAnswerGeneration(bufferedTranscript, cvText, systemPrompt);
          },
          onCancel: (reason) => {
            console.log(`[Pipeline] Trigger cancelled: ${reason}`);
            this.state = PipelineState.LISTENING;
            this.events.onTriggerCancelled?.(reason);
          }
        });

        // Broadcast scheduled delay event (e.g. 600ms, 1000ms, 1400ms)
        const delayMs = thresholdResult.adjustedConfidence >= 0.90 ? 600 : thresholdResult.adjustedConfidence >= 0.80 ? 1000 : 1400;
        this.events.onTriggerScheduled?.(delayMs);
      } else {
        // If not triggering, keep state in listening or preparing draft
        this.state = this.latestDraft ? PipelineState.PREPARING_DRAFT : PipelineState.LISTENING;
      }

    } catch (error: any) {
      console.error('[Pipeline] Orchestrator processing error:', error);
      this.state = PipelineState.ERROR;
      this.events.onPipelineError?.(error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Finalizes the response generation, utilizing the background pre-generated draft if available
   * to guarantee zero-latency execution, or falling back to a direct, secure api call.
   */
  private async triggerAnswerGeneration(
    questionText: string,
    cvText: string,
    systemPrompt: string
  ): Promise<void> {
    // Prevent overlapping trigger executions (race condition protection)
    if (this.state === PipelineState.GENERATING_ANSWER) {
      return;
    }

    this.state = PipelineState.GENERATING_ANSWER;
    console.log('[Pipeline] answer generation started');

    // Clean up resources immediately to prepare for the next round
    cancelDraftGeneration();
    cancelPendingTrigger('manual');

    // LATENCY OPTIMIZATION WIN:
    // If our background Pre-Generator already successfully prepared a draft response,
    // we bypass making another API call entirely and serve it instantly!
    if (this.latestDraft) {
      console.log('[Pipeline] Serving pre-generated draft instantly!');
      this.events.onAnswerGenerated?.(this.latestDraft);
      this.reset();
      return;
    }

    // Fallback: If no draft was prepared (e.g. question finished too quickly), call API immediately
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: questionText,
          cvText,
          systemPrompt: systemPrompt || undefined
        })
      });

      if (!res.ok) {
        throw new Error(`Chat API status: ${res.status}`);
      }

      const data = await res.json();
      if (data.answer) {
        this.events.onAnswerGenerated?.(data.answer);
      } else {
        throw new Error('Chat API returned empty response');
      }

    } catch (error: any) {
      console.error('[Pipeline] Final answer generation failed:', error);
      this.state = PipelineState.ERROR;
      this.events.onPipelineError?.(error);
    } finally {
      this.reset();
    }
  }
}
