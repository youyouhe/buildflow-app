import { NextRequest } from "next/server";
import { createAIProvider } from "@/lib/ai-providers/factory";
import type { AIProviderName } from "@/lib/ai-providers/types";
import {
  INITIAL_SYSTEM_PROMPT_LIGHT,
  FOLLOW_UP_SYSTEM_PROMPT_LIGHT,
  INITIAL_SYSTEM_PROMPT,
  FOLLOW_UP_SYSTEM_PROMPT,
  INITIAL_SYSTEM_PROMPT_LIGHT_ZH,
  FOLLOW_UP_SYSTEM_PROMPT_LIGHT_ZH,
  INITIAL_SYSTEM_PROMPT_ZH,
  FOLLOW_UP_SYSTEM_PROMPT_ZH,
  PROMPT_FOR_IMAGE_GENERATION,
  PROMPT_FOR_IMAGE_GENERATION_ZH,
  PROMPT_FOR_PROJECT_NAME,
  PROMPT_FOR_PROJECT_NAME_ZH,
} from "@/lib/prompts";
import { MODELS } from "@/lib/providers";
import type { Page, EnhancedSettings } from "@/types";

export const runtime = "edge";
export const maxDuration = 300;

interface AskRequestBase {
  prompt: string;
  provider: AIProviderName | "auto";
  model: string;
  enhancedSettings?: EnhancedSettings;
}

interface AskRequestPOST extends AskRequestBase {
  redesignMarkdown?: string;
}

interface AskRequestPUT extends AskRequestBase {
  previousPrompts: string[];
  pages: Page[];
  selectedElementHtml?: string;
  files?: string[];
  repoId?: string;
  isNew?: boolean;
}

// Helper to get API key from request headers or body
function getApiKeyForProvider(provider: AIProviderName, headers: Headers, apiKeys?: Record<string, string>): string | null {
  // Try to get from headers first
  const headerKey = headers.get(`x-${provider}-api-key`);
  if (headerKey) return headerKey;
  
  // Try from apiKeys object
  if (apiKeys && apiKeys[provider]) return apiKeys[provider];
  
  return null;
}

// Helper to select provider when "auto" is specified
function selectProvider(providerPreference: AIProviderName | "auto", model: string, apiKeys?: Record<string, string>): AIProviderName {
  if (providerPreference !== "auto") {
    return providerPreference;
  }

  // Look up the model's preferred provider from the MODELS metadata
  const modelMeta = MODELS.find(m => m.value === model);
  if (modelMeta) {
    const preferred = modelMeta.autoProvider as AIProviderName;
    // Use the preferred provider if the user has a key for it
    if (apiKeys && apiKeys[preferred]) {
      return preferred;
    }
    // Otherwise try any other provider that supports this model
    for (const p of modelMeta.providers) {
      if (apiKeys && apiKeys[p]) {
        return p as AIProviderName;
      }
    }
  }

  // Fallback for models not in the MODELS list:
  // Slash-prefixed model IDs are OpenRouter models
  if (model.includes("/")) {
    return "openrouter";
  }

  // Last resort: pick the first provider with an available key
  const providerPriority: AIProviderName[] = ["openrouter", "deepseek", "openai", "google"];
  for (const provider of providerPriority) {
    if (apiKeys && apiKeys[provider]) {
      return provider;
    }
  }

  return "openrouter";
}

// Build system prompt based on request type
function buildSystemPrompt(isPUT: boolean, hasPages: boolean, enhancedSettings?: EnhancedSettings): string {
  const promptDetail = enhancedSettings?.promptDetail || 'light';
  const language = enhancedSettings?.language || 'en';
  
  let systemPrompt = '';
  
  // Select base prompt based on detail level and language
  if (language === 'zh') {
    systemPrompt = isPUT && hasPages 
      ? (promptDetail === 'full' ? FOLLOW_UP_SYSTEM_PROMPT_ZH : FOLLOW_UP_SYSTEM_PROMPT_LIGHT_ZH)
      : (promptDetail === 'full' ? INITIAL_SYSTEM_PROMPT_ZH : INITIAL_SYSTEM_PROMPT_LIGHT_ZH);
    
    // For Chinese, image and project name prompts are already included in full version
    if (promptDetail === 'light') {
      systemPrompt += `\n\n${PROMPT_FOR_IMAGE_GENERATION_ZH}`;
      systemPrompt += `\n\n${PROMPT_FOR_PROJECT_NAME_ZH}`;
    }
  } else {
    systemPrompt = isPUT && hasPages 
      ? (promptDetail === 'full' ? FOLLOW_UP_SYSTEM_PROMPT : FOLLOW_UP_SYSTEM_PROMPT_LIGHT)
      : (promptDetail === 'full' ? INITIAL_SYSTEM_PROMPT : INITIAL_SYSTEM_PROMPT_LIGHT);
    
    // For English, image and project name prompts are already included in full version
    if (promptDetail === 'light') {
      systemPrompt += `\n\n${PROMPT_FOR_IMAGE_GENERATION}`;
      systemPrompt += `\n\n${PROMPT_FOR_PROJECT_NAME}`;
    }
  }
  
  return systemPrompt;
}

