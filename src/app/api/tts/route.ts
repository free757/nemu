import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, apiKey, voiceId: reqVoiceId } = await req.json();

    // Support both camelCase and UPPERCASE environment variables
    const elevenLabsKey = process.env.ElevenLabs_API_Key || process.env.ELEVENLABS_API_KEY || apiKey;

    if (!elevenLabsKey) {
      return NextResponse.json({ error: 'ElevenLabs API key is missing. Please set ElevenLabs_API_Key in Vercel.' }, { status: 400 });
    }

    // Default Voice ID: Rachel (21m00Tcm4TlvDq8ikWAM)
    // Use the requested voiceId if provided, else fallback to Rachel
    const voiceId = reqVoiceId || '21m00Tcm4TlvDq8ikWAM'; 

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2', // Multilingual supports Arabic and English if needed
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('ElevenLabs API Error:', JSON.stringify(errData));
        return NextResponse.json({ 
          error: errData.detail?.message || 'ElevenLabs API Error',
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
