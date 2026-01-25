import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema definition
export interface BuildFlowDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': number };
  };
  apiKeys: {
    key: string; // provider name
    value: ApiKeyEntry;
  };
  settings: {
    key: string;
    value: unknown;
  };
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  
  // GitHub integration
  github?: {
    owner: string;
    repo: string;
    branch: string;
    defaultBranch: string;
    pagesUrl?: string;
    lastSyncAt?: number;
  };
  
  // Vercel integration
  vercel?: {
    projectId: string;
    deploymentUrl: string;
    productionUrl?: string;
  };
  
  // Project files
  files: ProjectFile[];
  
  // AI conversation history
  prompts: PromptEntry[];
  
  // Project thumbnail
  thumbnail?: string;  // Base64 encoded JPEG screenshot
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  deployedAt?: number;
}

export interface ProjectFile {
  path: string; // e.g., index.html, style.css, script.js
  content: string; // Compressed or raw content
  language: string; // html, css, javascript
  size: number; // Original uncompressed size
  compressed?: boolean; // Whether content is compressed
}

export interface PromptEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ApiKeyEntry {
  provider: string; // openai, google, deepseek, etc.
  encryptedKey: string; // AES encrypted
  isValid: boolean;
  lastValidatedAt?: number;
  updatedAt: number;
}

export interface Settings {
  theme?: 'dark' | 'light';
  defaultAiProvider?: string;
  defaultAiModel?: string;
  autoSave?: boolean;
  autoSync?: boolean;
  preferredDeployment?: 'github' | 'vercel';
  promptDetail?: 'light' | 'full';
  language?: 'en' | 'zh';
  modelPresets?: Array<{
    id: string;
    name: string;
    model: string;
    provider: string;
    createdAt: number;
  }>;
  favoriteModels?: string[];
  // Last selected AI provider and model (auto-saved)
  lastSelectedProvider?: string;
  lastSelectedModel?: string;
}

let dbInstance: IDBPDatabase<BuildFlowDB> | null = null;

/**
 * Initialize and return the IndexedDB database instance
 */
export async function getDB(): Promise<IDBPDatabase<BuildFlowDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<BuildFlowDB>('buildflow-db', 1, {
    upgrade(db) {
      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-updated', 'updatedAt');
      }
      
      // API Keys store
      if (!db.objectStoreNames.contains('apiKeys')) {
        db.createObjectStore('apiKeys', { keyPath: 'provider' });
      }
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });

  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
