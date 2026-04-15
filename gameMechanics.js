import {
  HOUSE_COST_BY_COLOR,
  calculateRentForSpace,
  createInitialBoard,
} from './gameRules.js';

let tradeCounter = 1;

export function createBaseState() {
  return {
    players: [],
    currentPlayerIndex: 0,
    board: createInitialBoard(),
    gameStarted: false,
    gamePhase: 'waiting',
    pendingTrades: [],
  };
}

export function addPlayerToLobby(state, { name, socketId, id, color }) {
  if (state.gameStarted) return { ok: false, error: 'Game has already started' };
  if (state.players.length >= 6) return { ok: false, error: 'Game is full (max 6 players)' };

  const player = {
    id: id || `p_${state.players.length + 1}`,
    socketId,
    name,
    money: 1500,
    position: 0,
    properties: [],
    color: color || '#ff0000',
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    hasPaidJailFine: false,
    consecutiveDoubles: 0,
  };

  state.players.push(player);
  return { ok: true, player };
}

export function startGameIfReady(state) {
  if (state.players.length < 2) return { ok: false, error: 'Need at least 2 players to start' };
  if (state.gameStarted) return { ok: false, error: 'Game already started' };
  state.gameStarted = true;
  state.gamePhase = 'rolling';
  state.currentPlayerIndex = 0;
  return { ok: true };
}

export function moveCurrentPlayerByDice(state, die1, die2) {
  const player = state.players[state.currentPlayerIndex];
  const total = die1 + die2;
  const oldPosition = player.position;
  const newPosition = (oldPosition + total) % 40;
  const passedGo = oldPosition + total >= 40;

  player.position = newPosition;
  if (passedGo && newPosition !== 0) {
    player.money += 200;
  }

  return { playerId: player.id, oldPosition, newPosition, total, passedGo };
}

export function buyPropertyAtPlayerPosition(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: 'Player not found' };
  const space = state.board[player.position];
  const ownable = space && (space.type === 'property' || space.type === 'railroad' || space.type === 'utility');
  if (!ownable || space.price <= 0) return { ok: false, error: 'This space cannot be purchased' };
  if (space.owner !== null) return { ok: false, error: 'Property already owned' };
  if (player.money < space.price) return { ok: false, error: 'Not enough money' };

  player.money -= space.price;
  space.owner = player.id;
  player.properties.push(space.id);
  return { ok: true, propertyId: space.id, propertyName: space.name };
}

function buildingLevel(space) {
  return space?.hotel ? 5 : (Number(space?.houses) || 0);
}

export function canBuildOnProperty(state, player, propertyId) {
  const property = state.board[propertyId];
  const ownedSet = new Set((player.properties || []).map((id) => Number(id)));
  const ownsProperty = ownedSet.has(Number(propertyId));

  if (!property || property.type !== 'property') {
    return { ok: false, reason: 'Only standard properties can be developed' };
  }
  if (!ownsProperty && property.owner !== player.id) {
    return { ok: false, reason: 'You do not own this property' };
  }

  const colorSet = state.board.filter((s) => s.type === 'property' && s.color === property.color);
  const ownsEntireSet = colorSet.length > 0 && colorSet.every((s) => ownedSet.has(Number(s.id)));
  if (!ownsEntireSet) {
    return { ok: false, reason: 'You must own the full color set to build' };
  }

  const currentLevel = buildingLevel(property);
  if (currentLevel >= 5) {
    return { ok: false, reason: 'Hotel already built on this property' };
  }

  const nextLevel = currentLevel + 1;
  const simulatedLevels = colorSet.map((s) => (s.id === property.id ? nextLevel : buildingLevel(s)));
  const maxLevel = Math.max(...simulatedLevels);
  const minLevel = Math.min(...simulatedLevels);
  if (maxLevel - minLevel > 1) {
    return { ok: false, reason: 'You must build evenly across the color set' };
  }

  const cost = HOUSE_COST_BY_COLOR[property.color] || 100;
  if (player.money < cost) {
    return { ok: false, reason: `Not enough money. Need $${cost}` };
  }

  return { ok: true, cost };
}

export function buildOnProperty(property) {
  const houses = Number(property.houses) || 0;
  if (houses < 4) {
    property.houses = houses + 1;
    return 'house';
  }
  property.houses = 0;
  property.hotel = true;
  return 'hotel';
}

export function buyBuilding(state, playerId, propertyId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: 'Player not found' };

  const validation = canBuildOnProperty(state, player, Number(propertyId));
  if (!validation.ok) return { ok: false, error: validation.reason };

  const property = state.board[Number(propertyId)];
  player.money -= validation.cost;
  const buildingType = buildOnProperty(property);

  return {
    ok: true,
    buildingType,
    houses: property.houses || 0,
    hotel: !!property.hotel,
    rentNow: calculateRentForSpace(state.board, property, player),
  };
}

export function chargeRent(state, payerId, ownerId, rent) {
  const payer = state.players.find((p) => p.id === payerId);
  const owner = state.players.find((p) => p.id === ownerId);
  if (!payer || !owner) return { ok: false, error: 'Invalid payer or owner' };
  if (payer.money < rent) return { ok: false, error: 'Insufficient funds' };
  payer.money -= rent;
  owner.money += rent;
  return { ok: true };
}

