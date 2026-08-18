import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function GET() {
  const keyNames = [
    "GEMINI_API_KEY_atlas_helper",
    "GEMINI_API_KEY_ATLAS_HELPER",
    "GEMINI_API_KEY",
    "GEMINI_API_KEY_1",
    "GEMINI_API_KEY_2",
    "GEMINI_API_KEY_3",
    "GEMINI_API_KEY_4",
    "GEMINI_API_KEY_5",
  ];

  const results: any[] = [];

  for (const name of keyNames) {
    const key = process.env[name];
    if (!key) {
      results.push({ envVar: name, status: "NOT_SET" });
      continue;
    }

    const keyInfo: any = {
      envVar: name,
      keyPreview: `...${key.slice(-6)}`,
      uploadTest: null,
      generateTest: null,
      errors: [],
    };

    // Test 1: Can it create a GoogleGenAI instance and call models.list?
    try {
      const ai = new GoogleGenAI({ apiKey: key });

      // Test 2: Try a simple text-only generateContent (no video)
      const textModels = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-1.5-flash"];
      for (const model of textModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
            config: { temperature: 0.0 },
          });
          const text = response.text?.trim();
          keyInfo.generateTest = { model, status: "SUCCESS", response: text };
          break;
        } catch (genErr: any) {
          keyInfo.errors.push(`generateContent(${model}): ${genErr?.message || genErr}`);
        }
      }

      // Test 3: Try with responseMimeType: application/json
      try {
        const ai2 = new GoogleGenAI({ apiKey: key });
        const jsonResponse = await ai2.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts: [{ text: 'Return JSON: [{"test": true}]' }] }],
          config: { responseMimeType: "application/json", temperature: 0.0 },
        });
        keyInfo.jsonTest = { status: "SUCCESS", preview: jsonResponse.text?.slice(0, 100) };
      } catch (jsonErr: any) {
        keyInfo.jsonTest = { status: "FAILED", error: jsonErr?.message || String(jsonErr) };
        keyInfo.errors.push(`JSON mode: ${jsonErr?.message || jsonErr}`);
      }

      keyInfo.status = keyInfo.generateTest?.status === "SUCCESS" ? "WORKING" : "KEY_EXISTS_BUT_GENERATE_FAILED";
    } catch (err: any) {
      keyInfo.status = "ERROR";
      keyInfo.errors.push(String(err?.message || err));
    }

    results.push(keyInfo);
  }

  const workingKeys = results.filter((r) => r.status === "WORKING");

  return NextResponse.json({
    summary: {
      totalKeysFound: results.filter((r) => r.status !== "NOT_SET").length,
      workingKeys: workingKeys.length,
      issue: workingKeys.length === 0
        ? "No Gemini key can generate content → falling back to Groq"
        : "Gemini keys are working",
    },
    details: results,
  });
}
