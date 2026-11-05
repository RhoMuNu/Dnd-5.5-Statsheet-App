// Public table history: host dice are rolled here; sheet results are player reports.
export function makeActivity(auth, body, id, die, now = new Date().toISOString()) {
  if (!body || typeof body.requestId !== "string" || !/^[\w-]{1,100}$/.test(body.requestId)) throw new Error("A valid roll request ID is required.");
  const actorId = auth.role === "dm" ? "dm" : auth.player.id;
  const previous = (auth.campaign.activity ?? []).find((entry) => entry.actorId === actorId && entry.requestId === body.requestId);
  if (previous) return previous;
  const entry = { id, actorId, actor: auth.role === "dm" ? auth.campaign.dmName : auth.player.name, requestId: body.requestId, createdAt: now };
  if (body.kind === "dice") {
    const match = typeof body.expression === "string" && body.expression.replace(/\s/g, "").match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 50) throw new Error("Use 1–50 dice, such as 1d20+5 or 8d6 (d4, d6, d8, d10, d12, d20, d100).");
    const count = Number(match[1]), sides = Number(match[2]), bonus = Number(match[3] ?? 0);
    const rolls = Array.from({ length: count }, () => die(sides));
    return { ...entry, kind: "dice", summary: `${count}d${sides}${bonus ? (bonus > 0 ? "+" : "") + bonus : ""}: [${rolls.join(", ")}]${bonus ? ` ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)}` : ""} = ${rolls.reduce((sum, roll) => sum + roll, bonus)}` };
  }
  if (body.kind !== "sheet" || typeof body.summary !== "string" || !body.summary.trim() || body.summary.length > 1500) throw new Error("A sheet result must contain 1–1500 characters.");
  const record = auth.campaign.characters.find((entry) => entry.character.id === body.characterId && entry.shared && entry.ownerId === auth.player?.id);
  if (!record || auth.role !== "player") throw new Error("Only your own shared character can publish sheet results.");
  return { ...entry, kind: "sheet", characterName: record.character.name, summary: body.summary.trim() };
}
