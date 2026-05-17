import { NextResponse } from 'next/server';
// Build: 2026-05-16T02:28 — Force redeploy to pick up OPENROUTER_API_KEY
export async function POST(req: Request) {
  try {
    const { question, cvText, systemPrompt } = await req.json();

    // OpenRouter key (preferred) or fallback to Gemini direct
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.Gemini_API_Key;

    // ── Startup diagnostics ──────────────────────────────────────────────────
    console.log('=== CHAT API REQUEST ===');
    console.log('OPENROUTER_API_KEY present:', !!openRouterKey);
    console.log('Gemini_API_Key present:', !!geminiKey);
    console.log('Will use provider:', openRouterKey ? 'OpenRouter' : geminiKey ? 'Gemini Direct' : 'NONE');
    // ─────────────────────────────────────────────────────────────────────────

    if (!openRouterKey && !geminiKey) {
      console.error('Chat API Error: No API key found.');
      return NextResponse.json(
        { error: 'No API key configured. Please set OPENROUTER_API_KEY in Vercel.' },
        { status: 400 }
      );
    }

    // Truncate CV to avoid token limits
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

    // ─── Option A: OpenRouter (preferred — higher free limits) ───────────────
    if (openRouterKey) {
      console.log('Using OpenRouter (meta-llama/llama-3.1-8b-instruct:free)...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://nemu-dashboard-ten.vercel.app',
          'X-Title': 'Nemu AI Interview Assistant',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',  // Free Llama 3.1 (human-like)
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 300,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('OpenRouter Error:', JSON.stringify(data));
        // If OpenRouter fails, try Gemini direct below
        if (!geminiKey) {
          return NextResponse.json(
            { error: data.error?.message || 'OpenRouter API Error' },
            { status: response.status }
          );
        }
      } else {
        const answer = data.choices?.[0]?.message?.content;
        if (!answer) {
          return NextResponse.json({ error: 'No answer from OpenRouter.' }, { status: 500 });
        }
        return NextResponse.json({ answer });
      }
    }

    // ─── Option B: Gemini direct (fallback) ──────────────────────────────────
    if (geminiKey) {
      console.log('Using Gemini direct (fallback)...');
      const prompt = `${finalSystemPrompt}\n\n${userMessage}`;
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': geminiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Gemini Error:', JSON.stringify(data));
        return NextResponse.json(
          { error: data.error?.message || 'Gemini API Error', details: data.error },
          { status: response.status }
        );
      }

      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!answer) {
        return NextResponse.json({ error: 'No answer from Gemini.' }, { status: 500 });
      }
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: 'No AI provider available.' }, { status: 500 });

  } catch (error: any) {
    console.error('Chat API Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