export function proposeTrade(state, { fromId, toId, offer, request }) {
  const proposer = state.players.find((p) => p.id === fromId);
  const target = state.players.find((p) => p.id === toId);
  if (!proposer || !target) return { ok: false, error: 'Trade participants not found' };

  const trade = {
    id: `t_${tradeCounter++}`,
    fromId,
    toId,
    offer: {
      money: Number(offer?.money) || 0,
      properties: Array.isArray(offer?.properties) ? offer.properties.map(Number) : [],
    },
    request: {
      money: Number(request?.money) || 0,
      properties: Array.isArray(request?.properties) ? request.properties.map(Number) : [],
    },
  };

  state.pendingTrades.push(trade);
  return { ok: true, trade };
}

export function respondTrade(state, { tradeId, responderId, accept }) {
  const idx = state.pendingTrades.findIndex((t) => t.id === tradeId);
  if (idx < 0) return { ok: false, error: 'Trade not found' };

  const pending = state.pendingTrades[idx];
  if (pending.toId !== responderId) return { ok: false, error: 'Only the target player can respond' };

  const proposer = state.players.find((p) => p.id === pending.fromId);
  const target = state.players.find((p) => p.id === pending.toId);
  if (!proposer || !target) return { ok: false, error: 'Trade participants not found' };

  state.pendingTrades.splice(idx, 1);
  if (!accept) return { ok: true, status: 'declined' };

  const offerProps = pending.offer.properties || [];
  const requestProps = pending.request.properties || [];

  const proposerOwns = offerProps.every((pid) => proposer.properties.includes(pid));
  const targetOwns = requestProps.every((pid) => target.properties.includes(pid));
  if (!proposerOwns || !targetOwns) return { ok: false, error: 'Properties no longer owned' };
  if (proposer.money < pending.offer.money || target.money < pending.request.money) {
    return { ok: false, error: 'Insufficient funds for trade' };
  }

  offerProps.forEach((pid) => {
    proposer.properties = proposer.properties.filter((id) => id !== pid);
    target.properties.push(pid);
    const space = state.board[pid];
    if (space) space.owner = target.id;
  });

  requestProps.forEach((pid) => {
    target.properties = target.properties.filter((id) => id !== pid);
    proposer.properties.push(pid);
    const space = state.board[pid];
    if (space) space.owner = proposer.id;
  });

  proposer.money -= pending.offer.money;
  target.money += pending.offer.money;
  target.money -= pending.request.money;
  proposer.money += pending.request.money;

  return { ok: true, status: 'executed' };
}

export function sendPlayerToJail(player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  player.hasPaidJailFine = false;
  player.consecutiveDoubles = 0;
}

export function payJailFine(player) {
  if (!player.inJail) return { ok: false, error: 'You are not in jail' };
  if (player.hasPaidJailFine) return { ok: false, error: 'Jail fine already paid this turn' };
  if (player.money < 50) return { ok: false, error: 'Could not pay jail fine' };

  player.money -= 50;
  player.hasPaidJailFine = true;
  return { ok: true };
}

export function useGetOutOfJailCard(player) {
  if (!player.inJail) return { ok: false, error: 'You are not in jail' };
  if ((player.getOutOfJailCards || 0) <= 0) return { ok: false, error: 'No card available' };

  player.getOutOfJailCards -= 1;
  player.inJail = false;
  player.jailTurns = 0;
  player.hasPaidJailFine = false;
  return { ok: true };
}

export function processJailRoll(player, die1, die2) {
  const isDoubles = die1 === die2;
  if (player.hasPaidJailFine) {
    player.hasPaidJailFine = false;
    player.inJail = false;
    player.jailTurns = 0;
    return { action: 'releasedByFine' };
  }
  if (isDoubles) {
    player.inJail = false;
    player.jailTurns = 0;
    return { action: 'releasedByDoubles' };
  }

  player.jailTurns = (player.jailTurns || 0) + 1;
  if (player.jailTurns >= 3) {
    if (player.money < 50) return { action: 'bankrupt' };
    player.money -= 50;
    player.inJail = false;
    player.jailTurns = 0;
    return { action: 'jailThirdFailPaid' };
  }
  return { action: 'jailStay', turnsRemaining: 3 - player.jailTurns };
}

export function validateLoginInput(username, password) {
  return !!(username && username.trim() && password);
}

export function saveGameForUser({ userId, name, gameState }) {
  return {
    id: `s_${Date.now()}`,
    userId,
    name: name.trim(),
    game_data: JSON.stringify(gameState),
  };
}

export function loadGameForUser({ saveRecord, userId }) {
  if (!saveRecord || saveRecord.userId !== userId) {
    return { ok: false, error: 'Save not found' };
  }

  const savedState = JSON.parse(saveRecord.game_data);
  savedState.players.forEach((p) => { p.socketId = null; });
  savedState.gameStarted = true;
  savedState.gamePhase = 'rolling';
  savedState.freePlay = true;
  delete savedState.pendingRent;
  return { ok: true, state: savedState };
}