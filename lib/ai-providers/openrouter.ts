import OpenAI from 'openai';
import { AIProvider } from './types';

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  models = [
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-opus-4.5',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash-lite',
    'google/gemini-3-flash-preview',
    'x-ai/grok-code-fast-1',
    'x-ai/grok-4.1-fast',
    'xiaomi/mimo-v2-flash',
    'deepseek/deepseek-v3.2',
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
