export enum TriggerState {
  IDLE,
  WAITING,
  CANCELLED,
  TRIGGERED
}

interface ConfidenceResult {
  threshold: number;
  adjustedConfidence: number;
  decision: 'trigger' | 'wait' | 'uncertain';
  reason: string;
}

interface ScheduleParams {
  transcript: string;
  confidenceResult: ConfidenceResult;
  delayMs?: number; // Manual override if provided
  onTrigger: () => void;
  onCancel?: (reason: string) => void;
}

// Module-level state tracking
let currentState: TriggerState = TriggerState.IDLE;
let activeTimeout: NodeJS.Timeout | null = null;
let currentTranscript: string = '';
let currentConfidence: number = 0;
let lastTranscriptChangeTime: number = 0;

/**
 * Cancels any active pending trigger timeout.
 */
export function cancelPendingTrigger(reason: 'speech' | 'confidence' | 'reset' | 'manual' = 'manual', onCancel?: (r: string) => void) {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  
  if (currentState === TriggerState.WAITING) {
    currentState = TriggerState.CANCELLED;
    
    if (reason === 'speech') {
      console.log('[DelayedTrigger] cancelled by speech');
    } else if (reason === 'confidence') {
      console.log('[DelayedTrigger] confidence dropped');
    } else {
      console.log(`[DelayedTrigger] cancelled: ${reason}`);
    }

    if (onCancel) {
      onCancel(reason);
    }
  }
}

/**
 * Resets the entire delayed trigger controller state.
 */
export function resetTriggerState() {
  cancelPendingTrigger('reset');
  currentState = TriggerState.IDLE;
  currentTranscript = '';
  currentConfidence = 0;
  lastTranscriptChangeTime = 0;
}

/**
 * Schedules a delayed trigger for speech completion.
 * Monitors changes in transcript and confidence continuously to execute or abort.
 */
export function scheduleDelayedTrigger({
  transcript,
  confidenceResult,
  delayMs,
  onTrigger,
  onCancel
}: ScheduleParams): void {
  const cleanTranscript = transcript.trim();
  const confidence = confidenceResult.adjustedConfidence;

  // --- 1. Track transcript changes for stabilization (Debounce) ---
  if (cleanTranscript !== currentTranscript) {
    lastTranscriptChangeTime = Date.now();
    
    // If we were already waiting, new speech has arrived, so cancel it!
    if (currentState === TriggerState.WAITING) {
      cancelPendingTrigger('speech', onCancel);
      currentTranscript = cleanTranscript;
      return;
    }
    
    currentTranscript = cleanTranscript;
  }

  // --- 2. Determine Trigger Delay based on confidence ---
  let calculatedDelay = 0;
  if (confidence >= 0.90) {
    calculatedDelay = 600;
  } else if (confidence >= 0.80) {
    calculatedDelay = 1000;
  } else if (confidence >= 0.70) {
    calculatedDelay = 1400;
  } else {
    // Below 0.70 -> no trigger at all!
    if (currentState === TriggerState.WAITING) {
      cancelPendingTrigger('confidence', onCancel);
    }
    return;
  }

  const finalDelayMs = delayMs !== undefined ? delayMs : calculatedDelay;

  // If confidence drops significantly compared to what we scheduled with, cancel!
  if (currentState === TriggerState.WAITING && confidence < currentConfidence - 0.05) {
    cancelPendingTrigger('confidence', onCancel);
    return;
  }

  // Update tracking confidence
  currentConfidence = confidence;

  // --- 3. Prevent Duplicate Scheduled Triggers ---
  // If we are already waiting for the exact same transcript, do not restart the timer!
  if (currentState === TriggerState.WAITING) {
    console.log('[DelayedTrigger] waiting');
    return;
  }

  // --- 4. Debounce Protection (500ms Stabilization) ---
  const timeSinceLastChange = Date.now() - lastTranscriptChangeTime;
  if (timeSinceLastChange < 500) {
    // Transcript is still changing rapidly; defer scheduling until it stabilizes
    return;
  }

  // --- 5. Schedule Delayed Execution ---
  currentState = TriggerState.WAITING;
  console.log(`[DelayedTrigger] scheduled (Delay: ${finalDelayMs}ms)`);

  activeTimeout = setTimeout(() => {
    console.log('[DelayedTrigger] executing trigger');
    currentState = TriggerState.TRIGGERED;
    onTrigger();
    resetTriggerState();
  }, finalDelayMs);
}
