/**
 * FinalizationDecisionEngine — Single Source of Truth for all finalization approval logic.
 *
 * ALL systems (smart trigger, manual finalization, auto trigger, delayed trigger,
 * answer generation) MUST use this engine. No scattered word-count checks or
 * fixed confidence thresholds anywhere else.
 */

// ---------------------------------------------------------------------------
// Centralized thresholds
// ---------------------------------------------------------------------------

export const MIN_CONFIDENCE = 0.70;    // Minimum composite confidence to approve
export const MIN_SILENCE_MS = 1200;    // Minimum silence before auto-trigger

// Legacy export preserved for callers that still import it
export const MIN_WORDS = 2;

// ---------------------------------------------------------------------------
// Shared word sets
// ---------------------------------------------------------------------------

export const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you know', 'actually', 'امم', 'اه', 'يعني'
]);

export const CONTINUATION_WORDS = new Set([
  'and', 'but', 'or', 'so', 'because', 'with', 'for', 'to', 'at', 'in',
  'of', 'about', 'by', 'from', 'if', 'then', 'و', 'لكن', 'أو', 'في', 'من', 'إلى', 'عن', 'مع'
]);

// ---------------------------------------------------------------------------
// Pattern libraries
// ---------------------------------------------------------------------------

const GREETING_PATTERNS = [
  /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|can you hear me|is this working|are you there|testing|test)\b/i,
  /^(مرحبا|السلام عليكم|أهلا|كيف حالك|هل تسمعني)\b/u,
];

const INTERVIEW_PATTERNS = [
  /^(tell me about|can you explain|how would you|describe a time|why did you|what is your|walk me through|what was|when did you|how did you|give me an example|have you ever|what do you think|how do you|could you describe|what happens if|what would you|talk me through)\b/i,
  /^(أخبرني عن|كيف ستتعامل|هل يمكنك أن تشرح|صف لي|لماذا اخترت|ما رأيك|ما هي تجربتك)\b/u,
];

const QUESTION_WORDS = new Set([
  'what', 'when', 'where', 'who', 'why', 'how', 'which', 'whose', 'whom',
  'ماذا', 'متى', 'أين', 'من', 'لماذا', 'كيف', 'أي'
]);

