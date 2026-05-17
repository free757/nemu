export interface TranscriptChunk {
  text: string;
  timestamp: number;
}

// Module-level array holding the rolling transcript chunks
let chunks: TranscriptChunk[] = [];

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
 */
export function addChunk(chunk: string) {
  if (!chunk) return;
  
  const clean = cleanTranscriptText(chunk);
  
  // Ignore tiny noisy chunks
  if (clean.length < 2) {
    return;
  }
  
  // If buffer is empty, add it immediately
  if (chunks.length === 0) {
    chunks.push({ text: clean, timestamp: Date.now() });
    console.log('[Buffer] chunk added');
    trimOldChunks();
    return;
  }
  
  const lastChunk = chunks[chunks.length - 1];
  const lastText = lastChunk.text;
  
  // 1. Duplicate check (if the new chunk is completely contained in the last one)
  if (lastText.toLowerCase().includes(clean.toLowerCase())) {
    console.log('[Buffer] duplicate ignored');
    trimOldChunks();
    return;
  }
  
  // 2. Progressive replacement check (if the new chunk is a larger extension of the last one)
  if (clean.toLowerCase().includes(lastText.toLowerCase())) {
    lastChunk.text = clean;
    lastChunk.timestamp = Date.now();
    console.log('[Buffer] transcript stabilized');
    trimOldChunks();
    return;
  }
  
  // 3. Overlap check (if there is a progressive overlap)
  const merged = mergeOverlap(lastText, clean);
  if (merged) {
    lastChunk.text = merged;
    lastChunk.timestamp = Date.now();
    console.log('[Buffer] transcript stabilized');
    trimOldChunks();
    return;
  }
  
  // 4. Fallback: Add as a new distinct chunk
  chunks.push({ text: clean, timestamp: Date.now() });
  console.log('[Buffer] chunk added');
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
 * Clears the rolling transcript buffer.
 */
export function clearBuffer() {
  chunks = [];
}
