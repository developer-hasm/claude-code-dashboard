// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Security Utilities
// ---------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

// ── Token Management ───────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure 256-bit hex token for server
 * authentication.
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate that the incoming request carries a valid Bearer token that matches
 * the server's expected token.
 *
 * Accepts the token in the `Authorization: Bearer <token>` header or in the
 * `token` query parameter as a fallback (for EventSource / SSE connections
 * that cannot set custom headers).
 */
export function validateToken(request: Request, serverToken: string): boolean {
  // Header: Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return timingSafeEqual(parts[1], serverToken);
    }
  }

  // Fallback: ?token=<token> query parameter
  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      return timingSafeEqual(queryToken, serverToken);
    }
  } catch {
    // Malformed URL — reject
  }

  return false;
}

/**
 * Constant-time string comparison to prevent timing attacks on token
 * validation.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

// ── CORS ───────────────────────────────────────────────────────────────────

/**
 * Build CORS headers that restrict access to the expected dashboard origin.
 *
 * Only `http://localhost:<port>` and `http://127.0.0.1:<port>` are accepted.
 */
export function corsHeaders(
  origin: string | null,
  port: number,
): Record<string, string> {
  const allowedOrigins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ];

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

// ── Host Validation ────────────────────────────────────────────────────────

/**
 * Ensure the `Host` header targets `localhost` or `127.0.0.1` on the expected
 * port.  This mitigates DNS rebinding attacks.
 */
export function validateHost(request: Request, port: number): boolean {
  const host = request.headers.get('host');
  if (!host) return false;

  const allowedHosts = [
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    // Some clients omit the port for default HTTP port 80
    ...(port === 80 ? ['localhost', '127.0.0.1'] : []),
  ];

  return allowedHosts.includes(host.toLowerCase());
}

// ── Path Validation ────────────────────────────────────────────────────────

/**
 * Validate that a resolved file path falls within one of the allowed
 * directory prefixes.  This prevents directory-traversal attacks.
 *
 * Both `filePath` and every entry in `allowedPrefixes` are resolved to
 * absolute paths before comparison.
 */
export function validatePath(
  filePath: string,
  allowedPrefixes: string[],
): boolean {
  const resolved = resolve(filePath);
  return allowedPrefixes.some((prefix) => {
    const resolvedPrefix = resolve(prefix);
    // Ensure the resolved path starts with the prefix followed by a path
    // separator (or is exactly equal), so that "/allowed-dir-extra" does not
    // pass when only "/allowed-dir" is permitted.
    return (
      resolved === resolvedPrefix ||
      resolved.startsWith(resolvedPrefix + '/') ||
      resolved.startsWith(resolvedPrefix + '\\')
    );
  });
}

// ── Rate Limiter ───────────────────────────────────────────────────────────

export interface RateLimiter {
  /** Returns `true` if the request is allowed, `false` if rate-limited. */
  check(): boolean;
  /** Reset the limiter state (e.g. after a successful auth). */
  reset(): void;
}

/**
 * Create a sliding-window rate limiter.
 *
 * @param maxRequests  Maximum number of requests allowed within the window.
 * @param windowMs     Window duration in milliseconds.
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
): RateLimiter {
  let timestamps: number[] = [];

  return {
    check(): boolean {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Evict expired entries
      timestamps = timestamps.filter((ts) => ts > windowStart);

      if (timestamps.length >= maxRequests) {
        return false;
      }

      timestamps.push(now);
      return true;
    },

    reset(): void {
      timestamps = [];
    },
  };
}

// ── Content Security Policy ────────────────────────────────────────────────

/**
 * Strict CSP header suitable for a locally-served dashboard SPA.
 *
 * - Only same-origin scripts and styles are permitted.
 * - Inline styles are allowed via `'unsafe-inline'` for CSS-in-JS libraries.
 * - No `eval` or inline scripts.
 * - Connections are restricted to same-origin and localhost WebSocket.
 */
export const CSP_HEADER: string = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');