// Build user prompt
function buildUserPrompt(
  prompt: string,
  isPUT: boolean,
  pages?: Page[],
  selectedElementHtml?: string,
  redesignMarkdown?: string
): string {
  let userPrompt = prompt;
  
  if (isPUT && pages && pages.length > 0) {
    userPrompt += "\n\nCurrent files:\n";
    pages.forEach(page => {
      const content = page.html || page.content || '';
      userPrompt += `\nFile: ${page.path}\n\`\`\`${page.path.endsWith('.html') ? 'html' : page.path.endsWith('.css') ? 'css' : 'javascript'}\n${content}\n\`\`\`\n`;
    });
  }
  
  if (selectedElementHtml) {
    userPrompt += `\n\nSelected HTML element to modify:\n\`\`\`html\n${selectedElementHtml}\n\`\`\`\n`;
  }
  
  if (redesignMarkdown) {
    userPrompt += `\n\nDesign reference:\n${redesignMarkdown}\n`;
  }
  
  return userPrompt;
}

// POST handler - for initial website generation
export async function POST(request: NextRequest) {
  try {
    const body: AskRequestPOST & { apiKeys?: Record<string, string> } = await request.json();
    const { prompt, provider: providerPreference, model, redesignMarkdown, enhancedSettings, apiKeys } = body;

    // Validate required fields
    if (!prompt) {
      return new Response(
        JSON.stringify({ ok: false, message: "Missing required field: prompt" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Select provider
    const provider = selectProvider(providerPreference, model, apiKeys);
    
    // Get API key
    const apiKey = getApiKeyForProvider(provider, request.headers, apiKeys);
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          openSelectProvider: true,
          message: `No API key found for ${provider}. Please configure your API keys in settings.` 
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt(false, false, enhancedSettings);
    const userPrompt = buildUserPrompt(prompt, false, undefined, undefined, redesignMarkdown);

    // Debug logging
    console.log("=== AI Request Debug ===");
    console.log("Provider:", provider);
    console.log("Model:", model);
    console.log("Has API Key:", !!apiKey);
    console.log("========================");

    // Create AI provider
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
            userPrompt,
            systemPrompt,
            0.7, // default temperature for POST
            undefined // default maxTokens
          );

          const encoder = new TextEncoder();
          
          for await (const chunk of responseStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          
          controller.close();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          console.error("AI generation error:", errorMessage);
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ ok: false, message: `AI generation failed: ${errorMessage}` })
          ));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Request error:", errorMessage);
    return new Response(
      JSON.stringify({ ok: false, message: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// PUT handler - for follow-up modifications
export async function PUT(request: NextRequest) {
  try {
    const body: AskRequestPUT & { apiKeys?: Record<string, string> } = await request.json();
    const { 
      prompt, 
      provider: providerPreference, 
      model, 
      pages, 
      selectedElementHtml, 
      enhancedSettings,
      apiKeys 
    } = body;

    // Validate required fields
    if (!prompt) {
      return new Response(
        JSON.stringify({ ok: false, message: "Missing required field: prompt" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Select provider
    const provider = selectProvider(providerPreference, model, apiKeys);
    
    // Get API key
    const apiKey = getApiKeyForProvider(provider, request.headers, apiKeys);
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          openSelectProvider: true,
          message: `No API key found for ${provider}. Please configure your API keys in settings.` 
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt(true, pages && pages.length > 0, enhancedSettings);
    const userPrompt = buildUserPrompt(prompt, true, pages, selectedElementHtml);

    // Create AI provider
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
            userPrompt,
            systemPrompt,
            0.7, // default temperature for POST
            undefined // default maxTokens
          );

          const encoder = new TextEncoder();
          
          for await (const chunk of responseStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          
          controller.close();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          console.error("AI generation error:", errorMessage);
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ ok: false, message: `AI generation failed: ${errorMessage}` })
          ));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Request error:", errorMessage);
    return new Response(
      JSON.stringify({ ok: false, message: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
