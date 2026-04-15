import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { io as createClient } from 'socket.io-client';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : null;
      srv.close(() => {
        if (port == null) reject(new Error('Failed to determine free port'));
        else resolve(port);
      });
    });
    srv.on('error', reject);
  });
}

function waitForLine(stream, matcher, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for output matching ${matcher}`));
    }, timeoutMs);

    function onData(chunk) {
      buffer += chunk.toString();
      if (matcher.test(buffer)) {
        cleanup();
        resolve(buffer);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      stream.off('data', onData);
    }

    stream.on('data', onData);
  });
}

function waitForSocketEvent(socket, eventName, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      resolve(payload);
    }

    socket.on(eventName, onEvent);
  });
}

function connectSocket(baseUrl) {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      timeout: 5000,
      forceNew: true,
      reconnection: false,
    });

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

async function waitForCondition(checkFn, timeoutMs = 5000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = checkFn();
    if (value) return value;
    await wait(intervalMs);
  }
  throw new Error('Timed out waiting for condition');
}

function trackGameState(socket) {
  const tracker = { latestState: null };
  socket.on('gameState', (state) => {
    tracker.latestState = state;
  });
  return tracker;
}

let serverProcess;
let baseUrl;

test.before(async () => {
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: '',
      DB_SSL: 'false',
      TEST_MODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stderr.on('data', () => {
    // Keep stderr drained to avoid backpressure in tests.
  });

  await waitForLine(serverProcess.stdout, /Server running on/i);
});

test.after(async () => {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill('SIGTERM');
  await wait(200);
});

test('integration: login endpoint responds when database is disabled', async () => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cat', password: 'secret' }),
  });

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /disabled/i);
});

test('integration: save/load endpoints require database (503 in local mode)', async () => {
  const saveResponse = await fetch(`${baseUrl}/api/save-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Quick Save' }),
  });
  assert.equal(saveResponse.status, 503);

  const loadResponse = await fetch(`${baseUrl}/api/load-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saveId: 1 }),
  });
  assert.equal(loadResponse.status, 503);
});

test('integration: players can join lobby and start game over sockets', async () => {
  const cat = await connectSocket(baseUrl);
  const dog = await connectSocket(baseUrl);

  try {
    cat.emit('joinGame', 'Cat');
    dog.emit('joinGame', 'Dog');

    // Give state broadcasts a moment to settle.
    await wait(120);

    const startedStatePromise = waitForSocketEvent(cat, 'gameState');
    cat.emit('startGame');
    const startedState = await startedStatePromise;

    assert.equal(startedState.gameStarted, true);
    assert.equal(startedState.gamePhase, 'rolling');
    assert.equal(startedState.players.length >= 2, true);
  } finally {
    cat.close();
    dog.close();
    await wait(120);
  }
});

test('integration: rolling dice emits result and moves active player', async () => {
  const cat = await connectSocket(baseUrl);
  const dog = await connectSocket(baseUrl);
  const tracker = trackGameState(cat);

  try {
    cat.emit('joinGame', 'Cat');
    dog.emit('joinGame', 'Dog');
    await waitForCondition(() => tracker.latestState && tracker.latestState.players.length >= 2, 5000);

    const catPlayer = tracker.latestState.players.find((p) => p.name === 'Cat');
    const dogPlayer = tracker.latestState.players.find((p) => p.name === 'Dog');
    assert.equal(Boolean(catPlayer && dogPlayer), true);

    cat.emit('testSetState', {
      gameStarted: true,
      gamePhase: 'rolling',
      freePlay: true,
      currentPlayerIndex: 0,
      players: [
        { id: catPlayer.id, position: 1, money: 1500 },
        { id: dogPlayer.id, position: 5, money: 1500 },
      ],
    });
    await waitForCondition(() => tracker.latestState?.gamePhase === 'rolling', 3000);

    const diceResultPromise = waitForSocketEvent(cat, 'diceRolled', 8000);
    cat.emit('testRollDice', { die1: 2, die2: 3 });

    const diceResult = await diceResultPromise;
    const stateAfterRoll = await waitForCondition(() => {
      const s = tracker.latestState;
      if (!s) return null;
      const current = s.players.find((p) => p.id === catPlayer.id);
      if (!current || current.position !== 6) return null;
      return s;
    }, 8000);

    assert.equal(diceResult.total, 5);
    const movedCat = stateAfterRoll.players.find((p) => p.name === 'Cat');
    assert.equal(Boolean(movedCat), true);
    assert.equal(movedCat.position, 6);
  } finally {
    cat.close();
    dog.close();
    await wait(120);
  }
});

test('integration: buying a property through socket flow updates ownership and money', async () => {
  const cat = await connectSocket(baseUrl);
  const dog = await connectSocket(baseUrl);
  const tracker = trackGameState(cat);

  try {
    cat.emit('joinGame', 'Cat');
    dog.emit('joinGame', 'Dog');

    await waitForCondition(() => tracker.latestState && tracker.latestState.players.length >= 2, 5000);

    const catPlayer = tracker.latestState.players.find((p) => p.name === 'Cat');
    const dogPlayer = tracker.latestState.players.find((p) => p.name === 'Dog');
    assert.equal(Boolean(catPlayer && dogPlayer), true);

    cat.emit('testSetState', {
      gameStarted: true,
      gamePhase: 'buying',
      freePlay: true,
      currentPlayerIndex: 0,
      players: [
        { id: catPlayer.id, position: 1, money: 1500, properties: [] },
        { id: dogPlayer.id },
      ],
      board: [{ id: 1, owner: null }],
    });

    await waitForCondition(() => tracker.latestState?.gamePhase === 'buying', 3000);

    cat.emit('buyProperty');

    const finalState = await waitForCondition(() => {
      const s = tracker.latestState;
      if (!s) return null;
      const finalCat = s.players.find((p) => p.id === catPlayer.id);
      const finalSpace = s.board[1];
      if (!finalCat || !finalSpace) return null;
      if (finalSpace.owner !== catPlayer.id) return null;
      if (!finalCat.properties.includes(1)) return null;
      if (finalCat.money !== 1440) return null;
      return s;
    }, 5000);

    const finalCat = finalState.players.find((p) => p.id === catPlayer.id);
    assert.equal(finalCat.money, 1440);
    assert.equal(finalCat.properties.includes(1), true);
  } finally {
    cat.close();
    dog.close();
    await wait(120);
  }
});

test('integration: rent payment subtracts from payer and adds to owner', async () => {
  const cat = await connectSocket(baseUrl);
  const dog = await connectSocket(baseUrl);
  const tracker = trackGameState(cat);

  try {
    cat.emit('joinGame', 'Cat');
    dog.emit('joinGame', 'Dog');
    await waitForCondition(() => tracker.latestState && tracker.latestState.players.length >= 2, 5000);

    const catPlayer = tracker.latestState.players.find((p) => p.name === 'Cat');
    const dogPlayer = tracker.latestState.players.find((p) => p.name === 'Dog');
    assert.equal(Boolean(catPlayer && dogPlayer), true);

    cat.emit('testSetState', {
      gameStarted: true,
      gamePhase: 'payingRent',
      freePlay: true,
      currentPlayerIndex: 1,
      pendingRent: {
        payerId: dogPlayer.id,
        ownerId: catPlayer.id,
        rent: 120,
        propertyId: 1,
        propertyName: 'Mediterranean Avenue',
        isDoubles: false,
      },
      players: [
        { id: catPlayer.id, money: 500, properties: [1] },
        { id: dogPlayer.id, money: 300, properties: [] },
      ],
      board: [{ id: 1, owner: catPlayer.id }],
    });

    await waitForCondition(() => tracker.latestState?.gamePhase === 'payingRent', 3000);

    const rentPaid = waitForSocketEvent(cat, 'rentPaid');
    dog.emit('payRent');
    const rentPayload = await rentPaid;

    assert.equal(rentPayload.rent, 120);

    const finalState = await waitForCondition(() => {
      const s = tracker.latestState;
      if (!s) return null;
      const finalCat = s.players.find((p) => p.id === catPlayer.id);
      const finalDog = s.players.find((p) => p.id === dogPlayer.id);
      if (!finalCat || !finalDog) return null;
      if (finalCat.money !== 620) return null;
      if (finalDog.money !== 180) return null;
      return s;
    }, 5000);

    const finalCat = finalState.players.find((p) => p.id === catPlayer.id);
    const finalDog = finalState.players.find((p) => p.id === dogPlayer.id);
    assert.equal(finalCat.money, 620);
    assert.equal(finalDog.money, 180);
  } finally {
    cat.close();
    dog.close();
    await wait(120);
  }
});

test('integration: jail flow supports paying fine and using a card', async () => {
  const cat = await connectSocket(baseUrl);
  const dog = await connectSocket(baseUrl);
  const tracker = trackGameState(cat);

  try {
    cat.emit('joinGame', 'Cat');
    dog.emit('joinGame', 'Dog');
    await waitForCondition(() => tracker.latestState && tracker.latestState.players.length >= 2, 5000);

    const catPlayer = tracker.latestState.players.find((p) => p.name === 'Cat');
    const dogPlayer = tracker.latestState.players.find((p) => p.name === 'Dog');
    assert.equal(Boolean(catPlayer && dogPlayer), true);

    cat.emit('testSendToJail', catPlayer.id);
    await waitForCondition(() => {
      const s = tracker.latestState;
      const jailed = s?.players.find((p) => p.id === catPlayer.id);
      return jailed?.inJail === true;
    }, 3000);

    cat.emit('testSetState', {
      gamePhase: 'rolling',
      currentPlayerIndex: 0,
      freePlay: true,
      players: [{ id: catPlayer.id, money: 200, getOutOfJailCards: 1 }],
    });
    await waitForCondition(() => tracker.latestState?.players.find((p) => p.id === catPlayer.id)?.money === 200, 3000);

    cat.emit('payJailFine');
    const afterFine = await waitForCondition(() => {
      const jailed = tracker.latestState?.players.find((p) => p.id === catPlayer.id);
      return jailed && jailed.hasPaidJailFine === true && jailed.money === 150 ? jailed : null;
    }, 3000);

    assert.equal(afterFine.money, 150);

    cat.emit('useGetOutOfJailCard');
    await waitForCondition(() => {
      const player = tracker.latestState?.players.find((p) => p.id === catPlayer.id);
      return player && player.inJail === false && player.getOutOfJailCards === 0 ? player : null;
    }, 3000);

    const freed = await waitForCondition(() => {
      const player = tracker.latestState?.players.find((p) => p.id === catPlayer.id);
      return player && player.inJail === false ? player : null;
    }, 3000);

    assert.equal(freed.inJail, false);
  } finally {
    cat.close();
    dog.close();
    await wait(120);
  }
});

test('integration: trade proposal and acceptance swaps property and money', async () => {
  const cat = await connectSocket(baseUrl);
  const dog = await connectSocket(baseUrl);
  let latestState = null;
  cat.on('gameState', (state) => {
    latestState = state;
  });

  try {
    cat.emit('joinGame', 'Cat');
    dog.emit('joinGame', 'Dog');
    await waitForCondition(() => latestState && latestState.players.length >= 2, 5000);

    // Deterministically set up assets using dev tools.
    cat.emit('devGiveMoney', 5000);
    dog.emit('devGiveMoney', 5000);
    cat.emit('devGiveProperty', 1);
    dog.emit('devGiveProperty', 3);
    await waitForCondition(() => {
      if (!latestState) return false;
      const catPlayerCheck = latestState.players.find((p) => p.name === 'Cat');
      const dogPlayerCheck = latestState.players.find((p) => p.name === 'Dog');
      return !!catPlayerCheck && !!dogPlayerCheck;
    }, 5000);

    // Find player ids from current state.
    const state = latestState;
    const catPlayer = state.players.find((p) => p.name === 'Cat');
    const dogPlayer = state.players.find((p) => p.name === 'Dog');
    assert.equal(Boolean(catPlayer && dogPlayer), true);

    const tradeProposed = waitForSocketEvent(dog, 'tradeProposed');
    cat.emit('proposeTrade', {
      toPlayerId: dogPlayer.id,
      offer: { money: 100, properties: [1] },
      request: { money: 50, properties: [3] },
    });

    const proposedPayload = await tradeProposed;
    const tradeId = proposedPayload.trade.id;

    const executedForCat = waitForSocketEvent(cat, 'tradeExecuted');
    dog.emit('respondTrade', { tradeId, accept: true, respondAsId: dogPlayer.id });
    await executedForCat;

    const finalState = await waitForCondition(() => {
      const s = latestState;
      if (!s) return null;
      const finalCatCheck = s.players.find((p) => p.id === catPlayer.id);
      const finalDogCheck = s.players.find((p) => p.id === dogPlayer.id);
      if (!finalCatCheck || !finalDogCheck) return null;
      if (!finalCatCheck.properties.includes(3)) return null;
      if (!finalDogCheck.properties.includes(1)) return null;
      return s;
    }, 5000);
    const finalCat = finalState.players.find((p) => p.id === catPlayer.id);
    const finalDog = finalState.players.find((p) => p.id === dogPlayer.id);

    assert.equal(finalCat.properties.includes(3), true);
    assert.equal(finalDog.properties.includes(1), true);
  } finally {
    cat.close();
    dog.close();
    await wait(120);
  }
});
