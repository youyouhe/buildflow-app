import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface McpSession {
  client: Client;
  url: string;
  createdAt: number;
}

// In-memory session store (server-side singleton)
const sessions = new Map<string, McpSession>();

// Session timeout: 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000;

function generateSessionId(): string {
  return `mcp-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      try {
        session.client.close();
      } catch {
        // ignore
      }
      sessions.delete(id);
    }
  }
}

export async function mcpConnect(
  url: string,
  authToken?: string
): Promise<{ sessionId: string }> {
  cleanupStaleSessions();

  const client = new Client(
    { name: "buildflow", version: "1.0.0" },
    { capabilities: {} }
  );

  // Try Streamable HTTP first, fall back to SSE
  try {
    const requestInit: RequestInit = {};
    if (authToken) {
      requestInit.headers = { Authorization: `Bearer ${authToken}` };
    }
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit,
    });
    await client.connect(transport);
  } catch (err) {
    // If Streamable HTTP fails (e.g. 405), try SSE transport
    const isMethodNotAllowed =
      err instanceof Error &&
      (err.message.includes("405") || err.message.includes("Method Not Allowed"));

    if (!isMethodNotAllowed) {
      throw err;
    }

    // Close the failed client and create a new one for SSE
    try { await client.close(); } catch { /* ignore */ }

    const sseClient = new Client(
      { name: "buildflow", version: "1.0.0" },
      { capabilities: {} }
    );

    const sseUrl = new URL(url);
    const eventSourceInit = authToken
      ? {
          fetch: (url: string | URL, init?: RequestInit) =>
            fetch(url, {
              ...init,
              headers: {
                ...Object.fromEntries(new Headers(init?.headers).entries()),
                Authorization: `Bearer ${authToken}`,
              },
            }),
        }
      : undefined;

    const sseTransport = new SSEClientTransport(sseUrl, {
      eventSourceInit,
      requestInit: authToken
        ? { headers: { Authorization: `Bearer ${authToken}` } }
        : undefined,
    });

    await sseClient.connect(sseTransport);

    const sessionId = generateSessionId();
    sessions.set(sessionId, {
      client: sseClient,
      url,
      createdAt: Date.now(),
    });
    return { sessionId };
  }

  const sessionId = generateSessionId();
  sessions.set(sessionId, { client, url, createdAt: Date.now() });
  return { sessionId };
}

export async function mcpListTools(
  sessionId: string
): Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: object }> }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const result = await session.client.listTools();
  return {
    tools: result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
}

export async function mcpCallTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown> = {}
) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  return await session.client.callTool({ name: toolName, arguments: args });
}

export async function mcpDisconnect(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    await session.client.close();
  } catch {
    // ignore
  }
  sessions.delete(sessionId);
}