const JUNK_PATTERN = /^[!@#$%^&*()_+=\-\[\]{};':",./<>?؟\s]+$/;

// Character-repetition garbage detector (e.g. "gggggg", "asdfasdf", "hjkl")
const REPEATED_CHAR_PATTERN = /^(.)\1{3,}$/;
const KEYBOARD_MASH_PATTERN = /^[qwrtypsdfghjklzxcvbnm]{4,}$/i;

// ---------------------------------------------------------------------------
// Transcript evaluation result
// ---------------------------------------------------------------------------

export interface TranscriptEvaluation {
  isComplete: boolean;
  confidence: number;     // 0.0 – 1.0 composite signal score
  intent: string;         // 'greeting' | 'interview_question' | 'statement' | 'garbage' | 'fragment'
  reason: string;         // human-readable explanation
}

// ---------------------------------------------------------------------------
// evaluateTranscript: multi-signal semantic scoring
// ---------------------------------------------------------------------------

/**
 * Evaluates a raw transcript using multi-signal semantic scoring.
 * Replaces fixed word-count checks with intent detection, pattern matching,
 * and a composite confidence score.
 *
 * This function is PURE — it does not call any AI APIs.
 */
export function evaluateTranscript(transcript: string): TranscriptEvaluation {
  const cleanText = transcript.trim();
  const normalized = cleanText.toLowerCase().replace(/[?؟!.,]/g, '').trim();
  const words = normalized.split(/\s+/).filter(Boolean);

  // ---- Hard rejection: garbage/junk ----------------------------------------

  if (!cleanText || words.length === 0) {
    return { isComplete: false, confidence: 0.0, intent: 'garbage', reason: 'Empty transcript' };
  }

  if (JUNK_PATTERN.test(cleanText)) {
    console.log('[DecisionEngine] garbage rejected');
    return { isComplete: false, confidence: 0.0, intent: 'garbage', reason: 'Only symbols/noise' };
  }

  // Single-word keyboard mash (e.g. "gggg", "asdf")
  if (words.length === 1) {
    const w = words[0];
    if (REPEATED_CHAR_PATTERN.test(w) || KEYBOARD_MASH_PATTERN.test(w)) {
      console.log('[DecisionEngine] garbage rejected');
      return { isComplete: false, confidence: 0.0, intent: 'garbage', reason: `Keyboard mash detected: "${w}"` };
    }
  }

  // Filler-only check
  const nonFillerWords = words.filter(w => !FILLER_WORDS.has(w));
  if (nonFillerWords.length === 0) {
    console.log('[DecisionEngine] garbage rejected');
    return { isComplete: false, confidence: 0.0, intent: 'garbage', reason: 'Only filler words' };
  }

  // ---- Ends with continuation word (always fragment) ----------------------
  const lastWord = words[words.length - 1];
  if (CONTINUATION_WORDS.has(lastWord)) {
    return {
      isComplete: false,
      confidence: 0.1,
      intent: 'fragment',
      reason: `Ends with continuation word "${lastWord}"`,
    };
  }

  // ---- Signal scoring ------------------------------------------------------
  let score = 0.0;
  let intent: TranscriptEvaluation['intent'] = 'statement';
  const signals: string[] = [];

  // Signal: question mark
  if (cleanText.endsWith('?') || cleanText.endsWith('؟')) {
    score += 0.40;
    signals.push('question_mark(+0.40)');
  }

  // Signal: greeting detection (short inputs like "hello", "hi", "how are you")
  let isGreeting = false;
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(normalized)) {
      isGreeting = true;
      break;
    }
  }
  if (isGreeting) {
    // A greeting is a complete utterance by definition.
    // Short-circuit: return immediately with isComplete=true and a score that always clears the threshold.
    const greetingScore = Math.max(0.75, score + 0.45);
    console.log('[DecisionEngine] greeting detected');
    console.log(`[DecisionEngine] semantic confidence accepted (score=${greetingScore.toFixed(2)}, intent=greeting)`);
    return {
      isComplete: true,
      confidence: greetingScore,
      intent: 'greeting',
      reason: `Approved [greeting(+0.45), guaranteed_complete]`,
    };
  }

  // Signal: interview pattern
  let isInterviewPattern = false;
  for (const pattern of INTERVIEW_PATTERNS) {
    if (pattern.test(normalized)) {
      isInterviewPattern = true;
      break;
    }
  }
  if (isInterviewPattern) {
    // An interview question opener is a structurally complete intent.
    // Short-circuit: return immediately with isComplete=true and a high confidence score.
    const interviewScore = Math.max(0.80, score + 0.45);
    console.log('[DecisionEngine] interview pattern matched');
    console.log(`[DecisionEngine] semantic confidence accepted (score=${interviewScore.toFixed(2)}, intent=interview_question)`);
    return {
      isComplete: true,
      confidence: interviewScore,
      intent: 'interview_question',
      reason: `Approved [interview_pattern(+0.45), guaranteed_complete]`,
    };
  }

  // Signal: starts with a question word
  if (QUESTION_WORDS.has(words[0])) {
    score += 0.20;
    signals.push('question_word(+0.20)');
  }

  // Signal: grammatical completeness heuristic (subject + verb structure)
  const subjectWords = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'how', 'why', 'who', 'انا', 'انت', 'هو', 'هي', 'نحن', 'هم']);
  const verbWords = new Set([
    'is', 'am', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had',
    'can', 'could', 'would', 'should', 'will', 'may', 'might',
    'feel', 'think', 'know', 'work', 'explain', 'describe', 'tell', 'want', 'need', 'like', 'go', 'get', 'make',
    'يشعر', 'يفكر', 'يعمل', 'يشرح', 'يصف', 'يقول', 'يريد'
  ]);
  const hasSubject = words.some((w, i) => i < 3 && subjectWords.has(w));
  const hasVerb = words.some(w => verbWords.has(w));
  if (hasSubject && hasVerb) {
    score += 0.20;
    signals.push('subject_verb(+0.20)');
  }

  // Signal: adequate meaningful word count (non-filler)
  if (nonFillerWords.length >= 3) {
    score += 0.10;
    signals.push('word_count(+0.10)');
  }

  // Signal: semantic stability (no repeated identical words across the whole phrase)
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  if (words.length > 2 && repetitionRatio > 0.6) {
    score += 0.05;
    signals.push('semantic_stability(+0.05)');
  }

  // Penalty: single meaningless word (no patterns matched)
  if (words.length === 1 && !isGreeting && !isInterviewPattern) {
    score -= 0.50;
    signals.push('single_word_penalty(-0.50)');
  }

  // Penalty: very high repetition (keyboard mash style)
  if (words.length > 1 && repetitionRatio < 0.4) {
    score -= 0.30;
    signals.push('repetition_penalty(-0.30)');
  }

  // Clamp score to [0, 1]
  score = Math.max(0.0, Math.min(1.0, score));

  const isComplete = score >= MIN_CONFIDENCE;
  const reason = isComplete
    ? `Approved [${signals.join(', ')}]`
    : `Rejected: score ${score.toFixed(2)} < ${MIN_CONFIDENCE} [${signals.join(', ')}]`;

  if (isComplete) {
    console.log(`[DecisionEngine] semantic confidence accepted (score=${score.toFixed(2)}, intent=${intent})`);
  }

  return { isComplete, confidence: score, intent, reason };
}

