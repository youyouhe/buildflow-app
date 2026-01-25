import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  isValidUrl,
  getDomain,
  htmlToMarkdown,
  truncateMarkdown,
} from "@/lib/scraping/html-to-markdown";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MARKDOWN_LENGTH = 50000; // 50KB of markdown

/**
 * Re-design endpoint
 * Fetches a URL, converts to markdown, and returns for AI redesign
 */
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.REDESIGN);

    if (rateLimit.limited) {
      console.warn(`[Re-design] Rate limit exceeded for IP: ${clientIp}`);
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMITS.REDESIGN.limit.toString(),
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
      console.warn("[Re-design] Missing URL in request");
      return NextResponse.json(
        { ok: false, error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    if (!isValidUrl(url)) {
      console.warn(`[Re-design] Invalid URL: ${url}`);
      return NextResponse.json(
        { ok: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const domain = getDomain(url);
    console.log(`[Re-design] Starting redesign for: ${domain}`);

    // Try direct fetch first
    let html: string | null = null;
    let fetchMethod = "direct";

    try {
      html = await fetchUrlDirect(url);
      console.log(`[Re-design] Direct fetch success: ${domain}`);
    } catch (error) {
      console.log(`[Re-design] Direct fetch failed, trying CORS proxy: ${domain}`);
      fetchMethod = "proxy";

      try {
        html = await fetchUrlViaProxy(url, request);
        console.log(`[Re-design] CORS proxy success: ${domain}`);
      } catch (proxyError) {
        console.error(`[Re-design] All fetch methods failed for ${domain}:`, proxyError);
        // Silent fail - just log the error
        return NextResponse.json(
          { ok: false, error: "Failed to fetch website content" },
          { status: 502 }
        );
      }
    }

    if (!html) {
      console.error(`[Re-design] No HTML content received for ${domain}`);
      return NextResponse.json(
        { ok: false, error: "No content received from URL" },
        { status: 502 }
      );
    }

    // Convert HTML to Markdown
    console.log(`[Re-design] Converting HTML to markdown: ${domain}`);
    let markdown: string;

    try {
      markdown = htmlToMarkdown(html, url);

      // Truncate if too long
      if (markdown.length > MAX_MARKDOWN_LENGTH) {
        console.warn(
          `[Re-design] Markdown too long (${markdown.length} chars), truncating to ${MAX_MARKDOWN_LENGTH}`
        );
        markdown = truncateMarkdown(markdown, MAX_MARKDOWN_LENGTH);
      }

      console.log(
        `[Re-design] Conversion success: ${domain} (${markdown.length} chars, method: ${fetchMethod})`
      );

      return NextResponse.json(
        { ok: true, markdown },
        {
          status: 200,
          headers: {
            "X-RateLimit-Limit": RATE_LIMITS.REDESIGN.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-Fetch-Method": fetchMethod,
          },
        }
      );
    } catch (conversionError) {
      console.error(`[Re-design] Markdown conversion error for ${domain}:`, conversionError);
      return NextResponse.json(
        { ok: false, error: "Failed to convert HTML to markdown" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Re-design] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fetch URL directly (works for sites without CORS restrictions)
 */
async function fetchUrlDirect(url: string): Promise<string> {
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
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch URL via internal CORS proxy (fallback)
 */
async function fetchUrlViaProxy(url: string, request: NextRequest): Promise<string> {
  const proxyUrl = new URL("/api/cors-proxy", request.url);

  const response = await fetch(proxyUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": request.headers.get("origin") || "",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "CORS proxy failed");
  }

  const data = await response.json();

  if (!data.ok || !data.html) {
    throw new Error("Invalid response from CORS proxy");
  }

  return data.html;
}
