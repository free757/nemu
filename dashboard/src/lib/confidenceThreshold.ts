export interface ThresholdParams {
  transcriptLength: number; // word count
  semanticConfidence: number; // 0.0 to 1.0
  silenceDuration: number; // in milliseconds
  transcriptStability: number; // 0.0 to 1.0 (unstable to stable)
  noiseLevel: number; // 0.0 to 1.0 (clean to noisy)
  speakingSpeed: number; // words per minute or index (e.g. 0.0 to 1.0)
}

export interface ThresholdResult {
  threshold: number;
  adjustedConfidence: number;
  decision: 'trigger' | 'wait' | 'uncertain';
  reason: string;
}

/**
 * Calculates stability of a transcript text.
 * Returns score from 0.0 (highly unstable/stuttering) to 1.0 (fully stable).
 */
export function calculateStability(transcript: string): number {
  if (!transcript) return 1.0;
  let score = 1.0;
  const clean = transcript.trim().toLowerCase();
  
  // 1. Stuttering/Repetitions check
  const words = clean.split(/\s+/).filter(Boolean);
  let repetitions = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      repetitions++;
    }
  }
  if (repetitions > 0) {
    score -= repetitions * 0.15;
  }

  // 2. Unfinished/cut-off word pattern (e.g. "depen...", "dep...")
  const cutOffCount = (clean.match(/\w+\.\.\./g) || []).length;
  if (cutOffCount > 0) {
    score -= cutOffCount * 0.2;
  }

  const result = Math.max(0.0, Math.min(1.0, score));
  if (result < 0.6) {
    console.log('[Confidence] transcript unstable');
  }
  return result;
}

/**
 * Calculates noise level of a transcript.
 * Returns score from 0.0 (clean) to 1.0 (very noisy).
 */
export function calculateNoise(transcript: string): number {
  if (!transcript) return 0.0;
  const clean = transcript.trim().toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0.0;

  let noiseScore = 0.0;

  // 1. Filler words frequency
  const fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'يعني', 'اه', 'امم'];
  const fillerCount = words.filter(w => fillers.includes(w)).length;
  noiseScore += (fillerCount / words.length) * 0.6; // Fillers represent up to 60% of noise

  // 2. Junk symbols
  const junkRatio = (clean.replace(/[a-zA-Z0-9\s]/g, '').length) / clean.length;
  if (junkRatio > 0.2) {
    noiseScore += 0.3;
  }

  return Math.max(0.0, Math.min(1.0, noiseScore));
}

/**
 * Dynamically adjusts the confidence threshold and makes a trigger decision based on real-time factors.
 */
export function calculateDynamicThreshold({
  transcriptLength,
  semanticConfidence,
  silenceDuration,
  transcriptStability,
  noiseLevel,
  speakingSpeed
}: ThresholdParams): ThresholdResult {
  let threshold = 0.75; // Base threshold
  let adjustedConfidence = semanticConfidence;

  const logs: string[] = [];

  // --- 1. Adjust Threshold based on signals ---

  // Raise threshold for negative signals (Strict Mode)
  if (transcriptStability < 0.6) {
    threshold += 0.1;
    logs.push('low stability (+0.1)');
  }
  
  if (noiseLevel > 0.5) {
    threshold += 0.08;
    console.log('[Confidence] threshold raised');
    logs.push('high noise (+0.08)');
  }

  if (transcriptLength < 6) {
    threshold += 0.07;
    logs.push('short transcript (+0.07)');
  }

  if (speakingSpeed > 0.8) {
    // Fast speaking implies the user might still be in full thought
    threshold += 0.05;
    logs.push('high speaking speed (+0.05)');
  }

  // Lower threshold for positive signals (Relaxed Mode)
  if (transcriptStability > 0.85) {
    threshold -= 0.05;
    logs.push('high stability (-0.05)');
  }

  if (silenceDuration > 2500) {
    threshold -= 0.1;
    logs.push('long silence (-0.1)');
  }

  if (semanticConfidence > 0.9) {
    threshold -= 0.05;
    logs.push('high semantic confidence (-0.05)');
  }

  // Bound threshold between 0.55 and 0.95
  threshold = Math.max(0.55, Math.min(0.95, threshold));

  // --- 2. Calculate Adjusted Confidence ---
  // Unstable and noisy signals penalize the final confidence score
  adjustedConfidence = semanticConfidence * (0.4 + 0.6 * transcriptStability) * (1.0 - noiseLevel * 0.35);
  adjustedConfidence = Math.max(0.0, Math.min(1.0, adjustedConfidence));

  // --- 3. Determine Trigger Decision (Adaptive Trigger Modes) ---
  let decision: 'trigger' | 'wait' | 'uncertain' = 'wait';
  let reason = '';

  if (adjustedConfidence >= threshold) {
    if (adjustedConfidence >= 0.82) {
      decision = 'trigger'; // High confidence -> Immediate trigger
      console.log('[Confidence] trigger approved');
      reason = 'High confidence trigger approved.';
    } else {
      decision = 'uncertain'; // Medium confidence -> Delayed trigger/uncertain
      reason = 'Threshold exceeded but confidence is medium; caution advised.';
    }
  } else {
    decision = 'wait'; // Low confidence -> Wait
    reason = `Adjusted confidence (${adjustedConfidence.toFixed(2)}) is below threshold (${threshold.toFixed(2)}).`;
  }

  const finalReason = `${reason} Signals: [${logs.join(', ')}]. Adjusted Confidence: ${adjustedConfidence.toFixed(2)}, Threshold: ${threshold.toFixed(2)}`;

  return {
    threshold,
    adjustedConfidence,
    decision,
    reason: finalReason
  };
}
