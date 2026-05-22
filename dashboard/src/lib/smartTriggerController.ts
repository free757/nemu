import { evaluateFinalization, MIN_SILENCE_MS } from './finalizationDecisionEngine';

export interface SemanticResult {
  isComplete: boolean;
  confidence: number;
  reason: string;
}

export interface TriggerParams {
  transcript: string;
  semanticResult: SemanticResult;
  silenceDuration: number; // in milliseconds
  isUserSpeaking: boolean;
}

export interface TriggerResult {
  shouldTrigger: boolean;
  confidence: number;
  triggerReason: string;
}

// Module-level state to track the last approved trigger time (for the 8-second cooldown)
let lastTriggerTime = 0;

/**
 * Smart Trigger Controller — decides if the AI should generate a response.
 * Delegates ALL content validation to the FinalizationDecisionEngine to ensure
 * zero divergence from the manual finalization path.
 */
export async function shouldGenerateAnswer({
  transcript,
  semanticResult,
  silenceDuration,
  isUserSpeaking
}: TriggerParams): Promise<TriggerResult> {
  const now = Date.now();
  const timeSinceLastTrigger = now - lastTriggerTime;

  // --- 1. Cooldown System (8 Seconds) ---
  if (timeSinceLastTrigger < 8000) {
    console.log('[Trigger] blocked by cooldown');
    return {
      shouldTrigger: false,
      confidence: 0.0,
      triggerReason: `Blocked by cooldown. ${Math.ceil((8000 - timeSinceLastTrigger) / 1000)}s remaining.`
    };
  }

  // --- 2. Debounce Delay (500ms) ---
  console.log('[Trigger] waiting');
  await new Promise(resolve => setTimeout(resolve, 500));

  // --- 3. Unified content + semantic validation via DecisionEngine ---
  const decision = evaluateFinalization({
    transcript,
    isComplete: semanticResult.isComplete,
    confidence: semanticResult.confidence,
    silenceDuration,
    isUserSpeaking,
  });

  if (!decision.shouldGenerate) {
    return {
      shouldTrigger: false,
      confidence: decision.confidence,
      triggerReason: decision.reason,
    };
  }

  // --- 4. Approval ---
  console.log('[Trigger] answer approved');
  lastTriggerTime = Date.now();

  return {
    shouldTrigger: true,
    confidence: decision.confidence,
    triggerReason: 'All trigger conditions successfully satisfied and safety checks passed.'
  };
}
