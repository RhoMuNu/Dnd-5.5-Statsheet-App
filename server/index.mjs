import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeActivity } from "./activity.mjs";
import { changeEncounter, emptyEncounter } from "./encounters.mjs";

const isProduction = process.env.NODE_ENV === "production" || process.argv.includes("--production");
const rules = isProduction ? await import("../dist/rules.mjs") : (await import("./rules-dev.mjs")).rules;
const port = Number(process.env.TALEFORGE_PORT ?? (isProduction ? 4173 : 4174));
const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = join(appRoot, "dist");
const dataRoot = resolve(process.env.TALEFORGE_DATA_DIR ?? join(process.env.APPDATA ?? join(homedir(), ".local", "share"), "TaleForge"));
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

function diceForRequest(body) {
  if (body.diceMode !== undefined && !["digital", "physical"].includes(body.diceMode)) throw new Error("Choose digital or physical dice.");
  if (body.diceFaces !== undefined && body.diceMode !== "physical") throw new Error("Physical faces require physical dice mode.");
  const physical = body.diceMode === "physical" ? rules.physicalDice(body.diceFaces ?? []) : null;
  return { roll: physical?.roll ?? ((sides) => randomInt(1, sides + 1)), finish: () => physical?.finish() };
}

function stamp(character) { return { ...character, updatedAt: new Date(Math.max(Date.now(), Date.parse(character.updatedAt) + 1 || 0)).toISOString() }; }
function cleanEffects(campaign) {
  const cleaned = rules.cleanConcentrationEffects(campaign.characters.map((entry) => entry.character));
  campaign.characters.forEach((entry, index) => { if (cleaned[index] !== entry.character) entry.character = stamp(cleaned[index]); });
}
function synchronizeTurns(campaign, previous, next) {
  const key = 'lan-' + (next.turnSerial ?? next.revision);
  const activeCharacterId = next.entries.find((entry) => entry.id === next.activeId)?.characterId;
  const previousActiveId = previous.entries.find((entry) => entry.id === previous.activeId)?.characterId;
  const newTurn = !!next.activeId && (previous.activeId !== next.activeId || previous.turnSerial !== next.turnSerial);
  for (const record of campaign.characters) {
    const character = record.character;
    const inEncounter = next.entries.some((entry) => entry.characterId === character.id);
    const old = rules.turnState(character);
    if (!inEncounter && !old.key.startsWith('lan-')) continue;
    let turn = { ...old, enabled: inEncounter && next.round > 0, key, active: activeCharacterId === character.id };
    if (turn.enabled && turn.active && (!old.enabled || previousActiveId !== character.id || previous.turnSerial !== next.turnSerial)) turn = { ...rules.freshTurn(key), active: true };
    const effects = (character.combat?.effects ?? []).map((effect) => newTurn && effect.durationOwnerId === activeCharacterId && effect.rounds !== null ? { ...effect, rounds: effect.rounds - 1 } : effect).filter((effect) => effect.rounds === null || effect.rounds > 0);
    if (JSON.stringify(old) !== JSON.stringify(turn) || JSON.stringify(effects) !== JSON.stringify(character.combat?.effects ?? [])) record.character = stamp({ ...character, combat: { ...character.combat, effects, turn } });
  }
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
  const publicIds = new Set((campaign.encounter?.entries ?? []).map((entry) => entry.characterId));
  const targets = campaign.characters.filter((entry) => entry.shared && publicIds.has(entry.character.id)).map((entry) => ({ id: entry.character.id, name: entry.character.name }));
  return { targets, campaign: { code: campaign.code, name: campaign.name, dmName: campaign.dmName }, role, playerId: player?.id ?? null, players, characters, activity: campaign.activity ?? [], encounter: campaign.encounter ?? emptyEncounter() };
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
  return abilityScoresValid && savesValid && skillsValid && totalLevels <= 20 && validCombatData(character)
    && classLevels.every(([name, level]) => typeof name === "string" && Number.isInteger(level) && level >= 1 && level <= 20);
}

