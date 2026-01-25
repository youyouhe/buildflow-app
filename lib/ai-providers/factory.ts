import { AIProvider, AIProviderName, AIProviderConfig } from './types';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';
import { DeepSeekProvider } from './deepseek';
import { OpenRouterProvider } from './openrouter';

/**
 * Create an AI provider instance
 */
export function createAIProvider(config: AIProviderConfig): AIProvider {
  const { provider, apiKey, baseURL } = config;
  
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, baseURL);
    case 'google':
      return new GoogleProvider(apiKey);
    case 'deepseek':
      return new DeepSeekProvider(apiKey);
    case 'openrouter':
      return new OpenRouterProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProviderName[] {
  return ['openai', 'google', 'deepseek', 'openrouter'];
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIProviderName): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'google':
      return 'gemini-2.0-flash-exp';
    case 'deepseek':
      return 'deepseek-chat';
    case 'openrouter':
      return 'google/gemini-2.5-flash';
    default:
      return 'gpt-4o-mini';
  }
}
