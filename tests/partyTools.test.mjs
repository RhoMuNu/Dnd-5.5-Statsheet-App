import test from 'node:test';
import assert from 'node:assert/strict';
import { partyMessage, boardFor, changeCampaignBoard, emptyCampaignBoard } from '../server/partyTools.mjs';
test('chat uses authenticated identity and deduplicates retries per sender', () => {
  const auth = { role: 'player', player: { id: 'alice', name: 'Alice' }, campaign: {} };
  const message = partyMessage(auth, { requestId: 'retry', text: 'Hello', actor: 'DM' }, 'one');
  assert.equal(message.actor, 'Alice');
  auth.campaign.messages = [message];
  assert.equal(partyMessage(auth, { requestId: 'retry', text: 'Hello' }, 'two').id, 'one');
  assert.throws(() => partyMessage(auth, { requestId: 'empty', text: ' ' }, 'three'));
});
test('board filtering hides private notes and rejects stale edits and unsafe images', () => {
  const board = changeCampaignBoard(emptyCampaignBoard(), { ...emptyCampaignBoard(), privateNotes: 'Secret', text: 'Public' });
  assert.equal(boardFor({ role: 'player', campaign: { board } }).privateNotes, undefined);
  assert.equal(boardFor({ role: 'dm', campaign: { board } }).privateNotes, 'Secret');
  assert.throws(() => changeCampaignBoard(board, emptyCampaignBoard()), { status: 409 });
  for (const image of ['https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,YmFk']) assert.throws(() => changeCampaignBoard(board, { ...board, image }));
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  assert.equal(changeCampaignBoard(board, { ...board, image }).image, image);
});
