import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;

    // Support both camelCase and UPPERCASE environment variables
    const elevenLabsKey = process.env.ElevenLabs_API_Key || process.env.ELEVENLABS_API_KEY;
    
    if (!elevenLabsKey) {
      return NextResponse.json({ error: 'ElevenLabs API key is missing. Please set ElevenLabs_API_Key in Vercel.' }, { status: 400 });
    }

    if (!file || !name) {
      return NextResponse.json({ error: 'Missing file or voice name' }, { status: 400 });
    }

    // Forward the file directly to ElevenLabs
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', name);
    elevenLabsFormData.append('files', file);
    elevenLabsFormData.append('description', 'Instant Voice Clone via Nemu Dashboard');

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
      },
      body: elevenLabsFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.detail?.message || 'Failed to clone voice' }, { status: response.status });
    }

    // Return the new voice ID to the frontend
    return NextResponse.json({ voice_id: data.voice_id });
  } catch (error: any) {
    console.error('Voice Cloning API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
