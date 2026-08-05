import { GoogleGenAI } from "@google/genai";
import { DEFAULT_ATLAS_SYSTEM_PROMPT } from "@/constants/atlas-prompts";
import { CorrectedSegmentResult, SegmentItem } from "@/types/atlas";
import fs from "fs";
import path from "path";
import os from "os";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Uploads a video from Cloudflare R2 presigned URL to Gemini File API.
   */
  async uploadVideoFromUrl(videoUrl: string): Promise<{ fileUri: string; mimeType: string }> {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video from URL. Status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a temporary local file to upload via Gemini File API
    const tempFilePath = path.join(os.tmpdir(), `atlas-video-${Date.now()}.mp4`);
    await fs.promises.writeFile(tempFilePath, buffer);

    try {
      const fileUpload = await this.ai.files.upload({
        file: tempFilePath,
        mimeType: "video/mp4",
      });

      // Wait until processing is completed if needed
      let file = await this.ai.files.get({ name: fileUpload.name });
      while (file.state === "PROCESSING") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        file = await this.ai.files.get({ name: fileUpload.name });
      }

      if (file.state === "FAILED") {
        throw new Error("Gemini File processing failed.");
      }

      return {
        fileUri: file.uri,
        mimeType: file.mimeType || "video/mp4",
      };
    } finally {
      // Clean up local temporary file
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }
  }

  /**
   * Corrects action labels for multiple segments using Gemini 2.5 Pro model.
   */
  async correctLabels(
    fileUri: string,
    segments: SegmentItem[],
    customPrompt?: string
  ): Promise<CorrectedSegmentResult[]> {
    const systemPrompt = customPrompt || DEFAULT_ATLAS_SYSTEM_PROMPT;

    const segmentsPayload = segments.map((s) => ({
      id: s.id,
      timeRange: `${s.startTime} - ${s.endTime}`,
      currentLabel: s.currentLabel,
    }));

    const userPrompt = `
Analyze the provided video using its file URI.
Here are the video segments to validate and correct:
${JSON.stringify(segmentsPayload, null, 2)}

Strictly adhere to the Atlas Label Rubric rules. Output raw JSON only.
`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri,
                mimeType: "video/mp4",
              },
            },
            {
              text: `${systemPrompt}\n\n${userPrompt}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const responseText = response.text || "[]";
    try {
      const parsedResults = JSON.parse(responseText);
      if (Array.isArray(parsedResults)) {
        return parsedResults;
      }
      return [];
    } catch {
      throw new Error(`Failed to parse Gemini response as JSON: ${responseText}`);
    }
  }
}
