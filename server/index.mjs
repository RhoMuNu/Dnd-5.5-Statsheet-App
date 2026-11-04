import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isProduction = process.env.NODE_ENV === "production" || process.argv.includes("--production");
const port = Number(process.env.TALEFORGE_PORT ?? (isProduction ? 4173 : 4174));
const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = join(appRoot, "dist");
const dataRoot = join(process.env.APPDATA ?? join(homedir(), ".local", "share"), "TaleForge");
const dataFile = join(dataRoot, "lan-campaigns.json");
const clients = new Map();

mkdirSync(dataRoot, { recursive: true });
let store = { campaigns: [] };
try {
  if (existsSync(dataFile)) store = JSON.parse(readFileSync(dataFile, "utf8"));
  if (!store || !Array.isArray(store.campaigns)) throw new Error("Campaign store has an unsupported format.");
} catch (error) {
  console.error(`Could not read the campaign store at ${dataFile}:`, error.message);
  process.exit(1);
}

function persist() {
  const temporary = `${dataFile}.tmp`;
  writeFileSync(temporary, JSON.stringify(store, null, 2), "utf8");
  renameSync(temporary, dataFile);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

function randomToken(bytes = 24) { return randomBytes(bytes).toString("base64url"); }
function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
function authorizedCampaign(request, code) {
  const campaign = store.campaigns.find((item) => item.code === code.toUpperCase());
  if (!campaign) return null;
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (token === campaign.dmToken) return { campaign, role: "dm", player: null };
  const player = campaign.players.find((item) => item.token === token);
  return player ? { campaign, role: "player", player } : null;
}
function connected(token) { return (clients.get(token)?.size ?? 0) > 0; }
function snapshotFor(auth) {
  const { campaign, role, player } = auth;
  const players = campaign.players.map((entry) => ({ id: entry.id, name: entry.name, connected: connected(entry.token) }));
  const characters = role === "dm"
    ? campaign.characters.filter((entry) => entry.shared).map((entry) => ({ character: entry.character, ownerId: entry.ownerId, ownerName: campaign.players.find((person) => person.id === entry.ownerId)?.name ?? "Player" }))
    : campaign.characters.filter((entry) => entry.ownerId === player.id).map((entry) => ({ character: entry.character, shared: entry.shared }));
  return { campaign: { code: campaign.code, name: campaign.name, dmName: campaign.dmName }, role, playerId: player?.id ?? null, players, characters };
}
function pushSnapshot(token) {
  const connections = clients.get(token);
  if (!connections) return;
  const auth = store.campaigns.map((campaign) => authorizedCampaign({ headers: { authorization: `Bearer ${token}` } }, campaign.code)).find(Boolean);
  if (!auth) return;
  const event = `event: snapshot\ndata: ${JSON.stringify(snapshotFor(auth))}\n\n`;
  for (const response of connections) response.write(event);
}
function broadcastCampaign(campaign) {
  for (const token of [campaign.dmToken, ...campaign.players.map((player) => player.token)]) pushSnapshot(token);
}
function setConnected(token, response) {
  if (!clients.has(token)) clients.set(token, new Set());
  clients.get(token).add(response);
}
function removeConnected(token, response) {
  const connections = clients.get(token);
  if (!connections) return;
  connections.delete(response);
  if (connections.size === 0) clients.delete(token);
}
function validCharacter(character) {
  if (!character || typeof character !== "object" || typeof character.id !== "string" || !character.id
    || typeof character.name !== "string" || !character.name.trim() || character.name.length > 80
    || !Number.isInteger(character.level) || character.level < 1 || character.level > 20
    || !character.abilityScores || !character.savingThrowProficiencies || !character.skillProficiencies
    || !character.classLevels || typeof character.classLevels !== "object") return false;
  const abilities = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
  const abilityScoresValid = abilities.every((ability) => Number.isFinite(character.abilityScores[ability]) && character.abilityScores[ability] >= 1 && character.abilityScores[ability] <= 30);
  const savesValid = abilities.every((ability) => typeof character.savingThrowProficiencies[ability] === "boolean");
  const skillsValid = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"]
    .every((skill) => [0, 1, 2].includes(character.skillProficiencies[skill]));
  const classLevels = Object.entries(character.classLevels);
  const totalLevels = classLevels.reduce((sum, [, level]) => sum + (Number.isInteger(level) ? level : 0), 0);
  return abilityScoresValid && savesValid && skillsValid && totalLevels <= 20
    && classLevels.every(([name, level]) => typeof name === "string" && Number.isInteger(level) && level >= 1 && level <= 20);
}

const apiServer = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const pathname = requestUrl.pathname;
  try {
    if (request.method === "GET" && pathname === "/api/health") {
      const addresses = Object.values(networkInterfaces()).flatMap((items) => items ?? [])
        .filter((item) => !item.internal && (item.family === "IPv4" || item.family === 4) && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))
        .map((item) => item.address);
      return sendJson(response, 200, { ok: true, service: "taleforge-lan", version: 1, addresses: [...new Set(addresses)] });
    }

    if (request.method === "POST" && pathname === "/api/campaigns") {
      const body = await readJson(request);
      const name = String(body.name ?? "").trim().slice(0, 80);
      const dmName = String(body.dmName ?? "Dungeon Master").trim().slice(0, 40) || "Dungeon Master";
      if (!name) return sendJson(response, 400, { error: "Give the campaign a name." });
      let code;
      do { code = createRoomCode(); } while (store.campaigns.some((campaign) => campaign.code === code));
      const campaign = { code, name, dmName, dmToken: randomToken(), createdAt: new Date().toISOString(), players: [], characters: [] };
      store.campaigns.push(campaign);
      persist();
      return sendJson(response, 201, { code, token: campaign.dmToken, role: "dm" });
    }

    const joinMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/join$/i);
    if (request.method === "POST" && joinMatch) {
      const campaign = store.campaigns.find((entry) => entry.code === joinMatch[1].toUpperCase());
      if (!campaign) return sendJson(response, 404, { error: "No campaign has that room code." });
      const body = await readJson(request);
      const name = String(body.name ?? "").trim().slice(0, 40);
      if (!name) return sendJson(response, 400, { error: "Enter a player name." });
      const player = { id: randomToken(12), name, token: randomToken() };
      campaign.players.push(player);
      persist();
      broadcastCampaign(campaign);
      return sendJson(response, 201, { code: campaign.code, token: player.token, playerId: player.id, role: "player" });
    }

    const eventsMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/events$/i);
    if (request.method === "GET" && eventsMatch) {
      const auth = authorizedCampaign({ headers: { authorization: `Bearer ${requestUrl.searchParams.get("token") ?? ""}` } }, eventsMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      const token = requestUrl.searchParams.get("token");
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      response.write("retry: 1500\n\n");
      setConnected(token, response);
      response.write(`event: snapshot\ndata: ${JSON.stringify(snapshotFor(auth))}\n\n`);
      broadcastCampaign(auth.campaign);
      const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15_000);
      request.on("close", () => {
        clearInterval(heartbeat);
        removeConnected(token, response);
        broadcastCampaign(auth.campaign);
      });
      return;
    }

    const campaignMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)$/i);
    if (request.method === "GET" && campaignMatch) {
      const auth = authorizedCampaign(request, campaignMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      return sendJson(response, 200, snapshotFor(auth));
    }

    const shareMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/characters\/([^/]+)\/share$/i);
    if (request.method === "POST" && shareMatch) {
      const auth = authorizedCampaign(request, shareMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      if (auth.role !== "player") return sendJson(response, 403, { error: "The DM view is read-only." });
      const characterId = decodeURIComponent(shareMatch[2]);
      const body = await readJson(request);
      const record = auth.campaign.characters.find((entry) => entry.character.id === characterId);
      if (!record || record.ownerId !== auth.player.id) return sendJson(response, 404, { error: "That character is not owned by this player." });
      record.shared = Boolean(body.shared);
      persist();
      broadcastCampaign(auth.campaign);
      return sendJson(response, 200, { ok: true, shared: record.shared });
    }

    const characterMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/characters(?:\/([^/]+))?$/i);
    if (characterMatch) {
      const auth = authorizedCampaign(request, characterMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      if (auth.role !== "player") return sendJson(response, 403, { error: "The DM view is read-only." });
      const characterId = characterMatch[2] ? decodeURIComponent(characterMatch[2]) : null;

      if (request.method === "POST" && !characterId) {
        const body = await readJson(request);
        if (!validCharacter(body.character)) return sendJson(response, 400, { error: "Character data is incomplete." });
        let record = auth.campaign.characters.find((entry) => entry.character.id === body.character.id);
        if (record && record.ownerId !== auth.player.id) return sendJson(response, 409, { error: "That character ID belongs to another player." });
        if (record && body.baseUpdatedAt !== record.character.updatedAt) return sendJson(response, 409, { error: "The host has a newer version of this sheet.", current: record.character, shared: record.shared });
        if (!record) {
          record = { character: body.character, ownerId: auth.player.id, shared: Boolean(body.shared) };
          auth.campaign.characters.push(record);
        } else {
          record.character = body.character;
          record.shared = Boolean(body.shared);
        }
        persist();
        broadcastCampaign(auth.campaign);
        return sendJson(response, 200, { ok: true, updatedAt: record.character.updatedAt, shared: record.shared });
      }

    }

    if (isProduction && request.method === "GET") return serveStatic(pathname, response);
    return sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Request body must be valid JSON." : error.message || "The LAN host could not complete that request.";
    if (!response.headersSent) return sendJson(response, 400, { error: message });
    response.end();
  }
});

function serveStatic(pathname, response) {
  let relative = decodeURIComponent(pathname);
  if (relative === "/") relative = "/index.html";
  const candidate = resolve(distRoot, `.${normalize(relative)}`);
  const relativePath = relative(distRoot, candidate);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    response.writeHead(403); response.end("Forbidden"); return;
  }
  let file = candidate;
  if (!existsSync(file)) file = join(distRoot, "index.html");
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" }[extname(file)] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": mime, "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600" });
  response.end(readFileSync(file));
}

apiServer.listen(port, "0.0.0.0", () => {
  console.log(`TaleForge LAN server listening on 0.0.0.0:${port}`);
  console.log(`Campaign data: ${dataFile}`);
  if (isProduction) console.log("Open this PC's LAN address from the other devices on the same Wi-Fi.");
});
