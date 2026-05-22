export function sanitizeTranscript(transcript: string): string {
  if (!transcript) return '';

  // 1. Normalize whitespace (remove extra spaces, tabs, newlines)
  let cleaned = transcript.replace(/\s+/g, ' ').trim();

  // 2. Remove filler words (case-insensitive)
  // Added common English and Arabic filler words
  const fillerWords = [
    'um', 'uh', 'like', 'you know', 'actually', 'basically', 'literally',
    'اه', 'امم', 'يعني'
  ];
  
  // Create a regex to match filler words as whole words
  const fillerRegex = new RegExp(`\\b(${fillerWords.join('|')})\\b`, 'gi');
  cleaned = cleaned.replace(fillerRegex, '');

  // Normalize whitespace again after removing fillers
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 3. Remove consecutive repeated words
  // e.g. "hello hello hello" -> "hello"
  const words = cleaned.split(' ');
  const uniqueWords = words.filter((word, index) => {
    // Keep the word if it's the first word, or if it's different from the PREVIOUS word
    return index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase();
  });

  return uniqueWords.join(' ');
}
