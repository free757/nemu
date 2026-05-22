import { throttleAIRequest, openRouterFetch, getTranscriptHash } from './pipelineDebounce';

export interface CompletionResult {
  isComplete: boolean;
  confidence: number;
  reason: string;
}

// Common continuation phrases and words in both English and Arabic
const continuationPhrases = [
  'imagine if',
  'suppose you have',
  'and then',
  'such as',
  'for example',
  'what if',
  'because',
  'although',
  'so',
  'and',
  'but',
  'or',
  'like',
  'um',
  'uh',
  'تخيل لو',
  'مثلا',
  'يعني',
  'وبعدين',
  'مثل',
  'بسبب',
  'لكن',
  'أو',
  'و'
];

// Strong question indicators
const questionPatterns = [
  'right?',
  'correct?',
  'what do you think?',
  'how about you?',
  'do you agree?',
  'صح؟',
  'موافق؟',
  'ما رأيك؟',
  'أليس كذلك؟'
];

// Helper to check if text ends with a specific word/phrase cleanly
function endsWithPhrase(text: string, phrase: string): boolean {
  const normalizedText = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  const normalizedPhrase = phrase.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  
  if (normalizedText.endsWith(normalizedPhrase)) {
    const index = normalizedText.length - normalizedPhrase.length;
    return index === 0 || normalizedText[index - 1] === ' ';
  }
  return false;
}

function startsWithPhrase(text: string, prefix: string): boolean {
  const normalizedText = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, "");
  const normalizedPrefix = prefix.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, "");
  
  return normalizedText.startsWith(normalizedPrefix);
}

function isGrammaticallyComplete(text: string, words: string[]): boolean {
  if (words.length < 4) return false;
  
  // Make sure it doesn't end with a continuation phrase
  for (const phrase of continuationPhrases) {
    if (endsWithPhrase(text, phrase)) {
      return false;
    }
  }

  const normalizedWords = words.map(w => w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()؟?]/g, ""));
  
  const subjects = ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'who', 'what', 'how', 'why', 'this', 'that', 'someone', 'anyone', 'انا', 'انت', 'هو', 'هي', 'نحن', 'هم'];
  const verbs = [
    'is', 'am', 'are', 'was', 'were', 'do', 'does', 'did', 'have', 'has', 'had', 'go', 'went', 'feel', 'feeling', 
    'think', 'thinking', 'explain', 'explaining', 'describe', 'describing', 'tell', 'telling', 'walk', 'walking',
    'work', 'working', 'make', 'making', 'say', 'saying', 'get', 'getting', 'would', 'could', 'should', 'can',
    'like', 'want', 'need', 'see', 'know', 'happen', 'happens', 'يجري', 'يشعر', 'يفكر', 'يشرح', 'يصف', 'يقول', 'يعمل'
  ];

  const hasSubject = normalizedWords.some((w, idx) => idx < 3 && subjects.includes(w));
  const hasVerb = normalizedWords.some(w => verbs.includes(w));

  const isLengthAdequate = words.length >= 4;

  const naturalEndingWords = ['and', 'but', 'or', 'so', 'because', 'with', 'for', 'to', 'at', 'in', 'of', 'about', 'by', 'from', 'if', 'then', 'و', 'لكن', 'أو', 'في', 'من', 'إلى', 'عن', 'مع'];
  const lastWord = normalizedWords[normalizedWords.length - 1];
  const endsNaturally = !naturalEndingWords.includes(lastWord);

  return hasSubject && hasVerb && isLengthAdequate && endsNaturally;
}

const conversationalQuestionPrefixes = [
  'how are you',
  'what do you think',
  'can you explain',
  'could you describe',
  'why did you',
  'when would you',
  'tell me about',
  'walk me through'
];

const interviewPatterns = [
  'tell me about',
  'can you explain',
  'how would you',
  'describe a time',
  'what happens if'
];

/**
 * Evaluates whether an interviewer has finished their question or thought.
 * Uses lightweight local heuristics first, falling back to an LLM call if inconclusive.
 */
