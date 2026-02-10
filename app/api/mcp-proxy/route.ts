import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_HEADERS_TO_FORWARD = [
  "content-type",
  "authorization",
  "mcp-session-id",
  "mcp-protocol-version",
  "last-event-id",
  "accept",
];

/**
 * MCP Proxy — forwards browser MCP requests to remote servers to bypass CORS.
 * Supports POST (JSON-RPC), GET (SSE stream), and DELETE (session termination).
 * The target URL and auth token are passed via x-mcp-url and x-mcp-auth headers.
 */
async function proxyRequest(request: NextRequest) {
  const targetUrl = request.headers.get("x-mcp-url");
  if (!targetUrl) {
    return NextResponse.json({ error: "x-mcp-url header is required" }, { status: 400 });
  }

  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid x-mcp-url" }, { status: 400 });
  }

  // Build headers to forward
  const forwardHeaders: Record<string, string> = {};
  for (const name of ALLOWED_HEADERS_TO_FORWARD) {
    const value = request.headers.get(name);
    if (value) {
      forwardHeaders[name] = value;
    }
  }

  // Override auth if x-mcp-auth is provided
  const authToken = request.headers.get("x-mcp-auth");
  if (authToken) {
    forwardHeaders["authorization"] = `Bearer ${authToken}`;
  }

  try {
    const fetchInit: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
    };

    // Forward body for POST/PUT/PATCH
    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      fetchInit.body = await request.text();
    }

    const upstream = await fetch(targetUrl, fetchInit);

    const contentType = upstream.headers.get("content-type") || "";

    // For SSE streams, pipe through as a readable stream
    if (contentType.includes("text/event-stream") && upstream.body) {
      const responseHeaders = new Headers();
      responseHeaders.set("content-type", "text/event-stream");
      responseHeaders.set("cache-control", "no-cache");
      responseHeaders.set("connection", "keep-alive");

      // Forward MCP session headers
      const sessionId = upstream.headers.get("mcp-session-id");
      if (sessionId) {
        responseHeaders.set("mcp-session-id", sessionId);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // For JSON responses, forward normally
    const responseHeaders = new Headers();
    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }
    const sessionId = upstream.headers.get("mcp-session-id");
    if (sessionId) {
      responseHeaders.set("mcp-session-id", sessionId);
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}
