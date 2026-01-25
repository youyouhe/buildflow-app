import OpenAI from 'openai';
import { AIProvider } from './types';

export class DeepSeekProvider implements AIProvider {
  name = 'DeepSeek';
  models = ['deepseek-chat', 'deepseek-coder'];
  
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      dangerouslyAllowBrowser: true,
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
      model: model || 'deepseek-coder',
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
      model: model || 'deepseek-coder',
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
