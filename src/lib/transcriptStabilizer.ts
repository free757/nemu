// Module-level variables for rapid chunk flood protection
let lastChunkTime = 0;
let lastChunkText = '';

/**
 * Cleans a transcript by:
 * 1. Normalizing spacing
 * 2. Filtering out filler words
 * 3. Removing consecutive duplicate words and duplicate phrases
 */
export function cleanTranscript(text: string): string {
  if (!text) return '';
  
  // Normalize spacing
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // 1. Filter out filler words
  const fillers = ['um', 'uh', 'hmm', 'like', 'you know', 'امم', 'اه', 'يعني'];
  const words = cleaned.split(/\s+/).filter(Boolean);
  const withoutFillers = words.filter(w => !fillers.includes(w.toLowerCase()));
  
  // 2. Remove consecutive duplicate words
  const deduplicatedWords: string[] = [];
  let duplicatesRemoved = false;
  for (let i = 0; i < withoutFillers.length; i++) {
    if (i === 0 || withoutFillers[i].toLowerCase() !== withoutFillers[i - 1].toLowerCase()) {
      deduplicatedWords.push(withoutFillers[i]);
    } else {
      duplicatesRemoved = true;
    }
  }

  let finalJoined = deduplicatedWords.join(' ');

  // 3. Remove duplicate adjacent phrases (e.g., "explain explain" or "how are you how are you")
  const mid = Math.floor(finalJoined.length / 2);
  for (let len = 1; len <= mid; len++) {
    const left = finalJoined.substring(finalJoined.length - len * 2, finalJoined.length - len);
    const right = finalJoined.substring(finalJoined.length - len);
    if (left.toLowerCase().trim() === right.toLowerCase().trim() && left.trim().length > 0) {
      duplicatesRemoved = true;
      finalJoined = finalJoined.substring(0, finalJoined.length - len).trim();
      break;
    }
  }

  if (duplicatesRemoved) {
    console.log('[Stabilizer] duplicate removed');
  }

  return finalJoined;
}

/**
 * Calculates stability of a transcript.
 * Returns score from 0.0 (highly unstable/stuttering) to 1.0 (fully stable).
 */
export function calculateTranscriptStability(text: string): number {
  if (!text || text.trim().length < 5) return 1.0;
  let score = 1.0;
  
  // Stutters penalization
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  let repeatCount = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      repeatCount++;
    }
  }
  score -= repeatCount * 0.15;

  // Unfinished cut-off markers penalization
  if (text.includes('...')) {
    score -= 0.2;
  }

  return Math.max(0.0, Math.min(1.0, score));
}

// Levenshtein distance helper for semantic similarity
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) tmp[i] = [i];
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

// Semantic similarity check
function isSemanticallySimilar(s1: string, s2: string): boolean {
  const len = Math.max(s1.length, s2.length);
  if (len === 0) return true;
  const dist = getLevenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
  return (dist / len) < 0.15; // less than 15% distance differences
}

// Internal overlap merging helper
function mergeOverlap(s1: string, s2: string): string | null {
  const w1 = s1.split(' ');
  const w2 = s2.split(' ');
  
  const maxOverlap = Math.min(w1.length, w2.length);
  for (let len = maxOverlap; len > 0; len--) {
    const w1End = w1.slice(-len).join(' ').toLowerCase();
    const w2Start = w2.slice(0, len).join(' ').toLowerCase();
    if (w1End === w2Start) {
      return [...w1.slice(0, w1.length - len), ...w2].join(' ');
    }
  }
  return null;
}

export interface StabilizeParams {
  previousTranscript: string;
  incomingChunk: string;
  previousConfidence?: number;
  incomingConfidence?: number;
  isPartial?: boolean;
  semanticConfidence?: number; // Trigger freeze mode if high
}

export interface StabilizeResult {
  stabilizedTranscript: string;
  stabilityScore: number;
  changesDetected: boolean;
}

/**
 * Enhanced production-grade stabilization logic. Resolves overlaps, cleans noise, handles regression protection,
 * prevents flood thrashing, manages confidence scoring weight, isPartial controls, and transcript freeze mode.
 */
