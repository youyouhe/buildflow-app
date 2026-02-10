"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

async function mcpProxyCall(action: string, params: Record<string, unknown>) {
  const res = await fetch("/api/mcp-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `MCP proxy error: ${res.status}`);
  }
  return data;
}

export function useMcp() {
  const [servers, setServers] = useState<McpServerState[]>([]);
  const [loading, setLoading] = useState(true);
  // Map server ID → proxy session ID
  const sessionsRef = useRef<Map<string, string>>(new Map());

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

  // Cleanup all sessions on unmount
  useEffect(() => {
    return () => {
      sessionsRef.current.forEach(async (sessionId) => {
        try {
          await mcpProxyCall("disconnect", { sessionId });
        } catch {
          // ignore cleanup errors
        }
      });
      sessionsRef.current.clear();
    };
  }, []);

  const connectServer = useCallback(async (serverId: string) => {
    setServers((prev) =>
      prev.map((s) =>
        s.config.id === serverId ? { ...s, status: "connecting", error: undefined } : s
      )
    );

    try {
      const config = await getMcpServer(serverId);
      if (!config) throw new Error("Server not found");

      // Disconnect existing session if any
      const existingSession = sessionsRef.current.get(serverId);
      if (existingSession) {
        try {
          await mcpProxyCall("disconnect", { sessionId: existingSession });
        } catch {
          // ignore
        }
      }

      // Connect via server-side proxy (handles Streamable HTTP + SSE fallback)
      const { sessionId } = await mcpProxyCall("connect", {
        url: config.url,
        authToken: config.authToken,
      });

      sessionsRef.current.set(serverId, sessionId);

      // List tools
      const { tools } = await mcpProxyCall("list-tools", { sessionId });

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId
            ? { ...s, status: "connected", tools: tools || [], error: undefined }
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
      sessionsRef.current.delete(serverId);
    }
  }, []);

  const disconnectServer = useCallback(async (serverId: string) => {
    const sessionId = sessionsRef.current.get(serverId);
    if (sessionId) {
      try {
        await mcpProxyCall("disconnect", { sessionId });
      } catch {
        // ignore
      }
      sessionsRef.current.delete(serverId);
    }

    setServers((prev) =>
      prev.map((s) =>
        s.config.id === serverId ? { ...s, status: "idle", tools: [], error: undefined } : s
      )
    );
  }, []);

  const testConnection = useCallback(
    async (config: Pick<McpServerConfig, "name" | "url" | "authToken">): Promise<{ success: boolean; toolCount?: number; error?: string }> => {
      try {
        const { sessionId } = await mcpProxyCall("connect", {
          url: config.url,
          authToken: config.authToken,
        });

        const { tools } = await mcpProxyCall("list-tools", { sessionId });

        await mcpProxyCall("disconnect", { sessionId });

        return { success: true, toolCount: tools?.length || 0 };
      } catch (err) {
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
      const sessionId = sessionsRef.current.get(serverId);
      if (!sessionId) throw new Error("Server not connected");

      return await mcpProxyCall("call-tool", { sessionId, toolName, arguments: args });
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
