/**
 * Simple in-memory rate limiter
 * Tracks requests per IP address and enforces limits
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if an IP address is rate limited
   * @param identifier - Usually IP address or user ID
   * @param limit - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if rate limit exceeded
   */
  isRateLimited(identifier: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetAt) {
      // First request or window expired
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      });
      return false;
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return true;
    }

    // Increment count
    entry.count++;
    return false;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(identifier: string, limit: number, windowMs: number): number {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetAt) {
      return limit;
    }

    return Math.max(0, limit - entry.count);
  }

  /**
   * Get reset time for an identifier
   */
  getResetTime(identifier: string): number | null {
    const entry = this.requests.get(identifier);
    return entry ? entry.resetAt : null;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetAt) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear() {
    this.requests.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }
}

// Global instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  REDESIGN: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  CORS_PROXY: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: { limit: number; windowMs: number }
): { limited: boolean; remaining: number; resetAt: number | null } {
  const limited = rateLimiter.isRateLimited(
    identifier,
    config.limit,
    config.windowMs
  );
  const remaining = rateLimiter.getRemaining(
    identifier,
    config.limit,
    config.windowMs
  );
  const resetAt = rateLimiter.getResetTime(identifier);

  return { limited, remaining, resetAt };
}

/**
 * Extract IP address from request
 */
export function getClientIp(request: Request): string {
  // Try to get real IP from headers (for proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to "unknown" if we can't determine IP
  return "unknown";
}

export { rateLimiter };
