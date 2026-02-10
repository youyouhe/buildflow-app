/**
 * BuildFlow Type Definitions
 */

// ==========================================
// User Types
// ==========================================

export interface User {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
  token?: string;
}

// ==========================================
// Project Types
// ==========================================

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
  content: string;
  language: string; // html, css, javascript
  size: number;
}

export interface PromptEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Legacy types for backward compatibility
export interface Page {
  path: string;
  html: string;
  content?: string;
}

// ==========================================
// AI Provider Types
// ==========================================

export type AIProviderName = 'openai' | 'google' | 'deepseek' | 'zhipu' | 'openrouter';

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey?: string;
  model: string;
  baseURL?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ==========================================
// Settings Types
// ==========================================

export interface ModelPreset {
  id: string;
  name: string;
  model: string;
  provider: string;
  createdAt: number;
}

export interface Settings {
  theme?: 'dark' | 'light';
  defaultAiProvider?: AIProviderName;
  defaultAiModel?: string;
  autoSave?: boolean;
  autoSync?: boolean;
  preferredDeployment?: 'github' | 'vercel';
  promptDetail?: 'light' | 'full';
  language?: 'en' | 'zh';
  modelPresets?: ModelPreset[];
  favoriteModels?: string[];
  // Last selected AI provider and model (auto-saved)
  lastSelectedProvider?: string;
  lastSelectedModel?: string;
}

export type Theme = 'dark' | 'light';

export interface EnhancedSettings {
  isActive: boolean;
  primaryColor: string | undefined;
  secondaryColor: string | undefined;
  theme: Theme;
  promptDetail: 'light' | 'full';
  language: 'en' | 'zh';
}

// ==========================================
// GitHub Types
// ==========================================

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  language: string | null;
  default_branch: string;
}

export interface EditorProject {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  owner: string;
  url: string;
  defaultBranch: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

// ==========================================
// Deployment Types
// ==========================================

export type DeploymentPlatform = 'github' | 'vercel';

export interface DeploymentStatus {
  status: 'pending' | 'building' | 'ready' | 'error';
  url?: string;
  message?: string;
  created_at: Date;
}

export interface DeploymentConfig {
  platform: DeploymentPlatform;
  github?: {
    owner: string;
    repo: string;
    branch: string;
  };
  vercel?: {
    projectId: string;
    teamId?: string;
  };
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==========================================
// IndexedDB Types
// ==========================================

export interface ApiKeyEntry {
  provider: string;
  encryptedKey: string;
  isValid: boolean;
  lastValidatedAt?: number;
  updatedAt: number;
}

// ==========================================
// Legacy Types (for migration compatibility)
// ==========================================

export interface HtmlHistory {
  pages: Page[];
  createdAt: Date;
  prompt: string;
}

export interface Commit {
  title: string;
  oid: string;
  date: Date;
}

// ==========================================
// Community Types
// ==========================================

export interface CommunityProject {
  id: string;
  profile_id: string;
  category_id?: string;
  title: string;
  description?: string;
  thumbnail?: string;
  files_jsonb: CommunityProjectFile[];
  prompts_jsonb?: PromptEntry[];
  github_repo?: {
    owner: string;
    repo: string;
    branch: string;
    pagesUrl?: string;
  } | null;
  vercel_deployment?: {
    projectId: string;
    deploymentUrl: string;
    productionUrl?: string;
  } | null;
  visibility: 'public' | 'private';
  views_count: number;
  downloads_count: number;
  forks_count: number;
  likes_count: number;
  file_count: number;
  total_size: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  profile?: CommunityProfile;
  user_liked?: boolean;
}

export interface CommunityProjectFile {
  path: string;
  content: string;
  language: string;
  size: number;
  compressed?: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active?: boolean;
}

export interface CommunityProfile {
  id: string;
  github_id: number;
  github_login: string;
  github_name?: string;
  github_email?: string;
  github_avatar_url: string;
  github_bio?: string;
}

export interface SupabaseUser {
  id: string;
  githubId: number;
  githubLogin: string;
  githubName: string | null;
  githubEmail: string | null;
  githubAvatarUrl: string;
  githubBio: string | null;
}

// ==========================================
// MCP Server Types
// ==========================================

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  authToken?: string;
  enabled: boolean;
  isBuiltIn?: boolean;
  createdAt: number;
}

export type McpConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