// ---------------------------------------------------------------------------
// Finalization decision result (used by pipeline)
// ---------------------------------------------------------------------------

export interface FinalizationDecision {
  shouldGenerate: boolean;
  isComplete: boolean;
  confidence: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Input parameters for evaluateFinalization
// ---------------------------------------------------------------------------

export interface DecisionParams {
  transcript: string;
  isComplete: boolean;          // From SemanticCompletion layer
  confidence: number;           // From SemanticCompletion + dynamic threshold
  silenceDuration?: number;     // ms — optional for manual triggers
  isUserSpeaking?: boolean;     // optional — assumed false for manual triggers
  isManual?: boolean;           // optional — set true to bypass completeness checks for manual clicks
}

// ---------------------------------------------------------------------------
// evaluateFinalization: pipeline gate combining semantic eval + pipeline signals
// ---------------------------------------------------------------------------

/**
 * Unified finalization gate used by ALL approval paths.
 *
 * Strategy:
 * 1. Run evaluateTranscript() for multi-signal local scoring.
 * 2. Combine with SemanticCompletion's isComplete + adjusted confidence.
 * 3. If either source gives strong approval, accept.
 * 4. Apply pipeline-level gates (silence, speaking) last.
 */
export function evaluateFinalization({
  transcript,
  isComplete,
  confidence,
  silenceDuration,
  isUserSpeaking = false,
  isManual = false,
}: DecisionParams): FinalizationDecision {

  // Run local multi-signal evaluation
  const localEval = evaluateTranscript(transcript);

  // Hard rejections from local eval (garbage, filler-only, fragment)
  if (localEval.intent === 'garbage') {
    return {
      shouldGenerate: false,
      isComplete: false,
      confidence: 0.0,
      reason: localEval.reason,
    };
  }

  // If this is a manual submission (user explicitly pressed Send / finalized), bypass completeness checks!
  if (isManual) {
    console.log('[DecisionEngine] Approved manual request override');
    return {
      shouldGenerate: true,
      isComplete: true,
      confidence: 1.0,
      reason: 'Approved: Manual request override',
    };
  }

  // Continuation-word fragment
  if (!localEval.isComplete && localEval.confidence < 0.15) {
    return {
      shouldGenerate: false,
      isComplete: false,
      confidence: localEval.confidence,
      reason: localEval.reason,
    };
  }

  // Compute best available confidence:
  // Use the higher of (local score, semantic layer confidence).
  // This prevents the semantic layer from being overruled by a stricter local check.
  const bestConfidence = Math.max(localEval.confidence, confidence);

  // Determine completion: either source can approve
  const effectiveComplete = isComplete || localEval.isComplete;

  if (!effectiveComplete) {
    console.log('[DecisionEngine] rejected by semantic incompleteness');
    return {
      shouldGenerate: false,
      isComplete: false,
      confidence: bestConfidence,
      reason: `Rejected: neither semantic nor local eval approved (localScore=${localEval.confidence.toFixed(2)}, semanticScore=${confidence.toFixed(2)})`,
    };
  }

  if (bestConfidence < MIN_CONFIDENCE) {
    console.log('[DecisionEngine] rejected by confidence');
    return {
      shouldGenerate: false,
      isComplete: effectiveComplete,
      confidence: bestConfidence,
      reason: `Rejected: best confidence (${bestConfidence.toFixed(2)}) below threshold (${MIN_CONFIDENCE})`,
    };
  }

  // Pipeline-level timing gates (auto-trigger paths only)
  if (silenceDuration !== undefined && silenceDuration <= MIN_SILENCE_MS) {
    return {
      shouldGenerate: false,
      isComplete: effectiveComplete,
      confidence: bestConfidence,
      reason: `Rejected: silence duration (${silenceDuration}ms) below ${MIN_SILENCE_MS}ms threshold`,
    };
  }

  if (isUserSpeaking) {
    return {
      shouldGenerate: false,
      isComplete: effectiveComplete,
      confidence: bestConfidence,
      reason: 'Rejected: user is currently speaking',
    };
  }

  // Approved
  console.log('[DecisionEngine] finalization approved');
  return {
    shouldGenerate: true,
    isComplete: effectiveComplete,
    confidence: bestConfidence,
    reason: `Approved (local=${localEval.confidence.toFixed(2)}, semantic=${confidence.toFixed(2)}, intent=${localEval.intent})`,
  };
}
