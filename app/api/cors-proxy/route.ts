import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { isValidUrl, getDomain } from "@/lib/scraping/html-to-markdown";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * CORS Proxy endpoint
 * Fetches URLs server-side to bypass CORS restrictions
 * Security: Rate limited and origin-checked
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Check origin (must be from same domain)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    
    if (origin && host) {
      const originUrl = new URL(origin);
      if (originUrl.host !== host && !origin.includes("localhost")) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid origin" },
          { status: 403 }
        );
      }
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.CORS_PROXY);

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          resetAt: rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMITS.CORS_PROXY.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": (rateLimit.resetAt || Date.now()).toString(),
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    if (!isValidUrl(url)) {
      console.warn(`[CORS Proxy] Invalid URL attempted: ${url}`);
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }

    const domain = getDomain(url);
    console.log(`[CORS Proxy] Fetching: ${domain}`);

    // Fetch URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "buildflow-Bot/1.0 (Website Redesign Tool)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[CORS Proxy] HTTP ${response.status} for ${domain}`);
        return NextResponse.json(
          { error: `Failed to fetch: HTTP ${response.status}` },
          { status: 502 }
        );
      }

      // Check content type
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        console.warn(`[CORS Proxy] Non-HTML content type: ${contentType}`);
        return NextResponse.json(
          { error: "URL does not return HTML content" },
          { status: 422 }
        );
      }

      // Get content length
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        console.warn(`[CORS Proxy] Response too large: ${contentLength} bytes`);
        return NextResponse.json(
          { error: "Response too large (max 5MB)" },
          { status: 413 }
        );
      }

      // Read response
      const html = await response.text();

      // Check actual size
      if (html.length > MAX_RESPONSE_SIZE) {
        console.warn(`[CORS Proxy] Response too large: ${html.length} bytes`);
        return NextResponse.json(
          { error: "Response too large (max 5MB)" },
          { status: 413 }
        );
      }

      console.log(`[CORS Proxy] Success: ${domain} (${html.length} bytes)`);

      return NextResponse.json(
        { ok: true, html },
        {
          status: 200,
          headers: {
            "X-RateLimit-Limit": RATE_LIMITS.CORS_PROXY.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          },
        }
      );
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if ((error as Error).name === "AbortError") {
        console.error(`[CORS Proxy] Timeout for ${domain}`);
        return NextResponse.json(
          { error: "Request timeout" },
          { status: 408 }
        );
      }

      console.error(`[CORS Proxy] Fetch error for ${domain}:`, error);
      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[CORS Proxy] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
