import { NextResponse } from "next/server";
import { GeminiService } from "@/features/atlas-helper/services/gemini.service";
import { memoryStore } from "@/features/atlas-helper/services/memory-store.service";
import { ApiResponse, UploadVideoResponse } from "@/features/atlas-helper/types/atlas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { videoUrl } = body;

    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: "Valid videoUrl is required." },
        { status: 400 }
      );
    }

    // Check if file URI is already cached in memory
    const cachedData = memoryStore.getVideoFileUri(videoUrl);
    if (cachedData) {
      return NextResponse.json<ApiResponse<UploadVideoResponse>>({
        success: true,
        data: {
          fileUri: cachedData.fileUri,
          mimeType: cachedData.mimeType,
        },
      });
    }

    // Upload video to Gemini File API
    const geminiService = new GeminiService();
    const uploadResult = await geminiService.uploadVideoFromUrl(videoUrl);

    // Save to memory store
    memoryStore.setVideoFileUri(videoUrl, uploadResult.fileUri, uploadResult.mimeType);

    return NextResponse.json<ApiResponse<UploadVideoResponse>>({
      success: true,
      data: uploadResult,
    });
  } catch (error: any) {
    console.error("Upload Video API Error:", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || "Failed to upload video to Gemini File API.",
      },
      { status: 500 }
    );
  }
}
