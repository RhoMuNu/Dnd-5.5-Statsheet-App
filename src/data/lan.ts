import type { Character, CharacterDraft } from "./characters";

export type LanSession = { code: string; token: string; role: "dm" | "player"; playerId: string | null; name: string };
export type LanSnapshot = {
  campaign: { code: string; name: string; dmName: string };
  role: "dm" | "player";
  playerId: string | null;
  players: { id: string; name: string; connected: boolean }[];
  characters: ({ character: Character; shared?: boolean; ownerId?: string; ownerName?: string })[];
};
export type PendingLanSave = { character: Character; shared: boolean; baseUpdatedAt: string | null; conflict?: Character | null };

export class LanRequestError extends Error {
  constructor(message: string, readonly status: number, readonly current?: Character | null) {
    super(message);
  }
}

export async function lanRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new LanRequestError("Could not reach the host. Your pending changes are kept on this device.", 0);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new LanRequestError(result.error ?? "The host rejected that request.", response.status, result.current ?? null);
  return result as T;
}

export function createLanCharacter(draft: CharacterDraft, id: string, now: string): Character {
  return { ...draft, id, createdAt: now, updatedAt: now };
}
