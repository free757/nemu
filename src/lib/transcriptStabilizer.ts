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
}

export interface StabilizeResult {
  stabilizedTranscript: string;
  stabilityScore: number;
  changesDetected: boolean;
}

/**
 * Core stabilization logic. Resolves overlaps, cleans noise, handles regression protection, 
 * and computes stability metrics on incoming speech updates.
 */
export function stabilizeTranscript({
  previousTranscript,
  incomingChunk
}: StabilizeParams): StabilizeResult {
  console.log('[Stabilizer] chunk received');

  const cleanIncoming = cleanTranscript(incomingChunk);
  const cleanPrev = cleanTranscript(previousTranscript);

  // --- 1. Ignore Noisy Micro-chunks ---
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

  // --- 2. Regression Protection ---
  // If the incoming chunk is shorter than what we already have and is fully contained as a prefix,
  // ignore it to prevent the UI from deleting stable, complete text.
  if (cleanPrev.toLowerCase().startsWith(cleanIncoming.toLowerCase()) && cleanIncoming.length < cleanPrev.length) {
    console.log('[Stabilizer] noisy chunk ignored');
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // --- 3. Duplicate check ---
  if (cleanPrev.toLowerCase().includes(cleanIncoming.toLowerCase())) {
    return {
      stabilizedTranscript: cleanPrev,
      stabilityScore: calculateTranscriptStability(cleanPrev),
      changesDetected: false
    };
  }

  // --- 4. Overlap & Continuation Reconciliation ---
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

  // C. Fallback: Join with a space (assume it's a new distinct sentence)
  const fallbackTranscript = `${cleanPrev} ${cleanIncoming}`;
  console.log('[Stabilizer] transcript stabilized');
  return {
    stabilizedTranscript: fallbackTranscript,
    stabilityScore: calculateTranscriptStability(fallbackTranscript),
    changesDetected: true
  };
}