export function stabilizeTranscript({
  previousTranscript,
  incomingChunk,
  previousConfidence,
  incomingConfidence,
  isPartial = true,
  semanticConfidence = 0.0
}: StabilizeParams): StabilizeResult {
  console.log('[Stabilizer] chunk received');

  const cleanIncoming = cleanTranscript(incomingChunk);
  const cleanPrev = cleanTranscript(previousTranscript);

  // --- 1. Flood Flood Protection ---
  const now = Date.now();
  if (cleanIncoming === lastChunkText && now - lastChunkTime < 150) {
    // Drop flood duplicate
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // Update flood state
  lastChunkTime = now;
  lastChunkText = cleanIncoming;

  // --- 2. Ignore Noisy Micro-chunks ---
  if (cleanIncoming.length < 2) {
    console.log('[Stabilizer] noisy chunk ignored');
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // If previous is empty, return cleaned incoming chunk directly
  if (!cleanPrev) {
    console.log('[Stabilizer] transcript stabilized');
    return {
      stabilizedTranscript: cleanIncoming,
      stabilityScore: calculateTranscriptStability(cleanIncoming),
      changesDetected: true
    };
  }

  // --- 3. Confidence-Weighted Stabilization ---
  if (
    incomingConfidence !== undefined &&
    previousConfidence !== undefined &&
    incomingConfidence < previousConfidence - 0.20
  ) {
    console.log('[Stabilizer] low confidence chunk rejected');
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // --- 4. Semantic Similarity Protection ---
  if (isSemanticallySimilar(cleanPrev, cleanIncoming)) {
    console.log('[Stabilizer] semantic similarity detected');
    // Prefer cleanPrev if it's already stabilized to avoid minor thrashing
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // --- 5. Transcript Freeze Mode ---
  if (semanticConfidence >= 0.85) {
    console.log('[Stabilizer] freeze mode enabled');
    // In freeze mode, we temporarily freeze replacement/deletion. Only allow appends!
    if (cleanIncoming.toLowerCase().startsWith(cleanPrev.toLowerCase())) {
      // Allowed refinement
      return {
        stabilizedTranscript: cleanIncoming,
        stabilityScore: calculateTranscriptStability(cleanIncoming),
        changesDetected: true
      };
    }
    // Block replacements
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // --- 6. Regression Protection (Cautious Partial Updates) ---
  if (isPartial) {
    // If the incoming chunk is shorter than previous and is fully contained as a prefix,
    // ignore regression to protect UI stable sentences.
    if (cleanPrev.toLowerCase().startsWith(cleanIncoming.toLowerCase()) && cleanIncoming.length < cleanPrev.length) {
      console.log('[Stabilizer] noisy chunk ignored');
      return {
        stabilizedTranscript: cleanPrev,
        stabilityScore: calculateTranscriptStability(cleanPrev),
        changesDetected: false
      };
    }
  }

  // --- 7. Duplicate Check ---
  if (cleanPrev.toLowerCase().includes(cleanIncoming.toLowerCase())) {
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // --- 8. Overlap & Continuation Reconciliation ---
  // A. Continuation check (if incoming is an exact larger extension of previous)
  if (cleanIncoming.toLowerCase().startsWith(cleanPrev.toLowerCase())) {
    console.log('[Stabilizer] transcript stabilized');
    return {
      stabilizedTranscript: cleanIncoming,
      stabilityScore: calculateTranscriptStability(cleanIncoming),
      changesDetected: true
    };
  }

  // B. Partial Overlap merge
  const merged = mergeOverlap(cleanPrev, cleanIncoming);
  if (merged) {
    console.log('[Stabilizer] transcript stabilized');
    return {
      stabilizedTranscript: merged,
      stabilityScore: calculateTranscriptStability(merged),
      changesDetected: true
    };
  }

  // C. Final Aggressive Replacement / Continuation
  if (!isPartial) {
    // Final chunks replace or append aggressively
    console.log('[Stabilizer] transcript stabilized');
    return {
      stabilizedTranscript: cleanIncoming,
      stabilityScore: calculateTranscriptStability(cleanIncoming),
      changesDetected: true
    };
  }

  // D. Fallback: Join with a space (assume it's a new distinct sentence)
  const fallbackTranscript = `${cleanPrev} ${cleanIncoming}`;
  console.log('[Stabilizer] transcript stabilized');
  return {
    stabilizedTranscript: fallbackTranscript,
    stabilityScore: calculateTranscriptStability(fallbackTranscript),
    changesDetected: true
  };
}
