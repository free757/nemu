import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterKey) {
      return NextResponse.json({ error: 'No API key' }, { status: 400 });
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
          { role: 'user', content: `Transcript:\n"${text}"` },
        ],
        max_tokens: 5,
        temperature: 0.1, // Low temperature for deterministic True/False
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ isComplete: false, error: 'API Error' });
    }

    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase();
    
    // If the AI says TRUE, or contains TRUE, we assume it's complete.
    const isComplete = answer?.includes('TRUE') || false;

    return NextResponse.json({ isComplete });

  } catch (error: any) {
    console.error('Check Completion Error:', error);
    return NextResponse.json({ isComplete: false }); // On error, assume false so we don't prematurely trigger
  }
}
