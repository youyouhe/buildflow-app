import { getDB, Settings } from './index';

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  defaultAiProvider: 'openai',
  defaultAiModel: 'gpt-4o-mini',
  autoSave: true,
  autoSync: false,
  preferredDeployment: 'github',
  promptDetail: 'light',
  language: 'en',
  modelPresets: [],
  favoriteModels: [],
  lastSelectedProvider: 'auto',
  lastSelectedModel: 'gpt-4o-mini',
};

/**
 * Get a specific setting
 */
export async function getSetting<K extends keyof Settings>(
  key: K
): Promise<Settings[K] | undefined> {
  const db = await getDB();
  const value = await db.get('settings', key);
  return value !== undefined ? (value as Settings[K]) : DEFAULT_SETTINGS[key];
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<Settings> {
  const db = await getDB();
  const tx = db.transaction('settings', 'readonly');
  const keys = await tx.store.getAllKeys();
  const settings: Settings = { ...DEFAULT_SETTINGS };
  
  for (const key of keys) {
    const value = await tx.store.get(key);
    if (value !== undefined) {
      settings[key as keyof Settings] = value as any;
    }
  }
  
  await tx.done;
  return settings;
}

/**
 * Set a specific setting
 */
export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

/**
 * Set multiple settings at once
 */
export async function setSettings(settings: Partial<Settings>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('settings', 'readwrite');
  
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      await tx.store.put(value, key);
    }
  }
  
  await tx.done;
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('settings', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

/**
 * Delete a specific setting (will fall back to default)
 */
export async function deleteSetting(key: keyof Settings): Promise<void> {
  const db = await getDB();
  await db.delete('settings', key);
}

/**
 * Add a model preset
 */
export async function addModelPreset(preset: {
  name: string;
  model: string;
  provider: string;
}): Promise<void> {
  const presets = (await getSetting('modelPresets')) || [];
  
  // Check for duplicates (same model + provider combination)
  const isDuplicate = presets.some(
    p => p.model === preset.model && p.provider === preset.provider
  );
  
  if (isDuplicate) {
    throw new Error('A preset with this model and provider combination already exists');
  }
  
  const newPreset = {
    ...preset,
    id: `preset-${Date.now()}`,
    createdAt: Date.now(),
  };
  await setSetting('modelPresets', [...presets, newPreset]);
}

/**
 * Remove a model preset
 */
export async function removeModelPreset(presetId: string): Promise<void> {
  const presets = (await getSetting('modelPresets')) || [];
  await setSetting('modelPresets', presets.filter(p => p.id !== presetId));
}

/**
 * Get all model presets
 */
export async function getModelPresets() {
  return (await getSetting('modelPresets')) || [];
}

/**
 * Toggle a model as favorite
 */
export async function toggleFavoriteModel(modelValue: string): Promise<void> {
  const favorites = (await getSetting('favoriteModels')) || [];
  if (favorites.includes(modelValue)) {
    await setSetting('favoriteModels', favorites.filter(m => m !== modelValue));
  } else {
    await setSetting('favoriteModels', [...favorites, modelValue]);
  }
}

/**
 * Get favorite models
 */
export async function getFavoriteModels(): Promise<string[]> {
  return (await getSetting('favoriteModels')) || [];
}

/**
 * Remove duplicate presets (keep the first occurrence of each model+provider combination)
 */
export async function deduplicatePresets(): Promise<number> {
  const presets = (await getSetting('modelPresets')) || [];
  const seen = new Set<string>();
  const uniquePresets = [];
  let duplicatesRemoved = 0;
  
  for (const preset of presets) {
    const key = `${preset.model}:${preset.provider}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePresets.push(preset);
    } else {
      duplicatesRemoved++;
    }
  }
  
  if (duplicatesRemoved > 0) {
    await setSetting('modelPresets', uniquePresets);
  }
  
  return duplicatesRemoved;
}
