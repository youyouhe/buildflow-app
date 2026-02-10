import { getDB } from './index';
import type { McpServerConfig } from '@/types';

/**
 * Get all MCP server configs
 */
export async function getAllMcpServers(): Promise<McpServerConfig[]> {
  const db = await getDB();
  return await db.getAll('mcpServers');
}

/**
 * Get a specific MCP server config
 */
export async function getMcpServer(id: string): Promise<McpServerConfig | undefined> {
  const db = await getDB();
  return await db.get('mcpServers', id);
}

/**
 * Save a new MCP server config
 */
export async function saveMcpServer(config: McpServerConfig): Promise<void> {
  const db = await getDB();
  await db.put('mcpServers', config);
}

/**
 * Delete an MCP server config
 */
export async function deleteMcpServer(id: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.get('mcpServers', id);
  if (!existing) return false;
  await db.delete('mcpServers', id);
  return true;
}

/**
 * Update an existing MCP server config (partial update)
 */
export async function updateMcpServer(
  id: string,
  partial: Partial<Omit<McpServerConfig, 'id'>>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('mcpServers', id);
  if (!existing) {
    throw new Error(`MCP server with id ${id} not found`);
  }
  await db.put('mcpServers', { ...existing, ...partial });
}

/**
 * Ensure the built-in Stitch server exists
 */
export const STITCH_SERVER_ID = 'builtin-stitch';

export async function ensureBuiltInServers(): Promise<void> {
  const db = await getDB();
  const stitch = await db.get('mcpServers', STITCH_SERVER_ID);
  if (!stitch) {
    await db.put('mcpServers', {
      id: STITCH_SERVER_ID,
      name: 'Google Stitch',
      url: 'https://stitch.withgoogle.com/mcp',
      enabled: false,
      isBuiltIn: true,
      createdAt: Date.now(),
    });
  }
}
