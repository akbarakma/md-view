const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_PER_HOUR = 30;
const MAX_PER_DAY = 100;

const createsByIp = new Map<string, number[]>();
let lastSweep = 0;

/**
 * Take one create slot for this IP, or return null when it is over the limit.
 * Call the returned release() when no document was actually created.
 * In-memory, so it resets on every restart and assumes a single app instance.
 */
export function reserveCreate(ip: string): (() => void) | null {
  const now = Date.now();
  if (now - lastSweep >= HOUR_MS) {
    lastSweep = now;
    for (const [key, times] of createsByIp) {
      if (now - times[times.length - 1] >= DAY_MS) createsByIp.delete(key);
    }
  }
  const key = limitKey(ip);
  const recent = (createsByIp.get(key) ?? []).filter((t) => now - t < DAY_MS);
  const lastHour = recent.filter((t) => now - t < HOUR_MS).length;
  if (recent.length >= MAX_PER_DAY || lastHour >= MAX_PER_HOUR) {
    createsByIp.set(key, recent);
    return null;
  }
  recent.push(now);
  createsByIp.set(key, recent);
  return () => {
    const times = createsByIp.get(key);
    const i = times?.lastIndexOf(now) ?? -1;
    if (times && i !== -1) times.splice(i, 1);
  };
}

// One IPv6 user owns a whole /64, so per-address limits would be trivial to rotate past.
function limitKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill("0"), ...tailParts]
    : headParts;
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

// nginx sets X-Real-IP from Cloudflare's CF-Connecting-IP. Trustworthy only because the container binds to loopback.
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? "local";
}
