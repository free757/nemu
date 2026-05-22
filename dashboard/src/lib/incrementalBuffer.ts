export interface TranscriptChunk {
  text: string;
  timestamp: number;
}

// Module-level array holding the rolling transcript chunks
let chunks: TranscriptChunk[] = [];

// Rolling dedupe window: tracks the last N accepted transcript texts
const DEDUPE_WINDOW_SIZE = 5;
let recentAcceptedTexts: string[] = [];

// Helper to clean up a chunk
function cleanTranscriptText(text: string): string {
  // Normalize whitespace (remove tabs, newlines, extra spaces)
  let cleaned = text.replace(/\s+/g, ' ').trim();
  
  // Remove repeated consecutive words
  const words = cleaned.split(' ');
  const uniqueWords = words.filter((w, i) => i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase());
  return uniqueWords.join(' ');
}

// Helper to merge partial transcript updates with overlap detection
function mergeOverlap(s1: string, s2: string): string | null {
  const w1 = s1.split(' ');
  const w2 = s2.split(' ');
  
  // Find the longest overlap at the end of s1 and beginning of s2
  const maxOverlap = Math.min(w1.length, w2.length);
  for (let len = maxOverlap; len > 0; len--) {
    const w1End = w1.slice(-len).join(' ').toLowerCase();
    const w2Start = w2.slice(0, len).join(' ').toLowerCase();
    if (w1End === w2Start) {
      // Overlap found! Merge the non-overlapping prefix of s1 with the entirety of s2
      return [...w1.slice(0, w1.length - len), ...w2].join(' ');
    }
  }
  return null;
}

/**
 * Computes a normalized similarity score between two strings (0.0–1.0).
 * Uses word-level Jaccard similarity for fast, punctuation-independent comparison.
 */
function computeSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, '').trim();

  const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersection = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) intersection++; });

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}

/**
 * Checks whether a new chunk is meaningfully different from recent accepted texts.
 * Returns true if the chunk is novel enough to accept.
 */
function isMeaningfullyDifferent(newText: string): boolean {
  // Exact duplicate against the rolling dedupe window
  const normalizedNew = newText.toLowerCase().trim();
  for (const prev of recentAcceptedTexts) {
    if (prev.toLowerCase().trim() === normalizedNew) {
      console.log('[Buffer] duplicate prevented');
      return false;
    }
  }

  // Semantic similarity check against the last accepted text
  if (recentAcceptedTexts.length > 0) {
    const lastAccepted = recentAcceptedTexts[recentAcceptedTexts.length - 1];
    const similarity = computeSimilarity(newText, lastAccepted);

    // If similarity is >= 0.92, treat as semantic duplicate (very minor word variation)
    if (similarity >= 0.92) {
      console.log('[Buffer] semantic duplicate ignored');
      return false;
    }

    // If the new chunk is shorter than or equal to last accepted AND similarity > 0.75,
    // it's a regression (partial capture of already-accepted text) — ignore it
    const newWords = newText.trim().split(/\s+/).filter(Boolean).length;
    const lastWords = lastAccepted.trim().split(/\s+/).filter(Boolean).length;
    if (newWords <= lastWords && similarity > 0.75) {
      console.log('[Buffer] semantic duplicate ignored');
      return false;
    }
  }

  return true;
}

/**
 * Registers a text as accepted into the rolling dedupe window.
 */
function recordAccepted(text: string) {
  recentAcceptedTexts.push(text);
  if (recentAcceptedTexts.length > DEDUPE_WINDOW_SIZE) {
    recentAcceptedTexts.shift();
  }
}

/**
 * Trims transcript chunks that are older than the 45-second buffer limit.
 */
function trimOldChunks() {
  const threshold = Date.now() - 45000; // 45 seconds
  const initialLength = chunks.length;
  chunks = chunks.filter(c => c.timestamp >= threshold);
  
  if (chunks.length < initialLength) {
    console.log('[Buffer] old chunks removed');
  }
}

/**
 * Adds a new transcript chunk to the rolling buffer.
 * Automatically merges partial overlaps, ignores duplicates, and cleans up filler/repeated text.
 * Includes buffer-level semantic deduplication and rolling dedupe window.
 */
export function addChunk(chunk: string) {
  if (!chunk) return;
  
  const clean = cleanTranscriptText(chunk);
  
  // Ignore tiny noisy chunks
  if (clean.length < 2) {
    return;
  }
  
  // If buffer is empty, accept immediately
  if (chunks.length === 0) {
    if (!isMeaningfullyDifferent(clean)) {
      trimOldChunks();
      return;
    }
    chunks.push({ text: clean, timestamp: Date.now() });
    recordAccepted(clean);
    console.log('[Buffer] meaningful transcript update accepted');
    trimOldChunks();
    return;
  }
  
  const lastChunk = chunks[chunks.length - 1];
  const lastText = lastChunk.text;
  
  // 1. Exact duplicate check (new chunk completely contained in last chunk)
  if (lastText.toLowerCase().includes(clean.toLowerCase())) {
    console.log('[Buffer] duplicate prevented');
    trimOldChunks();
    return;
  }
  
  // 2. Progressive replacement check (new chunk is a larger extension of last)
  if (clean.toLowerCase().includes(lastText.toLowerCase())) {
    // Before accepting, verify against dedupe window
    if (!isMeaningfullyDifferent(clean)) {
      trimOldChunks();
      return;
    }
    lastChunk.text = clean;
    lastChunk.timestamp = Date.now();
    recordAccepted(clean);
    console.log('[Buffer] meaningful transcript update accepted');
    trimOldChunks();
    return;
  }
  
  // 3. Overlap merge check (progressive word overlap between last and new)
  const merged = mergeOverlap(lastText, clean);
  if (merged) {
    if (!isMeaningfullyDifferent(merged)) {
      trimOldChunks();
      return;
    }
    lastChunk.text = merged;
    lastChunk.timestamp = Date.now();
    recordAccepted(merged);
    console.log('[Buffer] meaningful transcript update accepted');
    trimOldChunks();
    return;
  }

  // 4. Global semantic duplicate check before appending a new distinct chunk
  if (!isMeaningfullyDifferent(clean)) {
    trimOldChunks();
    return;
  }
  
  // 5. Fallback: Add as a new distinct chunk
  chunks.push({ text: clean, timestamp: Date.now() });
  recordAccepted(clean);
  console.log('[Buffer] meaningful transcript update accepted');
  trimOldChunks();
}

/**
 * Returns the fully stabilized transcript within the buffer.
 */
export function getBufferedTranscript(): string {
  trimOldChunks();
  return chunks.map(c => c.text).join(' ').trim();
}

/**
 * Returns the transcript accumulated within the last X seconds (defaults to 30s).
 */
export function getRecentWindow(seconds: number = 30): string {
  const threshold = Date.now() - (seconds * 1000);
  return chunks
    .filter(c => c.timestamp >= threshold)
    .map(c => c.text)
    .join(' ')
    .trim();
}

/**
 * Clears the rolling transcript buffer and the dedupe window.
 */
export function clearBuffer() {
  chunks = [];
  recentAcceptedTexts = [];
}
