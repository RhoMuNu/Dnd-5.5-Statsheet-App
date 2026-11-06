export function partyMessage(auth, body, id, now = new Date().toISOString()) {
  if (!body || typeof body.requestId !== "string" || !/^[\w-]{1,100}$/.test(body.requestId) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000) throw new Error("Messages need 1–2000 characters and a request ID.");
  const actorId = auth.role === "dm" ? "dm" : auth.player.id;
  return (auth.campaign.messages ?? []).find((entry) => entry.actorId === actorId && entry.requestId === body.requestId) ?? { id, actorId, actor: auth.role === "dm" ? auth.campaign.dmName : auth.player.name, requestId: body.requestId, text: body.text.trim(), createdAt: now };
}
export function emptyCampaignBoard() { return { revision: 0, privateNotes: "", title: "", text: "", image: "" }; }
export function boardFor(auth) {
  const { privateNotes, ...publicBoard } = auth.campaign.board ?? emptyCampaignBoard();
  return auth.role === "dm" ? { ...publicBoard, privateNotes } : publicBoard;
}
export function changeCampaignBoard(previous, body) {
  if (!body || body.revision !== previous.revision) throw Object.assign(new Error("The handout or DM notes changed on another device. Reload the host copy before saving."), { status: 409 });
  for (const [key, limit] of [["title", 100], ["text", 10000], ["privateNotes", 20000], ["image", 1050000]]) if (typeof body[key] !== "string" || body[key].length > limit) throw new Error(`Invalid ${key} or content too long.`);
  if (body.image) {
    const match = body.image.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new Error("Upload a PNG, JPEG, WebP, or GIF image.");
    const bytes = Buffer.from(match[2], "base64");
    const valid = { png: bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", jpeg: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, gif: ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString()), webp: bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" };
    if (bytes.length > 768 * 1024 || bytes.toString("base64") !== match[2] || !valid[match[1]]) throw new Error("Image is invalid or exceeds 768 KB.");
  }
  return { revision: previous.revision + 1, title: body.title.trim(), text: body.text, image: body.image, privateNotes: body.privateNotes };
}
