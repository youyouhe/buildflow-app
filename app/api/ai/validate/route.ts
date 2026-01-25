/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai-providers/factory";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, model } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { valid: false, error: "Missing provider or API key" },
        { status: 400 }
      );
    }

    // Create provider instance
    const aiProvider = createAIProvider({
      provider,
      apiKey,
      model: model || "default",
    });

    // Validate API key
    const isValid = await aiProvider.validateApiKey();

    if (isValid) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json(
        { valid: false, error: "Invalid API key" },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error("API key validation error:", error);
    return NextResponse.json(
      { valid: false, error: error.message || "Validation failed" },
      { status: 500 }
    );
  }
}
