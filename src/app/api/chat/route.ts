import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { question, cvText, systemPrompt } = await req.json();

    const openRouterKey = process.env.OPENROUTER_API_KEY;

    // ── Startup diagnostics ──────────────────────────────────────────────────
    console.log('=== CHAT API REQUEST ===');
    console.log('OPENROUTER_API_KEY present:', !!openRouterKey);
    // ─────────────────────────────────────────────────────────────────────────

    if (!openRouterKey) {
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

    // ─── Option A: OpenRouter (meta-llama/llama-3.1-8b-instruct:free) ────────
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
        model: 'meta-llama/llama-3.1-8b-instruct:free',
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
      return NextResponse.json(
        { error: data.error?.message || 'OpenRouter API Error' },
        { status: response.status }
      );
    }

    const answer = data.choices?.[0]?.message?.content;
    if (!answer) {
      return NextResponse.json({ error: 'No answer from OpenRouter.' }, { status: 500 });
    }
    
    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error('Chat API Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
