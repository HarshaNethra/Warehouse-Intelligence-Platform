/**
 * Security and sanitization utilities for Warehouse Intelligence Platform
 */

// Default trusted internal/local hosts allowed for absolute URLs
const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];

function getAllowedHosts(): Set<string> {
  const hosts = new Set<string>(DEFAULT_ALLOWED_HOSTS);
  try {
    const envHosts = (import.meta as any)?.env?.VITE_ALLOWED_ORIGINS || (import.meta as any)?.env?.VITE_ALLOWED_HOSTS;
    if (envHosts && typeof envHosts === 'string') {
      envHosts.split(',').forEach((h: string) => {
        const clean = h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (clean) hosts.add(clean);
      });
    }
  } catch {
    // Non-Vite or test environments where import.meta.env is undefined
  }
  return hosts;
}

/**
 * Validates and sanitizes URLs before rendering in href, src, or media elements.
 * 
 * Strict Allowlist Strategy:
 * 1. Safe relative paths (e.g. /data/raw/..., evidence/frame_104.png)
 * 2. Safe base64 image data URIs (image/png, image/jpeg, image/webp, image/gif)
 * 3. Safe same-origin or localhost absolute HTTP(S) URLs
 * 
 * Explicitly Rejects:
 * - javascript: and case-variant schemes (JAVASCRIPT:, jAvAsCrIpT:)
 * - vbscript: schemes
 * - malicious data: schemes (HTML, SVG, JavaScript, JSON)
 * - protocol-relative URLs (//, /\, \/, \\)
 * - untrusted external third-party origins (https://evil.example)
 * - control characters, null bytes, and malformed URI sequences
 */
export function sanitizeUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Block control characters and null bytes
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return '';
  }

  // 2. Block protocol-relative URLs (//, /\, \/, \\)
  if (/^([\\/]{2,}|[\\/][\\]|\\\/)/.test(trimmed)) {
    return '';
  }

  // 3. Block dangerous pseudo-protocols explicitly (defense-in-depth before URL parsing)
  const lower = trimmed.toLowerCase().replace(/[\s\t\r\n]+/g, '');
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return '';
  }

  // 4. Safe base64 image data URIs (PNG, JPEG, WebP, GIF)
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  // Explicitly reject any other data: URIs (e.g. data:text/html, data:image/svg+xml)
  if (lower.startsWith('data:')) {
    return '';
  }

  // 5. Allow safe absolute paths starting with /
  if (/^\/[a-zA-Z0-9_.~#?%+-]/.test(trimmed) || trimmed === '/') {
    return trimmed;
  }

  // 6. Allow safe relative paths (e.g. "evidence/frame_104.png", "data/raw/video.mp4")
  // Must start with alphanumeric and not contain colons before any slash (preventing scheme injection)
  if (/^[a-zA-Z0-9_.~%+-][a-zA-Z0-9_.~%+-/]*$/.test(trimmed) && !trimmed.includes(':')) {
    return trimmed;
  }

  // 7. Allow safe hash anchors
  if (/^#[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  // 8. Parse absolute URLs using standard URL constructor and enforce trusted origins
  try {
    const parsed = new URL(trimmed);

    // Enforce HTTP(S) protocol only
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    // Check if origin matches current window location (in browser environment)
    if (typeof window !== 'undefined' && window.location?.origin) {
      if (parsed.origin === window.location.origin) {
        return parsed.toString();
      }
    }

    // Check if hostname is an allowed development/local service host or configured origin
    const hostname = parsed.hostname.toLowerCase();
    if (getAllowedHosts().has(hostname)) {
      return parsed.toString();
    }

    // Reject untrusted external origins (e.g. https://evil.example)
    return '';
  } catch {
    // Malformed URL
    return '';
  }
}

/**
 * Strips HTML tags, null bytes, and non-printable control characters from user text.
 * Preserves normal punctuation (apostrophes, quotes, ampersands) so strings render naturally in React.
 */
export function sanitizeText(text?: string | null): string {
  if (text === null || text === undefined) return '';
  const str = String(text);

  // Filter out ASCII control characters (0-8, 11, 12, 14-31, 127) using charCodeAt
  let clean = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      continue;
    }
    clean += str[i];
  }

  return clean
    .replace(/<[^>]*>/g, '')
    .trim();
}
