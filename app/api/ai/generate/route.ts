import { NextRequest } from "next/server";
import { createAIProvider } from "@/lib/ai-providers/factory";
import type { AIProviderName } from "@/lib/ai-providers/types";

export const runtime = "edge";

interface GenerateRequest {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    
    const { provider, model, apiKey, prompt, systemPrompt, temperature, maxTokens } = body;

    // Validate required fields
    if (!provider || !model || !apiKey || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: provider, model, apiKey, prompt" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create AI provider instance
    const aiProvider = createAIProvider({
      provider,
      apiKey,
      model,
    });

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const responseStream = aiProvider.generateStream(
            model,
            prompt,
            systemPrompt,
            temperature,
            maxTokens
          );

          const encoder = new TextEncoder();

          // Iterate through the async iterable
          for await (const chunk of responseStream) {
            controller.enqueue(encoder.encode(chunk));
          }

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify({ error: errorMessage }))
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
