import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { question, cvText, systemPrompt } = await req.json();

    // OpenRouter key (preferred) or fallback to Gemini direct
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.Gemini_API_Key;

    if (!openRouterKey && !geminiKey) {
      console.error('Chat API Error: No API key found.');
      return NextResponse.json(
        { error: 'No API key configured. Please set OPENROUTER_API_KEY in Vercel.' },
        { status: 400 }
      );
    }

    // Truncate CV to avoid token limits
    const safeCvText = cvText ? cvText.substring(0, 20000) : '';

    const defaultSystemPrompt = `You are an expert AI interview assistant helping a candidate. You are acting AS the candidate. 
Based on the following CV, answer the interview question professionally, confidently, and concisely.
Use the first person ("I", "my"). Keep the answer under 4 sentences so it is easy to read and say aloud.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    const userMessage = `CV Content:\n${safeCvText}\n\nInterview Question:\n"${question}"`;

    // ─── Option A: OpenRouter (preferred — higher free limits) ───────────────
    if (openRouterKey) {
      console.log('Using OpenRouter (gemini-flash-1.5-free)...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://nemu-dashboard-ten.vercel.app',
          'X-Title': 'Nemu AI Interview Assistant',
        },
        body: JSON.stringify({
          model: 'google/gemini-flash-1.5:free',  // Free Gemini Flash via OpenRouter
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
