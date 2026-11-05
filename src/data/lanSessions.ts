import type { LanSession } from "./lan";

const KEY = "taleforge.lan.saved-sessions.v1";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;

function validSession(value: unknown): value is LanSession {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<LanSession>;
  return typeof entry.code === "string" && /^[A-Z0-9]{6}$/.test(entry.code) && typeof entry.token === "string" && entry.token.length > 0
    && (entry.role === "dm" || entry.role === "player") && (entry.playerId === null || typeof entry.playerId === "string") && typeof entry.name === "string";
}

export function savedLanSessions(storage: StorageAccess = localStorage): LanSession[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(validSession) : [];
  } catch { return []; }
}

export function rememberLanSession(session: LanSession, storage: StorageAccess = localStorage): LanSession[] {
  const sessions = [session, ...savedLanSessions(storage).filter((entry) => entry.code !== session.code || entry.token !== session.token)];
  storage.setItem(KEY, JSON.stringify(sessions));
  return sessions;
}
