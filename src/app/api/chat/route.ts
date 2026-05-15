import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { question, cvText, apiKey, systemPrompt } = await req.json();

    // Use environment variable first, then the one passed from local storage
    const geminiKey = process.env.Gemini_API_Key || apiKey;

    if (!geminiKey) {
      console.error('Chat API Error: Gemini API key is missing.');
      return NextResponse.json({ error: 'Gemini API key is missing. Please set Gemini_API_Key in Vercel Environment Variables.' }, { status: 400 });
    }

    // Truncate CV to avoid token limits
    const safeCvText = cvText ? cvText.substring(0, 20000) : '';

    const defaultSystemPrompt = `You are an expert AI interview assistant helping a candidate. You are acting AS the candidate. 
Based on the following CV, answer the interview question professionally, confidently, and concisely.
Use the first person ("I", "my"). Keep the answer under 4 sentences so it is easy to read and say aloud.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    const prompt = `${finalSystemPrompt}

CV Content:
${safeCvText}

Interview Question:
"${question}"
`;

    console.log('Sending request to Gemini...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-goog-api-key': geminiKey 
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error('Gemini API Error Response:', JSON.stringify(data));
        return NextResponse.json({ 
          error: data.error?.message || 'Error from Gemini API',
          details: data.error
        }, { status: response.status });
    }

    if (!data.candidates || data.candidates.length === 0) {
        console.error("Gemini returned no candidates. Full response:", JSON.stringify(data));
        return NextResponse.json({ error: "Gemini returned no answer. This might be due to safety filters or quota limits." }, { status: 500 });
    }

    const answer = data.candidates[0].content?.parts?.[0]?.text;
    
    if (!answer) {
        console.error("Could not parse text from Gemini response:", JSON.stringify(data));
        return NextResponse.json({ error: "Could not parse text from Gemini response." }, { status: 500 });
    }

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('Chat API Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
