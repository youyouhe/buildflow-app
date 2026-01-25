import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './types';

export class GoogleProvider implements AIProvider {
  name = 'Google';
  models = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  
  private client: GoogleGenerativeAI;
  
  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }
  
  async generate(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    const geminiModel = this.client.getGenerativeModel({
      model: model || 'gemini-3-flash-preview',
      generationConfig: {
        temperature: temperature || 0.7,
        maxOutputTokens: maxTokens || 4096,
      },
    });
    
    // Combine system prompt with user prompt
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\nUser: ${prompt}`
      : prompt;
    
    const result = await geminiModel.generateContent(fullPrompt);
    return result.response.text();
  }
  
  async *generateStream(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncIterable<string> {
    const geminiModel = this.client.getGenerativeModel({
      model: model || 'gemini-3-flash-preview',
      generationConfig: {
        temperature: temperature || 0.7,
        maxOutputTokens: maxTokens || 4096,
      },
    });
    
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\nUser: ${prompt}`
      : prompt;
    
    const result = await geminiModel.generateContentStream(fullPrompt);
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
  
  async validateApiKey(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent('test');
      return true;
    } catch {
      return false;
    }
  }
}
