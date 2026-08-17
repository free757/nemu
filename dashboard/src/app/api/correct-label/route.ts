import { NextResponse } from "next/server";
import { GeminiService } from "@/features/atlas-helper/services/gemini.service";
import { ApiResponse, CorrectLabelsResponse } from "@/features/atlas-helper/types/atlas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileUri, segments, customPrompt } = body;

    if (!fileUri || typeof fileUri !== "string") {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Valid fileUri is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Segments array cannot be empty." },
        { status: 400 }
      );
    }

    const geminiService = new GeminiService();
    const correctedResults = await geminiService.correctLabels(fileUri, segments, customPrompt);

    return NextResponse.json<ApiResponse<CorrectLabelsResponse>>({
      success: true,
      data: {
        segments: correctedResults,
      },
    });
  } catch (error: any) {
    console.error("Correct Labels API Error:", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || "Failed to correct action labels using Gemini.",
      },
      { status: 500 }
    );
  }
}