export async function analyzeQuestionCompletion(transcript: string, sessionId?: string): Promise<CompletionResult> {
  console.log(`[SemanticCompletion] Starting evaluation for: "${transcript}"`);
  
  if (!transcript || transcript.trim().length === 0) {
    console.log(`[SemanticCompletion] Incomplete: Empty transcript.`);
    return {
      isComplete: false,
      confidence: 0.0,
      reason: 'Empty transcript'
    };
  }

  const cleanText = transcript.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);

  let isConversational = false;
  let isInterviewPattern = false;

  for (const prefix of conversationalQuestionPrefixes) {
    if (startsWithPhrase(cleanText, prefix)) {
      isConversational = true;
      break;
    }
  }

  for (const prefix of interviewPatterns) {
    if (startsWithPhrase(cleanText, prefix)) {
      isInterviewPattern = true;
      break;
    }
  }

  const isGrammatical = isGrammaticallyComplete(cleanText, words);

  // If a strong completion pattern is matched, allow it to be 4 words or more
  const minWords = (isConversational || isInterviewPattern || isGrammatical) ? 4 : 5;

  // --- 1. Lightweight Heuristic: Length Check ---
  if (words.length < minWords) {
    console.log(`[SemanticCompletion] Incomplete: Short transcript (< ${minWords} words).`);
    return {
      isComplete: false,
      confidence: 0.0,
      reason: `Short transcript (< ${minWords} words)`
    };
  }

  // --- 2. Lightweight Heuristic: Ends with Question Mark ---
  if (cleanText.endsWith('?') || cleanText.endsWith('؟')) {
    console.log(`[SemanticCompletion] Complete: Ends with a physical question mark.`);
    return {
      isComplete: true,
      confidence: 1.0,
      reason: 'Ends with a question mark'
    };
  }

  // --- 3. Lightweight Heuristic: Continuation Phrases ---
  for (const phrase of continuationPhrases) {
    if (endsWithPhrase(cleanText, phrase)) {
      console.log(`[SemanticCompletion] Incomplete: Ends with continuation phrase "${phrase}".`);
      return {
        isComplete: false,
        confidence: 0.1,
        reason: `Ends with continuation phrase ("${phrase}")`
      };
    }
  }

  // --- 4. Lightweight Heuristic: Conversational / Interview / Grammatical Pattern Detection ---
  if (isConversational || isInterviewPattern || isGrammatical) {
    if (isConversational) {
      console.log('[SemanticCompletion] conversational question detected');
    }
    if (isInterviewPattern) {
      console.log('[SemanticCompletion] interview pattern detected');
    }
    if (isGrammatical) {
      console.log('[SemanticCompletion] grammatical completion detected');
    }

    // Boost confidence significantly
    const boostVal = (isConversational || isInterviewPattern) ? 0.98 : 0.90;

    console.log(`[SemanticCompletion] Complete: Local pattern matched. Confidence boosted to ${boostVal}.`);
    return {
      isComplete: true,
      confidence: boostVal,
      reason: `Pattern matched (conversational=${isConversational}, interview=${isInterviewPattern}, grammatical=${isGrammatical})`
    };
  }

  // --- 5. Lightweight Heuristic: Question Patterns ---
  for (const pattern of questionPatterns) {
    if (endsWithPhrase(cleanText, pattern)) {
      console.log(`[SemanticCompletion] Complete: Ends with question pattern "${pattern}".`);
      return {
        isComplete: true,
        confidence: 0.9,
        reason: `Ends with question pattern ("${pattern}")`
      };
    }
  }

  // --- 6. AI Fallback (Inconclusive Heuristics) ---
  console.log('[SemanticCompletion] Heuristics inconclusive. Falling back to LLM semantic analysis...');
  
  const throttledResult = await throttleAIRequest<CompletionResult>(
    'semantic',
    cleanText,
    async (signal) => {
      const openRouterKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        const res = await fetch('/api/check-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
          signal
        });
        if (res.ok) {
          const data = await res.json();
          return {
            isComplete: data.isComplete,
            confidence: data.isComplete ? 0.8 : 0.2,
            reason: 'LLM Evaluated (Client Fallback)'
          };
        }
        throw new Error('Client fallback failed');
      }

      const systemPrompt = `You are an AI semantic evaluator for live speech.
Your job is to read an ongoing transcript from an interviewer and determine if they have finished their thought or question.
Consider:
- Does the sentence end abruptly? (e.g., "So I was thinking about...") -> FALSE
- Is it a complete question? (e.g., "Can you tell me about a time you failed?") -> TRUE
- Does it sound logically complete? -> TRUE
If it is complete, reply with EXACTLY the word "TRUE".
If it is incomplete, reply with EXACTLY the word "FALSE".
Do not add punctuation or any other words.`;

      const requestId = crypto.randomUUID();
      const response = await openRouterFetch(
        requestId,
        'semantic',
        sessionId,
        getTranscriptHash(cleanText),
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Transcript:\n"${cleanText}"` },
          ],
          max_tokens: 5,
          temperature: 0.1,
        },
        signal
      );

      const data = await response.json();

      const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
      const isComplete = answer?.includes('TRUE') || false;

      console.log(`[SemanticCompletion] LLM Result: isComplete = ${isComplete} (Answer: "${answer}")`);
      return {
        isComplete,
        confidence: isComplete ? 0.85 : 0.15,
        reason: `LLM Evaluated (Answer: "${answer}")`
      };
    },
    sessionId
  );

  if (throttledResult === null) {
    return {
      isComplete: false,
      confidence: 0.5,
      reason: 'AI Request throttled/duplicated'
    };
  }

  return throttledResult;
}
