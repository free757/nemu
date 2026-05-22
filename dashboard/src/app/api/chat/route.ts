import { NextResponse } from 'next/server';

// Ordered list of models to try — primary first, then progressively faster/cheaper fallbacks
const MODEL_CHAIN = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-3-4b-it:free',
  'mistralai/mistral-7b-instruct:free',
];

const RETRY_DELAYS_MS = [500, 1000, 2000];

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function POST(req: Request) {
  try {
    const { question, cvText, systemPrompt } = await req.json();

    const apiKeys: string[] = [];
    
    // Explicit list for next.js bundler static analysis safety
    const explicitVars = [
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_API_KEY_1,
      process.env.OPENROUTER_API_KEY_2,
      process.env.OPENROUTER_API_KEY_3,
      process.env.OPENROUTER_API_KEY_4,
      process.env.OPENROUTER_API_KEY_5,
      process.env.OPENROUTER_API_KEY_6,
      process.env.OPENROUTER_API_KEY_7,
      process.env.OPENROUTER_API_KEY_8,
      process.env.OPENROUTER_API_KEY_9,
      process.env.OPENROUTER_API_KEY_10,
    ];

    for (const val of explicitVars) {
      if (val) {
        const splitKeys = val.split(',').map(k => k.trim()).filter(Boolean);
        apiKeys.push(...splitKeys);
      }
    }

    // Dynamic fallback to catch any custom ones
    for (const key in process.env) {
      if (key.startsWith('OPENROUTER_API_KEY')) {
        const val = process.env[key];
        if (val) {
          const splitKeys = val.split(',').map(k => k.trim()).filter(Boolean);
          for (const k of splitKeys) {
            if (!apiKeys.includes(k)) {
              apiKeys.push(k);
            }
          }
        }
      }
    }

    console.log('=== CHAT API REQUEST ===');
    console.log(`[API] Total environment variables detected: ${Object.keys(process.env).filter(k => k.startsWith('OPENROUTER_API_KEY')).length}`);

    if (apiKeys.length === 0) {
      console.error('Chat API Error: No API keys found starting with OPENROUTER_API_KEY.');
      return NextResponse.json(
        { error: 'No API keys configured. Please set OPENROUTER_API_KEY (or OPENROUTER_API_KEY_1, _2, etc.) in Vercel.' },
        { status: 400 }
      );
    }

    console.log(`[API] Loaded API Key Pool: ${apiKeys.length} keys configured.`);

    const safeCvText = cvText ? cvText.substring(0, 20000) : '';

    const defaultSystemPrompt = `You are acting AS the candidate in a live job interview. 
Your goal is to sound like a real, confident human being having a natural, friendly conversation.
CRITICAL RULES:
1. NEVER recite your whole CV or sound like you are reading from a script.
2. Be conversational and casual but professional. It's okay to start sentences with "Well," "Sure," or "Yeah,".
3. Keep answers very brief (1 to 3 sentences maximum). Leave room for the interviewer to ask follow-up questions.
4. If asked a simple "hello" or "how are you", just reply naturally (e.g., "Hello! I'm doing great, thank you. I'm really excited to be here. How are you doing today?").
5. Only mention specific details from your CV if they directly answer the specific question asked.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
    const userMessage = `CV Content:\n${safeCvText}\n\nInterview Question:\n"${question}"`;

    // Try Groq first if key is configured (extremely fast, high rate limits, immune to shared IP issues)
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      console.log('[API] Groq API Key detected. Trying Groq first!');
      const GROQ_MODELS = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.2-3b-preview',
      ];

      for (const groqModel of GROQ_MODELS) {
        console.log(`[API] Trying Groq model: ${groqModel}`);
        try {
          const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [
                { role: 'system', content: finalSystemPrompt },
                { role: 'user', content: userMessage },
              ],
              max_tokens: 300,
            }),
          });

          if (groqResponse.ok) {
            const groqData = await groqResponse.json();
            const groqAnswer = groqData.choices?.[0]?.message?.content;
            if (groqAnswer) {
              console.log(`[API] Groq Success! Answer received from model=${groqModel}`);
              return NextResponse.json({ answer: groqAnswer });
            }
          } else {
            const errBody = await groqResponse.json().catch(() => ({}));
            console.warn(`[API] Groq model ${groqModel} failed. Status: ${groqResponse.status}`, JSON.stringify(errBody));
          }
        } catch (groqErr: any) {
          console.error(`[API] Groq fetch error for model ${groqModel}:`, groqErr.message);
        }
      }
      console.warn('[API] Groq failed or was exhausted. Falling back to OpenRouter key pool...');
    }

    // Try each model in the chain
    for (let modelIdx = 0; modelIdx < MODEL_CHAIN.length; modelIdx++) {
      const model = MODEL_CHAIN[modelIdx];

      // Try each API key in the list for the current model
      for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
        const apiKey = apiKeys[keyIdx];
        
        // Hide most of the key for security in logs
        const maskedKey = apiKey.length > 12 
          ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 6)}` 
          : 'invalid_key';

        console.log(`[API] Trying model ${model} with Key #${keyIdx + 1}/${apiKeys.length} (${maskedKey})`);
        
        let response: Response | null = null;
        let isRateLimited = false;

        // Per-key retry loop for transient errors (not 429)
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
          try {
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://nemu-dashboard-ten.vercel.app',
                'X-Title': 'Nemu AI Interview Assistant',
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: finalSystemPrompt },
                  { role: 'user', content: userMessage },
                ],
                max_tokens: 300,
              }),
            });
          } catch (fetchErr: any) {
            console.warn(`[API] network error on model=${model} Key=#${keyIdx + 1} attempt=${attempt + 1}:`, fetchErr.message);
            if (attempt < RETRY_DELAYS_MS.length) {
              await sleep(RETRY_DELAYS_MS[attempt]);
              continue;
            }
            break;
          }

          if (response.status === 429) {
            console.warn(`[API] 429 (Rate Limit) on model=${model} with Key #${keyIdx + 1}/${apiKeys.length}`);
            isRateLimited = true;
            break; // Break retry loop, try next API key
          }

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            console.error(`[API] OpenRouter error: status=${response.status}`, JSON.stringify(data));

            if (attempt < RETRY_DELAYS_MS.length) {
              await sleep(RETRY_DELAYS_MS[attempt]);
              continue;
            }
            break;
          }

          // Success
          const data = await response.json();
          const answer = data.choices?.[0]?.message?.content;

          if (!answer) {
            console.error('[API] OpenRouter returned empty answer');
            return NextResponse.json({ error: 'No answer from OpenRouter.' }, { status: 500 });
          }

          console.log(`[API] Success! answer received from model=${model} using Key #${keyIdx + 1}`);
          return NextResponse.json({ answer });
        }
        
        // If we broke out due to rate limit, we will try the next key for this model
        if (isRateLimited) {
          continue;
        }
      }
    }

    // All keys and models exhausted
    console.error('[API] All keys and models returned 429 or failed — rate limit exceeded');
    return NextResponse.json(
      { error: 'All configured AI keys are currently rate limited. Please wait a few seconds and try again.' },
      { status: 429 }
    );

  } catch (error: any) {
    console.error('Chat API Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
