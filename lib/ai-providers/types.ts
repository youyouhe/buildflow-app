/**
 * AI Provider Type Definitions
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIGenerateParams {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIProvider {
  name: string;
  models: string[];
  
  /**
   * Generate a completion
   */
  generate(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string>;
  
  /**
   * Generate a streaming completion
   */
  generateStream(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncIterable<string>;
  
  /**
   * Validate API key
   */
  validateApiKey(): Promise<boolean>;
}

export type AIProviderName = 'openai' | 'google' | 'deepseek' | 'openrouter';

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  model: string;
  baseURL?: string;
}
