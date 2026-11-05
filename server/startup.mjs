import { networkInterfaces } from "node:os";

export function hostPort(value, allowZero = false) {
  const port = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isInteger(port) || port < (allowZero ? 0 : 1) || port > 65535) throw new Error("Choose a host port from 1 to 65535 in host-settings.json.");
  return port;
}

export function lanAddresses(interfaces = networkInterfaces()) {
  return [...new Set(Object.values(interfaces).flatMap((items) => items ?? [])
    .filter((item) => !item.internal && (item.family === "IPv4" || item.family === 4) && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))
    .map((item) => item.address))];
}

export async function existingHost(port, request = fetch) {
  if (port === 0) return false;
  try {
    const response = await request(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1200), redirect: "error" });
    if (!response.ok) return false;
    const data = await response.json();
    return data.ok === true && data.service === "taleforge-lan";
  } catch { return false; }
}
