import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayerToLobby,
  buildOnProperty,
  buyBuilding,
  buyPropertyAtPlayerPosition,
  chargeRent,
  createBaseState,
  loadGameForUser,
  moveCurrentPlayerByDice,
  payJailFine,
  processJailRoll,
  proposeTrade,
  respondTrade,
  saveGameForUser,
  sendPlayerToJail,
  startGameIfReady,
  useGetOutOfJailCard,
  validateLoginInput,
} from '../gameMechanics.js';

test('1) saving games creates a record and loading restores playable state', () => {
  const state = createBaseState();
  addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' });
  addPlayerToLobby(state, { name: 'Dog', socketId: 'b', id: 'p2' });
  startGameIfReady(state);

  const save = saveGameForUser({ userId: 10, name: 'Mid Game', gameState: state });
  const loaded = loadGameForUser({ saveRecord: save, userId: 10 });

  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.gameStarted, true);
  assert.equal(loaded.state.gamePhase, 'rolling');
  assert.equal(loaded.state.freePlay, true);
  assert.equal(loaded.state.players[0].socketId, null);
});

test('2) adding players into the lobby enforces capacity and game-start rules', () => {
  const state = createBaseState();

  for (let i = 0; i < 6; i += 1) {
    const result = addPlayerToLobby(state, { name: `P${i}`, socketId: `s${i}` });
    assert.equal(result.ok, true);
  }

  const fullResult = addPlayerToLobby(state, { name: 'Overflow', socketId: 's7' });
  assert.equal(fullResult.ok, false);
  assert.match(fullResult.error, /full/i);

  state.gameStarted = true;
  const startedResult = addPlayerToLobby(state, { name: 'Late', socketId: 's8' });
  assert.equal(startedResult.ok, false);
  assert.match(startedResult.error, /already started/i);
});

test('3) login input validation requires username and password', () => {
  assert.equal(validateLoginInput('', 'x'), false);
  assert.equal(validateLoginInput('cat', ''), false);
  assert.equal(validateLoginInput('cat', 'secret'), true);
});

test('4) loading a save for the wrong user is rejected', () => {
  const state = createBaseState();
  const save = saveGameForUser({ userId: 20, name: 'Private Save', gameState: state });

  const loaded = loadGameForUser({ saveRecord: save, userId: 999 });
  assert.equal(loaded.ok, false);
  assert.match(loaded.error, /not found/i);
});

test('5) rolling dice moves the current player and applies pass-GO bonus', () => {
  const state = createBaseState();
  addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' });
  addPlayerToLobby(state, { name: 'Dog', socketId: 'b', id: 'p2' });
  startGameIfReady(state);

  const current = state.players[0];
  current.position = 38;
  current.money = 1000;

  const result = moveCurrentPlayerByDice(state, 3, 3);
  assert.equal(result.newPosition, 4);
  assert.equal(result.passedGo, true);
  assert.equal(current.money, 1200);
});

test('6) buying houses/hotel changes building state and increases rent', () => {
  const state = createBaseState();
  const p = addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' }).player;
  addPlayerToLobby(state, { name: 'Dog', socketId: 'b', id: 'p2' });

  // Give full brown set so building is legal
  state.board[1].owner = p.id;
  state.board[3].owner = p.id;
  p.properties.push(1, 3);
  p.money = 2000;

  const beforeRent = state.board[1].rentTiers[0] * 2;
  const build1 = buyBuilding(state, p.id, 1);
  assert.equal(build1.ok, true);
  assert.equal(build1.buildingType, 'house');
  assert.equal(build1.rentNow > beforeRent, true);

  buildOnProperty(state.board[1]);
  buildOnProperty(state.board[1]);
  buildOnProperty(state.board[1]);
  const finalBuild = buildOnProperty(state.board[1]);
  assert.equal(finalBuild, 'hotel');
  assert.equal(state.board[1].hotel, true);
});

test('7) rent is charged from payer and added to owner', () => {
  const state = createBaseState();
  const payer = addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' }).player;
  const owner = addPlayerToLobby(state, { name: 'Dog', socketId: 'b', id: 'p2' }).player;
  payer.money = 300;
  owner.money = 500;

  const result = chargeRent(state, payer.id, owner.id, 120);
  assert.equal(result.ok, true);
  assert.equal(payer.money, 180);
  assert.equal(owner.money, 620);
});

test('8) trading between players swaps property and money', () => {
  const state = createBaseState();
  const p1 = addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' }).player;
  const p2 = addPlayerToLobby(state, { name: 'Dog', socketId: 'b', id: 'p2' }).player;

  p1.money = 1000;
  p2.money = 900;
  p1.properties = [1];
  p2.properties = [3];
  state.board[1].owner = p1.id;
  state.board[3].owner = p2.id;

  const proposal = proposeTrade(state, {
    fromId: p1.id,
    toId: p2.id,
    offer: { money: 100, properties: [1] },
    request: { money: 50, properties: [3] },
  });
  assert.equal(proposal.ok, true);

  const accepted = respondTrade(state, {
    tradeId: proposal.trade.id,
    responderId: p2.id,
    accept: true,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.status, 'executed');
  assert.equal(p1.properties.includes(3), true);
  assert.equal(p2.properties.includes(1), true);
  assert.equal(p1.money, 950);
  assert.equal(p2.money, 950);
});

test('9) jail mechanics: send to jail, pay fine, use card, and third-fail rule', () => {
  const state = createBaseState();
  const p = addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' }).player;

  sendPlayerToJail(p);
  assert.equal(p.position, 10);
  assert.equal(p.inJail, true);

  p.money = 200;
  const fine = payJailFine(p);
  assert.equal(fine.ok, true);
  assert.equal(p.money, 150);
  const releaseByFine = processJailRoll(p, 1, 2);
  assert.equal(releaseByFine.action, 'releasedByFine');
  assert.equal(p.inJail, false);

  sendPlayerToJail(p);
  p.getOutOfJailCards = 1;
  const card = useGetOutOfJailCard(p);
  assert.equal(card.ok, true);
  assert.equal(p.inJail, false);

  sendPlayerToJail(p);
  p.money = 120;
  let result = processJailRoll(p, 1, 2);
  assert.equal(result.action, 'jailStay');
  result = processJailRoll(p, 1, 2);
  assert.equal(result.action, 'jailStay');
  result = processJailRoll(p, 1, 2);
  assert.equal(result.action, 'jailThirdFailPaid');
  assert.equal(p.inJail, false);
  assert.equal(p.money, 70);
});

test('10) buying a property at current position succeeds for ownable spaces', () => {
  const state = createBaseState();
  const p = addPlayerToLobby(state, { name: 'Cat', socketId: 'a', id: 'p1' }).player;
  p.position = 1;
  p.money = 1000;

  const result = buyPropertyAtPlayerPosition(state, p.id);
  assert.equal(result.ok, true);
  assert.equal(p.properties.includes(1), true);
  assert.equal(state.board[1].owner, p.id);
});