function validCombatData(character) {
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  if (character.attacks !== undefined && (!Array.isArray(character.attacks) || character.attacks.length > 100 || !character.attacks.every((entry) => entry && typeof entry.id === "string" && typeof entry.name === "string"
    && ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"].includes(entry.ability)
    && integer(entry.diceCount, 0, 30) && [4, 6, 8, 10, 12, 20].includes(entry.dieSize)
    && integer(entry.attackBonus, -100, 100) && integer(entry.damageBonus, -100, 100)
    && typeof entry.proficient === "boolean" && typeof entry.addAbilityToDamage === "boolean" && typeof entry.damageType === "string" && typeof entry.notes === "string"))) return false;
  const combat = character.combat;
  if (combat === undefined) return true;
  if (!combat || typeof combat !== "object" || Array.isArray(combat)) return false;
  if (combat.exhaustion !== undefined && !integer(combat.exhaustion, 0, 6)) return false;
  const conditions = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];
  if (combat.conditions !== undefined && (!Array.isArray(combat.conditions) || combat.conditions.length > 14 || !combat.conditions.every((entry) => conditions.includes(entry)))) return false;
  if (combat.effects !== undefined && (!Array.isArray(combat.effects) || combat.effects.length > 50 || !combat.effects.every((entry) => entry && typeof entry.id === "string" && typeof entry.name === "string"
    && (entry.rounds === null || integer(entry.rounds, 1, 10000))
    && ["ac", "attack", "damage", "save", "check", "initiative"].every((key) => integer(entry[key], -100, 100))
    && integer(entry.speed, -500, 500) && integer(entry.hpPerLevel, -10, 10)
    && ["attackDie", "saveDie"].every((key) => [0, 4, 6, 8, 10, 12, -4, -6, -8, -10, -12].includes(entry[key]))
    && typeof entry.concentrationAdvantage === "boolean" && typeof entry.initiativeProficiency === "boolean"))) return false;
  return true;
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

    const activityMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/activity$/i);
    if (request.method === "POST" && activityMatch) {
      const auth = authorizedCampaign(request, activityMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      const body = await readJson(request);
      const actorId = auth.role === "dm" ? "dm" : auth.player.id;
      const existing = (auth.campaign.activity ?? []).find((entry) => entry.actorId === actorId && entry.requestId === body.requestId);
      if (existing) return sendJson(response, 200, { entry: existing });
      const dice = diceForRequest(body);
      let entry;
      try { entry = makeActivity(auth, body, randomToken(12), dice.roll); dice.finish(); }
      catch (error) { if (error instanceof rules.PhysicalDiceRequired) return sendJson(response, 200, { diceRequest: error.request }); throw error; }
      const activity = auth.campaign.activity ?? [];
      if (!activity.some((item) => item.id === entry.id)) {
        auth.campaign.activity = [...activity, entry].slice(-100);
        persist();
        broadcastCampaign(auth.campaign);
      }
      return sendJson(response, 200, { entry });
    }

    const encounterMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/encounter$/i);
    if (request.method === "POST" && encounterMatch) {
      const auth = authorizedCampaign(request, encounterMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      if (auth.role !== "dm") return sendJson(response, 403, { error: "Only the DM can change turn order." });
      const body = await readJson(request);
      const previous = auth.campaign.encounter ?? emptyEncounter();
      if (body.revision !== previous.revision) return sendJson(response, 409, { error: "Turn order changed on another device. Review the current encounter and try again." });
      // Re-read after awaiting the body so simultaneous DM requests cannot overwrite each other.
      const next = changeEncounter(previous, body.action, auth.campaign.characters.filter((entry) => entry.shared), randomToken(12));
      synchronizeTurns(auth.campaign, previous, next);
      auth.campaign.encounter = next;
      persist();
      broadcastCampaign(auth.campaign);
      return sendJson(response, 200, { encounter: next });
    }

    const advanceMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/level-up$/i);
    if (request.method === "POST" && advanceMatch) {
      const auth = authorizedCampaign(request, advanceMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      if (auth.role !== "player") return sendJson(response, 403, { error: "Only a character’s player can level it up." });
      const body = await readJson(request);
      if (typeof body.requestId !== "string" || !/^[\w-]{1,100}$/.test(body.requestId)) return sendJson(response, 400, { error: "A level-up request ID is required." });
      const record = auth.campaign.characters.find((entry) => entry.ownerId === auth.player.id && entry.character.id === body.characterId);
      if (!record) return sendJson(response, 404, { error: "Character is not owned by this player." });
      if (record.character.advancement?.some((entry) => entry.id === body.requestId)) return sendJson(response, 200, { character: record.character });
      if (record.character.updatedAt !== body.baseUpdatedAt) return sendJson(response, 409, { error: "The sheet changed. Reopen Level up to review the current character.", current: record.character });
      record.character = stamp({ ...record.character, ...rules.applyLevelUp(record.character, body.plan, body.requestId, new Date().toISOString()) });
      persist(); broadcastCampaign(auth.campaign);
      return sendJson(response, 200, { character: record.character });
    }

    const castMatch = pathname.match(/^\/api\/campaigns\/([A-Z0-9]+)\/cast$/i);
    if (request.method === "POST" && castMatch) {
      const auth = authorizedCampaign(request, castMatch[1]);
      if (!auth) return sendJson(response, 401, { error: "This campaign session is not valid." });
      if (auth.role !== "player") return sendJson(response, 403, { error: "Choose a player-owned caster." });
      const body = await readJson(request);
      if (typeof body.requestId !== "string" || !/^[\w-]{1,100}$/.test(body.requestId)) return sendJson(response, 400, { error: "A cast request ID is required." });
      const prior = (auth.campaign.castReceipts ?? []).find((entry) => entry.actorId === auth.player.id && entry.requestId === body.requestId);
      if (prior) return sendJson(response, 200, prior);
      const caster = auth.campaign.characters.find((entry) => entry.ownerId === auth.player.id && entry.character.id === body.casterId && entry.shared);
      if (!caster) return sendJson(response, 403, { error: "Share your own caster with the DM before using LAN targeting." });
      if (caster.character.updatedAt !== body.baseUpdatedAt) return sendJson(response, 409, { error: "Wait for sheet sync, then cast again.", current: caster.character });
      const publicIds = new Set((auth.campaign.encounter?.entries ?? []).map((entry) => entry.characterId));
      const targets = auth.campaign.characters.filter((entry) => entry.shared && (entry.character.id === caster.character.id || publicIds.has(entry.character.id))).map((entry) => entry.character);
      const targetVersions = Object.fromEntries(targets.filter((target) => Array.isArray(body.targets) && body.targets.some((choice) => choice.id === target.id)).map((target) => [target.id, target.updatedAt]));
      if (body.targetVersions && Object.entries(targetVersions).some(([id, version]) => body.targetVersions[id] !== version)) return sendJson(response, 409, { error: "A target changed during physical dice entry. Review the sheets and start the cast again." });
      const dice = diceForRequest(body);
      let result;
      try { result = rules.resolveTargetedSpell(caster.character, targets, body, randomToken(12), dice.roll); dice.finish(); }
      catch (error) { if (error instanceof rules.PhysicalDiceRequired) return sendJson(response, 200, { diceRequest: error.request, targetVersions }); throw error; }
      if (body.diceMode === "physical") result.summary = "Physical dice · " + result.summary;
      for (const character of result.characters) {
        const record = auth.campaign.characters.find((entry) => entry.character.id === character.id);
        record.character = stamp(character);
      }
      cleanEffects(auth.campaign);
      const receipt = { diceSource: body.diceMode === "physical" ? "physical" : "digital", actorId: auth.player.id, requestId: body.requestId, summary: result.summary };
      auth.campaign.castReceipts = [...(auth.campaign.castReceipts ?? []), receipt].slice(-1000);
      auth.campaign.activity = [...(auth.campaign.activity ?? []), { id: randomToken(12), ...receipt, actor: auth.player.name, kind: "sheet", characterName: caster.character.name, createdAt: new Date().toISOString() }].slice(-100);
      persist(); broadcastCampaign(auth.campaign);
      return sendJson(response, 200, receipt);
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
        cleanEffects(auth.campaign);
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
  let requestPath = decodeURIComponent(pathname);
  if (requestPath === "/") requestPath = "/index.html";
  const candidate = resolve(distRoot, `.${normalize(requestPath)}`);
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
  console.log(`TaleForge LAN server listening on 0.0.0.0:${apiServer.address().port}`);
  console.log(`Campaign data: ${dataFile}`);
  if (isProduction) console.log("Open this PC's LAN address from the other devices on the same Wi-Fi.");
  if (isProduction && process.env.TALEFORGE_OPEN_BROWSER === "1") {
    const openBrowser = spawn(process.env.ComSpec ?? "cmd.exe", ["/c", "start", "", `http://localhost:${port}`], { detached: true, stdio: "ignore", windowsHide: true });
    openBrowser.unref();
  }
});
