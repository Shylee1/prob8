/**
 * SSRF protection for admin-configured outbound webhook URLs.
 * Blocks loopback, link-local, cloud metadata, and RFC1918 / RFC4193 private IP targets.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!clean.includes(':')) return false;
  if (clean === '::' || clean === '::1') return true;
  if (clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) return true;
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice('::ffff:'.length);
    if (isPrivateOrReservedIpv4(mapped)) return true;
  }
  return false;
}

export function isSafeExternalWebhookUrl(rawUrl: string): { safe: boolean; reason?: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { safe: false, reason: 'Provide a webhook URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'Provide a valid http:// or https:// webhook URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Only http:// and https:// webhook URLs are permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { safe: false, reason: 'Webhook URL must include a valid public hostname.' };
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return {
      safe: false,
      reason: 'Blocked private/internal hostname for SSRF protection.',
    };
  }

  // Block integer/hex/octal obfuscated IPv4 literals (e.g. 2130706433 or 0x7f000001)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    return {
      safe: false,
      reason: 'Numeric/hex IP hostnames are blocked for SSRF protection.',
    };
  }

  if (isPrivateOrReservedIpv4(hostname) || isPrivateOrReservedIpv6(hostname)) {
    return {
      safe: false,
      reason: 'Blocked private, loopback, or cloud-metadata IP address for SSRF protection.',
    };
  }

  return { safe: true };
}
