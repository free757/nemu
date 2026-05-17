import { NextResponse } from 'next/server';
import { analyzeQuestionCompletion } from '@/lib/semanticCompletion';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const result = await analyzeQuestionCompletion(text);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Check Completion Route Error:', error);
    return NextResponse.json({ 
      isComplete: false, 
      confidence: 0.0, 
      reason: `Route Exception: ${error.message}` 
    });
  }
}
