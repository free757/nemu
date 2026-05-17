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

/**
 * Evaluates whether an interviewer has finished their question or thought.
 * Uses lightweight local heuristics first, falling back to an LLM call if inconclusive.
 */
export async function analyzeQuestionCompletion(transcript: string): Promise<CompletionResult> {
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

  // --- 1. Lightweight Heuristic: Length Check ---
  if (words.length < 5) {
    console.log(`[SemanticCompletion] Incomplete: Short transcript (< 5 words).`);
    return {
      isComplete: false,
      confidence: 0.0,
      reason: 'Short transcript (< 5 words)'
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

  // --- 4. Lightweight Heuristic: Question Patterns ---
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

  // --- 5. AI Fallback (Inconclusive Heuristics) ---
  console.log('[SemanticCompletion] Heuristics inconclusive. Falling back to LLM semantic analysis...');
  
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    // If running in a client environment without access to environment variables,
    // fetch the local endpoint instead.
    try {
      const res = await fetch('/api/check-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText })
      });
      if (res.ok) {
        const data = await res.json();
        return {
          isComplete: data.isComplete,
          confidence: data.isComplete ? 0.8 : 0.2,
          reason: 'LLM Evaluated (Client Fallback)'
        };
      }
    } catch (err) {
      console.error('[SemanticCompletion] Client fallback fetch failed:', err);
    }
    
    // Default fallback if key is missing and fetch fails
    return {
      isComplete: false,
      confidence: 0.5,
      reason: 'Inconclusive heuristics and API key unavailable'
    };
  }

  // If running server-side, call OpenRouter directly to evaluate
  try {
    const systemPrompt = `You are an AI semantic evaluator for live speech.
Your job is to read an ongoing transcript from an interviewer and determine if they have finished their thought or question.
Consider:
- Does the sentence end abruptly? (e.g., "So I was thinking about...") -> FALSE
- Is it a complete question? (e.g., "Can you tell me about a time you failed?") -> TRUE
- Does it sound logically complete? -> TRUE
If it is complete, reply with EXACTLY the word "TRUE".
If it is incomplete, reply with EXACTLY the word "FALSE".
Do not add punctuation or any other words.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://nemu-dashboard-ten.vercel.app',
        'X-Title': 'Nemu AI Interview Assistant',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcript:\n"${cleanText}"` },
        ],
        max_tokens: 5,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[SemanticCompletion] OpenRouter Error:', data);
      return {
        isComplete: false,
        confidence: 0.3,
        reason: `LLM Error: ${data.error?.message || 'OpenRouter failure'}`
      };
    }

    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    const isComplete = answer?.includes('TRUE') || false;

    console.log(`[SemanticCompletion] LLM Result: isComplete = ${isComplete} (Answer: "${answer}")`);
    return {
      isComplete,
      confidence: isComplete ? 0.85 : 0.15,
      reason: `LLM Evaluated (Answer: "${answer}")`
    };

  } catch (error: any) {
    console.error('[SemanticCompletion] LLM Fallback exception:', error);
    return {
      isComplete: false,
      confidence: 0.2,
      reason: `Exception in LLM: ${error.message}`
    };
  }
}
