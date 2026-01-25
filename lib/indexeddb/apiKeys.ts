import { getDB, ApiKeyEntry } from './index';

/**
 * Get all stored API keys
 */
export async function getAllApiKeys(): Promise<ApiKeyEntry[]> {
  const db = await getDB();
  return await db.getAll('apiKeys');
}

/**
 * Get API key for a specific provider
 */
export async function getApiKey(provider: string): Promise<ApiKeyEntry | undefined> {
  const db = await getDB();
  return await db.get('apiKeys', provider);
}

/**
 * Store or update an API key (should be encrypted before calling this)
 */
export async function setApiKey(
  provider: string,
  encryptedKey: string,
  isValid: boolean = false
): Promise<void> {
  const db = await getDB();
  const entry: ApiKeyEntry = {
    provider,
    encryptedKey,
    isValid,
    lastValidatedAt: isValid ? Date.now() : undefined,
    updatedAt: Date.now(),
  };
  
  await db.put('apiKeys', entry);
}

/**
 * Delete an API key
 */
export async function deleteApiKey(provider: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get('apiKeys', provider);
  
  if (!existing) {
    return false;
  }
  
  await db.delete('apiKeys', provider);
  return true;
}

/**
 * Mark an API key as validated
 */
export async function markApiKeyValid(provider: string, isValid: boolean): Promise<void> {
  const db = await getDB();
  const existing = await db.get('apiKeys', provider);
  
  if (!existing) {
    throw new Error(`API key for provider ${provider} not found`);
  }
  
  const updated: ApiKeyEntry = {
    ...existing,
    isValid,
    lastValidatedAt: isValid ? Date.now() : existing.lastValidatedAt,
    updatedAt: Date.now(),
  };
  
  await db.put('apiKeys', updated);
}

/**
 * Check if an API key exists for a provider
 */
export async function hasApiKey(provider: string): Promise<boolean> {
  const db = await getDB();
  const key = await db.get('apiKeys', provider);
  return !!key;
}

/**
 * Get all providers with stored API keys
 */
export async function getConfiguredProviders(): Promise<string[]> {
  const keys = await getAllApiKeys();
  return keys.map(k => k.provider);
}
