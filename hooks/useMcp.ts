"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig, McpConnectionStatus } from "@/types";
import {
  getAllMcpServers,
  getMcpServer,
  saveMcpServer,
  deleteMcpServer as deleteServerFromDB,
  updateMcpServer,
  ensureBuiltInServers,
} from "@/lib/indexeddb/mcpServers";

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: object;
}

interface McpServerState {
  config: McpServerConfig;
  status: McpConnectionStatus;
  tools: McpTool[];
  error?: string;
}

function createTransport(config: Pick<McpServerConfig, "url" | "authToken">) {
  const requestInit: RequestInit = {};
  if (config.authToken) {
    requestInit.headers = {
      Authorization: `Bearer ${config.authToken}`,
    };
  }
  return new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit,
  });
}

export function useMcp() {
  const [servers, setServers] = useState<McpServerState[]>([]);
  const [loading, setLoading] = useState(true);
  const clientsRef = useRef<Map<string, Client>>(new Map());

  // Load servers from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;

    const loadServers = async () => {
      await ensureBuiltInServers();
      const configs = await getAllMcpServers();
      if (cancelled) return;

      setServers(
        configs.map((config) => ({
          config,
          status: "idle" as McpConnectionStatus,
          tools: [],
        }))
      );
      setLoading(false);
    };

    loadServers();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup all clients on unmount
  useEffect(() => {
    return () => {
      clientsRef.current.forEach(async (client) => {
        try {
          await client.close();
        } catch {
          // ignore cleanup errors
        }
      });
      clientsRef.current.clear();
    };
  }, []);

  const connectServer = useCallback(async (serverId: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.config.id === serverId ? { ...s, status: "connecting", error: undefined } : s
      )
    );

    try {
      // Read config from IndexedDB (source of truth) to avoid React batching issues
      const config = await getMcpServer(serverId);
      if (!config) throw new Error("Server not found");

      // Close existing client if any
      const existingClient = clientsRef.current.get(serverId);
      if (existingClient) {
        try {
          await existingClient.close();
        } catch {
          // ignore
        }
      }

      const client = new Client(
        { name: "buildflow", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = createTransport(config);
      await client.connect(transport);

      clientsRef.current.set(serverId, client);

      const result = await client.listTools();
      const tools: McpTool[] = result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId
            ? { ...s, status: "connected", tools, error: undefined }
            : s
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId ? { ...s, status: "error", error: message, tools: [] } : s
        )
      );
      clientsRef.current.delete(serverId);
    }
  }, []);

  const disconnectServer = useCallback(async (serverId: string) => {
    const client = clientsRef.current.get(serverId);
    if (client) {
      try {
        await client.close();
      } catch {
        // ignore
      }
      clientsRef.current.delete(serverId);
    }

    setServers((prev) =>
      prev.map((s) =>
        s.config.id === serverId ? { ...s, status: "idle", tools: [], error: undefined } : s
      )
    );
  }, []);

  const testConnection = useCallback(
    async (config: Pick<McpServerConfig, "name" | "url" | "authToken">): Promise<{ success: boolean; toolCount?: number; error?: string }> => {
      let client: Client | null = null;
      try {
        client = new Client(
          { name: "buildflow-test", version: "1.0.0" },
          { capabilities: {} }
        );

        const transport = createTransport(config);
        await client.connect(transport);

        const result = await client.listTools();
        await client.close();

        return { success: true, toolCount: result.tools.length };
      } catch (err) {
        try {
          await client?.close();
        } catch {
          // ignore
        }
        const message = err instanceof Error ? err.message : "Connection failed";
        return { success: false, error: message };
      }
    },
    []
  );

  const addServer = useCallback(
    async (config: Omit<McpServerConfig, "id" | "createdAt">) => {
      const newConfig: McpServerConfig = {
        ...config,
        id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
      };

      await saveMcpServer(newConfig);

      setServers((prev) => [
        ...prev,
        { config: newConfig, status: "idle", tools: [] },
      ]);

      return newConfig;
    },
    []
  );

  const editServer = useCallback(
    async (id: string, partial: Partial<Omit<McpServerConfig, "id" | "createdAt" | "isBuiltIn">>) => {
      await updateMcpServer(id, partial);

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === id
            ? { ...s, config: { ...s.config, ...partial } }
            : s
        )
      );
    },
    []
  );

  const removeServer = useCallback(
    async (id: string) => {
      await disconnectServer(id);
      await deleteServerFromDB(id);

      setServers((prev) => prev.filter((s) => s.config.id !== id));
    },
    [disconnectServer]
  );

  const toggleServer = useCallback(
    async (id: string, enabled: boolean) => {
      await updateMcpServer(id, { enabled });

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === id ? { ...s, config: { ...s.config, enabled } } : s
        )
      );

      if (!enabled) {
        await disconnectServer(id);
      }
    },
    [disconnectServer]
  );

  const callTool = useCallback(
    async (serverId: string, toolName: string, args: Record<string, unknown> = {}) => {
      const client = clientsRef.current.get(serverId);
      if (!client) throw new Error("Server not connected");

      return await client.callTool({ name: toolName, arguments: args });
    },
    []
  );

  return {
    servers,
    loading,
    connectServer,
    disconnectServer,
    testConnection,
    addServer,
    editServer,
    removeServer,
    toggleServer,
    callTool,
  };
}
