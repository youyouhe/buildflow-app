import OpenAI from 'openai';
import { AIProvider } from './types';

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  models = [
    // Top 10 ranked models as of 2026-02
    'moonshotai/kimi-k2.5',                    // #1 - Kimi K2.5 by moonshotai (1.31T tokens)
    'google/gemini-3-flash-preview',           // #2 - Gemini 3 Flash Preview (751B tokens)
    'anthropic/claude-sonnet-4.5',             // #3 - Claude Sonnet 4.5 (696B tokens)
    'deepseek/deepseek-chat',                  // #4 - DeepSeek V3.2 (687B tokens)
    'minimax/minimax-m2.1',                    // #5 - MiniMax M2.1 (452B tokens)
    'google/gemini-2.5-flash',                 // #6 - Gemini 2.5 Flash (437B tokens)
    'arcee-ai/trinity-large-preview',          // #7 - Trinity Large Preview free (371B tokens)
    'x-ai/grok-4.1-fast',                      // #8 - Grok 4.1 Fast (370B tokens)
    'anthropic/claude-opus-4.5',               // #9 - Claude Opus 4.5 (369B tokens)
    'google/gemini-2.5-flash-lite',            // #10 - Gemini 2.5 Flash Lite (348B tokens)
  ];
  
  private client: OpenAI;
  
  constructor(apiKey: string) {
    // OpenRouter uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://buildflow.dev',
        'X-Title': 'BuildFlow',
      },
    });
  }
  
  async generate(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const completion = await this.client.chat.completions.create({
      model: model || 'google/gemini-3-flash-preview',
      messages,
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 4096,
    });
    
    return completion.choices[0]?.message?.content || '';
  }
  
  async *generateStream(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncIterable<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const stream = await this.client.chat.completions.create({
      model: model || 'google/gemini-3-flash-preview',
      messages,
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 4096,
      stream: true,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
  
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
