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
 * Smart Trigger Controller to safely decide if the AI should generate a response.
 * Implements safety checks, cooldown, debounce, and strict semantic validation.
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

  // --- 3. Safety Protections ---
  const cleanText = transcript.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);

  // A. Length safety check
  if (words.length < 5) {
    return {
      shouldTrigger: false,
      confidence: 0.0,
      triggerReason: 'Safety: Transcript too short (< 5 words)'
    };
  }

  // B. Filler word safety check (e.g. if the transcript only consists of filler words or repeats)
  const fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'امم', 'اه', 'يعني'];
  const nonFillerWords = words.filter(w => !fillerWords.includes(w.toLowerCase()));
  if (nonFillerWords.length < 2) {
    return {
      shouldTrigger: false,
      confidence: 0.1,
      triggerReason: 'Safety: Transcript contains mostly repeated filler words or noise'
    };
  }

  // C. Noisy / Junk transcript safety check
  const junkPatterns = /^[!@#$%^&*()_+=\-\[\]{};':",.\/<>?؟\s]+$/;
  if (junkPatterns.test(cleanText)) {
    return {
      shouldTrigger: false,
      confidence: 0.0,
      triggerReason: 'Safety: Transcript contains only symbols/noise'
    };
  }

  // D. Unstable partial sentences check (ends with continuation words)
  const continuationWords = ['and', 'but', 'or', 'so', 'because', 'و', 'لكن', 'أو'];
  if (continuationWords.includes(words[words.length - 1].toLowerCase())) {
    return {
      shouldTrigger: false,
      confidence: 0.2,
      triggerReason: 'Safety: Unstable partial sentence ending in a conjunction'
    };
  }

  // --- 4. Evaluate Trigger Conditions ---
  // Must be semantically complete
  if (!semanticResult.isComplete) {
    return {
      shouldTrigger: false,
      confidence: semanticResult.confidence,
      triggerReason: `Semantic evaluation indicates incomplete: ${semanticResult.reason}`
    };
  }

  // Must exceed the confidence threshold (>= 0.75)
  if (semanticResult.confidence < 0.75) {
    return {
      shouldTrigger: false,
      confidence: semanticResult.confidence,
      triggerReason: `Semantic confidence (${semanticResult.confidence}) is below 0.75 threshold`
    };
  }

  console.log('[Trigger] confidence accepted');

  // Must have a minimum silence duration of 1.2 seconds (1200ms)
  if (silenceDuration <= 1200) {
    return {
      shouldTrigger: false,
      confidence: semanticResult.confidence,
      triggerReason: `Silence duration (${silenceDuration}ms) is below 1200ms threshold`
    };
  }

  // Must not be actively speaking (e.g. if voice detection registers talking)
  if (isUserSpeaking) {
    return {
      shouldTrigger: false,
      confidence: semanticResult.confidence,
      triggerReason: 'User is currently speaking'
    };
  }

  // --- 5. Approval ---
  console.log('[Trigger] answer approved');
  lastTriggerTime = Date.now(); // Reset cooldown

  return {
    shouldTrigger: true,
    confidence: semanticResult.confidence,
    triggerReason: 'All trigger conditions successfully satisfied and safety checks passed.'
  };
}
