import { NextRequest, NextResponse } from "next/server";
import {
  mcpConnect,
  mcpListTools,
  mcpCallTool,
  mcpDisconnect,
} from "@/lib/mcp-session-manager";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * MCP Proxy — manages MCP server connections on the server side.
 * Handles both Streamable HTTP and SSE transports transparently.
 *
 * Actions:
 *   connect      { url, authToken? }                → { sessionId }
 *   list-tools   { sessionId }                      → { tools }
 *   call-tool    { sessionId, toolName, arguments? } → { result }
 *   disconnect   { sessionId }                      → { ok: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "connect": {
        const { url, authToken } = body;
        if (!url) {
          return NextResponse.json({ error: "url is required" }, { status: 400 });
        }
        const result = await mcpConnect(url, authToken);
        return NextResponse.json(result);
      }

      case "list-tools": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }
        const result = await mcpListTools(sessionId);
        return NextResponse.json(result);
      }

      case "call-tool": {
        const { sessionId, toolName, arguments: args } = body;
        if (!sessionId || !toolName) {
          return NextResponse.json(
            { error: "sessionId and toolName are required" },
            { status: 400 }
          );
        }
        const result = await mcpCallTool(sessionId, toolName, args || {});
        return NextResponse.json(result);
      }

      case "disconnect": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }
        await mcpDisconnect(sessionId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[MCP Proxy]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
