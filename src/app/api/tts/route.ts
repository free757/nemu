import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, apiKey, voiceId: reqVoiceId } = await req.json();

    const cartesiaKey = process.env.CARTESIA_API_KEY || apiKey;

    if (!cartesiaKey) {
      return NextResponse.json({ error: 'Cartesia API key is missing. Please set CARTESIA_API_KEY in Vercel.' }, { status: 400 });
    }

    // Default Voice ID: Cartesia's Default British Female Voice (e.g. Gemma or similar)
    let voiceId = reqVoiceId;
    if (!voiceId || !voiceId.includes('-')) {
      // If no ID or it's an old ElevenLabs ID, use a standard Cartesia Voice UUID
      // This is a common English Female voice on Cartesia
      voiceId = 'a0e99841-438c-4a64-b6a9-62f108dddef2'; 
    }

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': cartesiaKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-multilingual', // Multilingual supports many languages
        transcript: text,
        voice: {
          mode: 'id',
          id: voiceId
        },
        output_format: {
          container: 'mp3',
          encoding: 'mp3',
          sample_rate: 44100
        }
      })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('Cartesia API Error:', JSON.stringify(errData));
        return NextResponse.json({ 
          error: errData.error?.message || 'Cartesia API Error',
          raw: errData 
        }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
        headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
        }
    });

  } catch (error: any) {
    console.error('TTS API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
