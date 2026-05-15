import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { question, cvText, apiKey } = await req.json();

    // Use environment variable first, fallback to the one passed from local storage, then the provided hardcoded key
    const geminiKey = process.env.Gemini_API_Key || apiKey || 'AIzaSyAm5EY1ZQDfhbAa6j1iXZG1cQuKiRwQ0Zo';

    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key is missing. Please set it in Settings.' }, { status: 400 });
    }

    // Truncate CV to avoid token limits
    const safeCvText = cvText ? cvText.substring(0, 20000) : '';

    const prompt = `You are an expert AI interview assistant helping a candidate. You are acting AS the candidate. 
Based on the following CV, answer the interview question professionally, confidently, and concisely.
Use the first person ("I", "my"). Keep the answer under 4 sentences so it is easy to read and say aloud.

CV Content:
${safeCvText}

Interview Question:
"${question}"
`;

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
        return NextResponse.json({ error: data.error?.message || 'Error from Gemini API' }, { status: 500 });
    }

    if (!data.candidates || data.candidates.length === 0) {
        console.error("Gemini returned no candidates. Full response:", JSON.stringify(data));
        return NextResponse.json({ error: "Gemini returned no answer. This might be due to safety filters blocking the content. Raw details: " + JSON.stringify(data) }, { status: 500 });
    }

    const answer = data.candidates[0].content?.parts?.[0]?.text;
    
    if (!answer) {
        return NextResponse.json({ error: "Could not parse text from Gemini response. Raw details: " + JSON.stringify(data) }, { status: 500 });
    }

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
