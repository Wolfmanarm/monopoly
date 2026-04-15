import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import pool, { initDb, dbEnabled } from './database.js';
import { registerDevTools } from './devTools.js';
import {
  BOARD_SPACES,
  HOUSE_COST_BY_COLOR,
  PROPERTY_RENT_TIERS,
  createInitialBoard,
  calculateRentForSpace,
  getColorGroups
} from './gameRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(session({
  secret: 'monopoly-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// Game state stored in memory
let gameState = {
  players: [],
  currentPlayerIndex: 0,
  board: [],
  gameStarted: false,
  gamePhase: 'waiting', // waiting, rolling, moving, buying, ended
  pendingTrades: []
};

function createPlayerId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Initialize board in game state
gameState.board = createInitialBoard();

// Player colors
const PLAYER_COLORS = ['#fa0000', '#0bf2e3', '#efca13', '#35e71a', '#2d00a8', '#fc870b'];
const isTestMode = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1';

const CHANCE_CARDS = [
  { text: 'Advance to GO (Collect $200)', type: 'move', position: 0, collectGo: true },
  { text: 'Bank pays you dividend of $50', type: 'money', amount: 50 },
  { text: 'Get Out of Jail Free', type: 'getOutOfJail' },
  { text: 'Pay poor tax of $15', type: 'money', amount: -15 },
  { text: 'Advance to Illinois Avenue', type: 'move', position: 24, collectGo: true },
  { text: 'Go to Jail. Go directly to Jail.', type: 'jail' },
];

const COMMUNITY_CHEST_CARDS = [
  { text: 'Bank error in your favor. Collect $200', type: 'money', amount: 200 },
  { text: 'Doctor\'s fee. Pay $50', type: 'money', amount: -50 },
  { text: 'Get Out of Jail Free', type: 'getOutOfJail' },
  { text: 'From sale of stock you get $50', type: 'money', amount: 50 },
  { text: 'Pay school fees of $50', type: 'money', amount: -50 },
  { text: 'Advance to GO (Collect $200)', type: 'move', position: 0, collectGo: true },
  { text: 'Go to Jail. Go directly to Jail.', type: 'jail' },
];

// Broadcast game state to all clients
function broadcastGameState() {
  io.emit('gameState', gameState);
}

const COLOR_GROUPS = getColorGroups(BOARD_SPACES);

// ── Auth & Game Save API Routes ──────────────────────────────────────────────

function requireDatabase(res) {
  if (dbEnabled) return false;
  res.status(503).json({ error: 'Database features are disabled in local mode (set DATABASE_URL to enable auth and saves).' });
  return true;
}

app.post('/api/register', async (req, res) => {
  if (requireDatabase(res)) return;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.trim().length < 3 || username.trim().length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    );
    const user = rows[0];
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ id: user.id, username: user.username });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  if (requireDatabase(res)) return;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ id: user.id, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json({ id: req.session.userId, username: req.session.username });
});

app.post('/api/save-game', async (req, res) => {
  if (requireDatabase(res)) return;
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Must be logged in to save' });
  }
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Save name required' });
  }
  try {
    const gameData = JSON.stringify(gameState);
    const { rows } = await pool.query(
      'INSERT INTO saved_games (user_id, name, game_data) VALUES ($1, $2, $3) RETURNING id, name, saved_at',
      [req.session.userId, name.trim(), gameData]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Save game error:', err);
    res.status(500).json({ error: 'Failed to save game' });
  }
});

app.get('/api/saved-games', async (req, res) => {
  if (requireDatabase(res)) return;
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Must be logged in' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, name, saved_at FROM saved_games WHERE user_id = $1 ORDER BY saved_at DESC',
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get saves error:', err);
    res.status(500).json({ error: 'Failed to get saves' });
  }
});

app.post('/api/load-game', async (req, res) => {
  if (requireDatabase(res)) return;
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Must be logged in' });
  }
  const { saveId } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM saved_games WHERE id = $1 AND user_id = $2',
      [saveId, req.session.userId]
    );
    const save = rows[0];
    if (!save) {
      return res.status(404).json({ error: 'Save not found' });
    }
    const savedState = JSON.parse(save.game_data);
    savedState.players.forEach(p => { p.socketId = null; });
    savedState.gameStarted = true;
    savedState.gamePhase = 'rolling';
    savedState.freePlay = true;
    delete savedState.pendingRent;
    Object.assign(gameState, savedState);
    broadcastGameState();
    res.json({ ok: true, name: save.name });
  } catch (err) {
    console.error('Load game error:', err);
    res.status(500).json({ error: 'Failed to load game' });
  }
});

app.delete('/api/saved-games/:id', async (req, res) => {
  if (requireDatabase(res)) return;
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Must be logged in' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM saved_games WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.session.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Save not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete save error:', err);
    res.status(500).json({ error: 'Failed to delete save' });
  }
});

// Calculate rent for a property
function calculateRent(space, owner) {
  return calculateRentForSpace(gameState.board, space, owner);
}

function buildingLevel(space) {
  return space?.hotel ? 5 : (Number(space?.houses) || 0);
}

function canBuildOnProperty(state, player, propertyId) {
  const property = state.board[propertyId];
  const ownedSet = new Set((player.properties || []).map((id) => Number(id)));
  const ownsProperty = ownedSet.has(Number(propertyId));
  if (!property || property.type !== 'property') {
    return { ok: false, reason: 'Only standard properties can be developed' };
  }

  if (!ownsProperty && property.owner !== player.id) {
    return { ok: false, reason: 'You do not own this property' };
  }

  const colorSet = state.board.filter(s => s.type === 'property' && s.color === property.color);
  const ownsEntireSet = colorSet.length > 0 && colorSet.every(s => ownedSet.has(Number(s.id)));
  if (!ownsEntireSet) {
    return { ok: false, reason: 'You must own the full color set to build' };
  }

  const currentLevel = buildingLevel(property);
  if (currentLevel >= 5) {
    return { ok: false, reason: 'Hotel already built on this property' };
  }

  const nextLevel = currentLevel + 1;
  const simulatedLevels = colorSet.map((s) => {
    if (s.id === property.id) return nextLevel;
    return buildingLevel(s);
  });
  const maxLevel = Math.max(...simulatedLevels);
  const minLevel = Math.min(...simulatedLevels);
  if (maxLevel - minLevel > 1) {
    return { ok: false, reason: 'You must build evenly across the color set' };
  }

  const cost = HOUSE_COST_BY_COLOR[property.color] || 100;
  if (player.money < cost) {
    return { ok: false, reason: `Not enough money. Need $${cost}` };
  }

  return { ok: true, property, cost, nextLevel };
}


function buildOnProperty(property) {
  const houses = Number(property.houses) || 0;
  if (houses < 4) {
    property.houses = houses + 1;
    return 'house';
  }
  property.houses = 0;
  property.hotel = true;
  return 'hotel';
}

function declareBankruptcy(player, creditorId = null, reason = '') {
  const bankruptIndex = gameState.players.findIndex(p => p.id === player.id);
  if (bankruptIndex === -1) return;

  const creditor = creditorId
    ? gameState.players.find(p => p.id === creditorId)
    : null;

  const transferredProperties = [...(player.properties || [])];

  // Transfer remaining cash
  if (creditor) {
    if (player.money > 0) {
      creditor.money += player.money;
    }

    transferredProperties.forEach((propertyId) => {
      const space = gameState.board[propertyId];
      if (!space) return;

      space.owner = creditor.id;

      if (!creditor.properties.includes(propertyId)) {
        creditor.properties.push(propertyId);
      }
    });
  } else {
    // Bankruptcy to the bank:
    // reset property ownership and clear buildings
    transferredProperties.forEach((propertyId) => {
      const space = gameState.board[propertyId];
      if (!space) return;

      space.owner = null;

      if (space.type === 'property') {
        space.houses = 0;
        space.hotel = false;
      }
    });
  }

  // Clear player's property list and money
  player.properties = [];
  player.money = 0;

  // Remove pending rent if this player was part of it
  if (
    gameState.pendingRent &&
    (
      gameState.pendingRent.payerId === player.id ||
      gameState.pendingRent.ownerId === player.id
    )
  ) {
    delete gameState.pendingRent;
  }

  // Remove any pending trades involving this player
  gameState.pendingTrades = (gameState.pendingTrades || []).filter(trade =>
    trade.fromId !== player.id && trade.toId !== player.id
  );

  // Remove player from game
  gameState.players.splice(bankruptIndex, 1);

  // Fix current player index
  if (gameState.players.length === 0) {
    gameState.currentPlayerIndex = 0;
    gameState.gameStarted = false;
    gameState.gamePhase = 'waiting';
  } else {
    if (bankruptIndex < gameState.currentPlayerIndex) {
      gameState.currentPlayerIndex -= 1;
    } else if (gameState.currentPlayerIndex >= gameState.players.length) {
      gameState.currentPlayerIndex = 0;
    }
  }

  io.emit('playerBankrupt', {
    playerId: player.id,
    playerName: player.name,
    creditorId: creditor ? creditor.id : null,
    creditorName: creditor ? creditor.name : null,
    reason,
    transferredProperties
  });

  // Check win condition
  if (gameState.players.length === 1 && gameState.gameStarted) {
    gameState.gamePhase = 'ended';
    io.emit('gameOver', {
      winnerId: gameState.players[0].id,
      winnerName: gameState.players[0].name
    });
  } else if (gameState.players.length > 1) {
    gameState.gamePhase = 'rolling';
  }

  broadcastGameState();
}


function drawRandomCard(cards) {
  const index = Math.floor(Math.random() * cards.length);
  return cards[index];
}

function movePlayerToPosition(player, newPosition, collectGo = false) {
  const oldPosition = player.position;
  const passedGo = newPosition < oldPosition;
  player.position = newPosition;

  if (collectGo && passedGo) {
    player.money += 200;
  }
}

function sendPlayerToJail(player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  player.hasPaidJailFine = false;
  player.consecutiveDoubles = 0;
}

function applyCardEffect(player, spaceType) {
  const isChance = spaceType === 'chance';
  const deck = isChance ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
  const card = drawRandomCard(deck);

  const result = {
    action: isChance ? 'chanceCard' : 'chestCard',
    cardText: card.text,
  };

  if (card.type === 'money') {
    player.money += card.amount;
    result.amount = card.amount;
    return result;
  }

  if (card.type === 'move') {
    movePlayerToPosition(player, card.position, !!card.collectGo);
    result.newPosition = player.position;
    result.newSpaceName = gameState.board[player.position]?.name;
    return result;
  }

  if (card.type === 'jail') {
    sendPlayerToJail(player);
    result.newPosition = 10;
    result.newSpaceName = 'JAIL';
    return result;
  }

  if (card.type === 'getOutOfJail') {
    player.getOutOfJailCards = (player.getOutOfJailCards || 0) + 1;
    result.cardGranted = 'getOutOfJail';
    result.getOutOfJailCards = player.getOutOfJailCards;
    return result;
  }

  return result;
}

// Handle player landing on a space
function handleLandOnSpace(player, space, diceRoll) {
  if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
    if (space.owner === null) {
      // Property is unowned - player can buy
      gameState.gamePhase = 'buying';
      return { action: 'canBuy', space: space };
    } else if (space.owner !== player.id) {
      // Property is owned by someone else - pay rent
      const owner = gameState.players.find(p => p.id === space.owner);
      if (!owner) {
        return { action: 'none' };
      }
      let rent = calculateRent(space, owner);
      
      if (space.type === 'utility') {
        const utilityCount = gameState.board.filter(s => 
          s.type === 'utility' && s.owner === owner.id
        ).length;
        rent = diceRoll * (utilityCount === 2 ? 10 : 4);
      }
      // Defer actual money transfer until the player confirms payment
      return { action: 'rentDue', rent: rent, ownerId: owner.id, owner: owner.name, propertyName: space.name, propertyId: space.id, diceRoll };
    }
  } else if (space.type === 'tax') {
    player.money -= space.amount;
    return { action: 'paidTax', amount: space.amount };
  } else if (space.type === 'chance' || space.type === 'chest') {
    return applyCardEffect(player, space.type);
  } else if (space.type === 'gotojail') {
    sendPlayerToJail(player);
    return { action: 'goToJail' };
  } else if (space.type === 'special' && space.name === 'GO') {
    player.money += 200;
    return { action: 'passedGo', amount: 200 };
  }
  return { action: 'none' };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  registerDevTools(io, socket, gameState, {
    COLOR_GROUPS,
    broadcastGameState
  });

  // Send current game state to newly connected client
  socket.emit('gameState', gameState);

  // Handle player joining
  socket.on('joinGame', (playerName) => {
    // If a loaded save has a player with this name waiting to reconnect, restore them
    // (must be checked before the gameStarted guard so reconnection works after loading)
    const savedPlayer = gameState.players.find(p => p.name === playerName && !p.socketId);
    if (savedPlayer) {
      savedPlayer.socketId = socket.id;
      console.log(`${playerName} reconnected to loaded save`);
      broadcastGameState();
      return;
    }

    if (gameState.gameStarted) {
      socket.emit('error', 'Game has already started');
      return;
    }

    if (gameState.players.length >= 6) {
      socket.emit('error', 'Game is full (max 6 players)');
      return;
    }

    const player = {
      id: createPlayerId(),
      socketId: socket.id,
      name: playerName,
      money: 1500,
      position: 0,
      properties: [],
      color: PLAYER_COLORS[gameState.players.length % PLAYER_COLORS.length],
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: 0,
      hasPaidJailFine: false,
      consecutiveDoubles: 0
    };

    gameState.players.push(player);
    console.log(`${playerName} joined the game`);
    broadcastGameState();
  });

  // Handle starting the game
  socket.on('startGame', () => {
    if (gameState.players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }
    if (gameState.gameStarted) {
      socket.emit('error', 'Game already started');
      return;
    }

    gameState.gameStarted = true;
    gameState.gamePhase = 'rolling';
    gameState.currentPlayerIndex = 0;
    console.log('Game started!');
    broadcastGameState();
  });

  // Handle dice roll
  socket.on('rollDice', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (!gameState.freePlay && socket.id !== currentPlayer.socketId) {
      socket.emit('error', 'Not your turn');
      return;
    }

    if (gameState.gamePhase !== 'rolling') {
      socket.emit('error', 'Invalid game phase');
      return;
    }

    // Server-side dice roll
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    const isDoubles = die1 === die2;

    // Jail flow
    let escapedJailByDoubles = false;
    if (currentPlayer.inJail) {
      if (currentPlayer.hasPaidJailFine) {
        currentPlayer.hasPaidJailFine = false;
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
      } else if (isDoubles) {
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        escapedJailByDoubles = true;
      } else {
        currentPlayer.jailTurns = (currentPlayer.jailTurns || 0) + 1;

        // Third failed attempt: pay $50 and move using this roll
        if (currentPlayer.jailTurns >= 3) {
          if (currentPlayer.money < 50) {
            declareBankruptcy(currentPlayer, null, 'Could not pay third failed jail fine');
            return;
          }

          currentPlayer.money -= 50;
          currentPlayer.inJail = false;
          currentPlayer.jailTurns = 0;

          io.emit('diceRolled', {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            spaceName: gameState.board[currentPlayer.position]?.name,
            finalSpaceName: gameState.board[currentPlayer.position]?.name,
            dice: [die1, die2],
            total: total,
            isDoubles: isDoubles,
            result: {
              action: 'jailThirdFailPaid',
              amount: 50,
            },
            postCardResult: null
          });
        } else {
          io.emit('diceRolled', {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            spaceName: gameState.board[currentPlayer.position]?.name,
            finalSpaceName: gameState.board[currentPlayer.position]?.name,
            dice: [die1, die2],
            total: total,
            isDoubles: isDoubles,
            result: {
              action: 'jailStay',
              turnsRemaining: 3 - currentPlayer.jailTurns,
            },
            postCardResult: null
          });

          gameState.gamePhase = 'waiting';
          broadcastGameState();

          setTimeout(() => {
            currentPlayer.consecutiveDoubles = 0;
            currentPlayer.hasPaidJailFine = false;
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            gameState.gamePhase = 'rolling';
            broadcastGameState();
          }, 2000);
          return;
        }
      }
    }

    // Handle three consecutive doubles (when not in jail)
    if (!currentPlayer.inJail) {
      if (isDoubles) {
        currentPlayer.consecutiveDoubles = (currentPlayer.consecutiveDoubles || 0) + 1;
      } else {
        currentPlayer.consecutiveDoubles = 0;
      }

      if (currentPlayer.consecutiveDoubles >= 3) {
        sendPlayerToJail(currentPlayer);
        io.emit('diceRolled', {
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          spaceName: 'JAIL',
          finalSpaceName: 'JAIL',
          dice: [die1, die2],
          total: total,
          isDoubles: isDoubles,
          result: {
            action: 'goToJailByDoubles',
          },
          postCardResult: null
        });

        gameState.gamePhase = 'waiting';
        broadcastGameState();

        setTimeout(() => {
          gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
          gameState.gamePhase = 'rolling';
          broadcastGameState();
        }, 2000);
        return;
      }
    }

    // Move player
    const oldPosition = currentPlayer.position;
    const newPosition = (oldPosition + total) % 40;
    const passedGo = (oldPosition + total) >= 40;

    currentPlayer.position = newPosition;

    // Give $200 for passing GO
    if (passedGo && newPosition !== 0) {
      currentPlayer.money += 200;
    }

    // Handle landing on space
    const space = gameState.board[newPosition];
    const result = handleLandOnSpace(currentPlayer, space, total);
    let postCardResult = null;

    // If a card moved the player, resolve the destination square too
    if ((result.action === 'chanceCard' || result.action === 'chestCard') && Number.isInteger(result.newPosition)) {
      const destinationSpace = gameState.board[currentPlayer.position];
      if (destinationSpace && destinationSpace.type !== 'chance' && destinationSpace.type !== 'chest') {
        postCardResult = handleLandOnSpace(currentPlayer, destinationSpace, total);
      }
    }

    const finalResult = postCardResult || result;

    // Update game phase
    if (finalResult.action === 'canBuy') {
      gameState.gamePhase = 'buying';
    } else if (finalResult.action === 'rentDue') {
      // Create a pending rent object and wait for payer confirmation
      console.log(`Rent due: payer=${currentPlayer.id}, owner=${finalResult.ownerId}, rent=${finalResult.rent}, property=${finalResult.propertyName}`);
      gameState.pendingRent = {
        payerId: currentPlayer.id,
        ownerId: finalResult.ownerId,
        rent: finalResult.rent,
        propertyId: finalResult.propertyId,
        propertyName: finalResult.propertyName,
        isDoubles: isDoubles && !escapedJailByDoubles,
        diceTotal: total,
      };
      gameState.gamePhase = 'payingRent';
    } else {
      gameState.gamePhase = 'waiting';
    }

    // Broadcast dice result
    io.emit('diceRolled', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      ownerId: space.owner || null,
      spaceName: space.name,
      finalSpaceName: gameState.board[currentPlayer.position]?.name,
      dice: [die1, die2],
      total: total,
      isDoubles: isDoubles,
      result: result,
      postCardResult: postCardResult
    });

    // If player went negative from tax / cards / other bank debt, bankrupt to bank
    if (finalResult.action !== 'rentDue' && currentPlayer.money < 0) {
      declareBankruptcy(
        currentPlayer,
        null,
        `Could not cover ${finalResult.action}`
      );
      return;
    }

    broadcastGameState();

    // Handle turn progression:
    // - If result.action === 'canBuy', wait for buy/skip handlers
    // - If doubles (and not buying), same player rolls again
    // - Otherwise, advance to next player
    // If renting is due we wait for the payer to confirm; otherwise handle turn progression
    if (finalResult.action !== 'canBuy' && finalResult.action !== 'rentDue') {
      if (isDoubles && !escapedJailByDoubles) {
        setTimeout(() => {
          gameState.gamePhase = 'rolling';
          broadcastGameState();
        }, 2000);
      } else {
        setTimeout(() => {
          currentPlayer.consecutiveDoubles = 0;
          currentPlayer.hasPaidJailFine = false;
          gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
          gameState.gamePhase = 'rolling';
          broadcastGameState();
        }, 2000);
      }
    }
  });

  // Handle rent payment confirmation from payer
  socket.on('payRent', () => {
    const pending = gameState.pendingRent;
    console.log(`payRent received from socket=${socket.id}`, { pending: !!pending });
    if (!pending) {
      socket.emit('error', 'No rent is pending');
      return;
    }

    const payer = gameState.players.find(p => p.id === pending.payerId);
    const owner = gameState.players.find(p => p.id === pending.ownerId);

    if (!payer || !owner) {
      socket.emit('error', 'Invalid payer or owner');
      return;
    }

    if (!gameState.freePlay && socket.id !== payer.socketId) {
      socket.emit('error', 'Only the owing player can confirm payment');
      return;
    }

    if (gameState.gamePhase !== 'payingRent') {
      socket.emit('error', 'Not currently expecting rent payment');
      return;
    }

    if (payer.money < pending.rent) {
      declareBankruptcy(
        payer,
        owner.id,
        `Could not pay $${pending.rent} rent for ${pending.propertyName}`
      );
      return;
    }

    // Process payment
    payer.money -= pending.rent;
    owner.money += pending.rent;

    console.log(`Rent processed: ${payer.name} -> ${owner.name} $${pending.rent}`);

    // Notify clients
    io.emit('rentPaid', {
      payerId: payer.id,
      payerName: payer.name,
      ownerId: owner.id,
      ownerName: owner.name,
      rent: pending.rent,
      propertyName: pending.propertyName
    });

    // Clear pending rent and set phase
    delete gameState.pendingRent;
    gameState.gamePhase = 'waiting';
    broadcastGameState();

    // Advance turn (respect doubles)
    if (pending.isDoubles) {
      setTimeout(() => {
        gameState.gamePhase = 'rolling';
        broadcastGameState();
      }, 1000);
    } else {
      setTimeout(() => {
        payer.consecutiveDoubles = 0;
        payer.hasPaidJailFine = false;
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.gamePhase = 'rolling';
        broadcastGameState();
      }, 1000);
    }
  });

  socket.on('payJailFine', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (!currentPlayer || (!gameState.freePlay && socket.id !== currentPlayer.socketId)) {
      socket.emit('error', 'Not your turn');
      return;
    }

    if (gameState.gamePhase !== 'rolling') {
      socket.emit('error', 'Cannot pay jail fine right now');
      return;
    }

    if (!currentPlayer.inJail) {
      socket.emit('error', 'You are not in jail');
      return;
    }

    if (currentPlayer.hasPaidJailFine) {
      socket.emit('error', 'Jail fine already paid this turn');
      return;
    }

    if (currentPlayer.money < 50) {
      declareBankruptcy(currentPlayer, null, 'Could not pay jail fine');
      return;
    }

    currentPlayer.money -= 50;
    currentPlayer.hasPaidJailFine = true;

    io.emit('jailFinePaid', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      amount: 50,
    });

    broadcastGameState();
  });

  socket.on('useGetOutOfJailCard', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (!currentPlayer || (!gameState.freePlay && socket.id !== currentPlayer.socketId)) {
      socket.emit('error', 'Not your turn');
      return;
    }

    if (gameState.gamePhase !== 'rolling') {
      socket.emit('error', 'Cannot use card right now');
      return;
    }

    if (!currentPlayer.inJail) {
      socket.emit('error', 'You are not in jail');
      return;
    }

    if ((currentPlayer.getOutOfJailCards || 0) <= 0) {
      socket.emit('error', 'No Get Out of Jail Free cards available');
      return;
    }

    currentPlayer.getOutOfJailCards -= 1;
    currentPlayer.inJail = false;
    currentPlayer.jailTurns = 0;
    currentPlayer.hasPaidJailFine = false;

    io.emit('usedGetOutOfJailCard', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      remainingCards: currentPlayer.getOutOfJailCards,
    });

    broadcastGameState();
  });

  // Handle buying property
  socket.on('buyProperty', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (!gameState.freePlay && socket.id !== currentPlayer.socketId) {
      socket.emit('error', 'Not your turn');
      return;
    }

    if (gameState.gamePhase !== 'buying') {
      socket.emit('error', 'Cannot buy property now');
      return;
    }

    const space = gameState.board[currentPlayer.position];

    const canOwnSpace = space.type === 'property' || space.type === 'railroad' || space.type === 'utility';
    if (!canOwnSpace || space.price <= 0) {
      socket.emit('error', 'This space cannot be purchased');
      return;
    }
    
    if (space.owner !== null) {
      socket.emit('error', 'Property already owned');
      return;
    }

    if (currentPlayer.money < space.price) {
      socket.emit('error', 'Not enough money');
      return;
    }

    // Buy property
    currentPlayer.money -= space.price;
    space.owner = currentPlayer.id;
    currentPlayer.properties.push(space.id);

    gameState.gamePhase = 'waiting';
    io.emit('propertyBought', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      propertyName: space.name,
      price: space.price
    });

    broadcastGameState();

    // Move to next player after a delay
    setTimeout(() => {
      currentPlayer.consecutiveDoubles = 0;
      currentPlayer.hasPaidJailFine = false;
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      gameState.gamePhase = 'rolling';
      broadcastGameState();
    }, 2000);
  });

  // Handle skipping property purchase
  socket.on('skipBuy', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (!gameState.freePlay && socket.id !== currentPlayer.socketId) {
      socket.emit('error', 'Not your turn');
      return;
    }

    if (gameState.gamePhase !== 'buying') {
      return;
    }

    gameState.gamePhase = 'waiting';
    broadcastGameState();

    // Move to next player
    setTimeout(() => {
      currentPlayer.consecutiveDoubles = 0;
      currentPlayer.hasPaidJailFine = false;
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      gameState.gamePhase = 'rolling';
      broadcastGameState();
    }, 1000);
  });

  // Handle buying houses/hotels
  socket.on('buyBuilding', ({ propertyId }) => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || (!gameState.freePlay && socket.id !== currentPlayer.socketId)) {
      socket.emit('error', 'Not your turn');
      return;
    }

    if (gameState.gamePhase === 'buying' || gameState.gamePhase === 'payingRent' || gameState.gamePhase === 'ended') {
      socket.emit('error', 'You cannot build right now');
      return;
    }

    const numericPropertyId = Number(propertyId);
    const validation = canBuildOnProperty(gameState, currentPlayer, numericPropertyId);
    if (!validation.ok) {
      socket.emit('error', validation.reason);
      return;
    }

    const property = gameState.board[numericPropertyId];
    currentPlayer.money -= validation.cost;
    const buildingType = buildOnProperty(property);

    io.emit('buildingBought', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      propertyId: property.id,
      propertyName: property.name,
      cost: validation.cost,
      buildingType,
      houses: property.houses || 0,
      hotel: !!property.hotel,
    });

    broadcastGameState();
  });

  // Handle trade proposals
  socket.on('proposeTrade', (trade) => {
    const proposer = gameState.players.find(p => p.socketId === socket.id);
    if (!proposer) {
      socket.emit('tradeError', 'You must be in the game to propose trades');
      return;
    }

    const target = gameState.players.find(p => p.id === trade.toPlayerId);
    if (!target) {
      socket.emit('tradeError', 'Target player not found');
      return;
    }

    const tradeId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pending = {
      id: tradeId,
      fromId: proposer.id,
      toId: target.id,
      offer: {
        money: Number(trade.offer?.money) || 0,
        properties: Array.isArray(trade.offer?.properties) ? trade.offer.properties.map(Number) : []
      },
      request: {
        money: Number(trade.request?.money) || 0,
        properties: Array.isArray(trade.request?.properties) ? trade.request.properties.map(Number) : []
      },
      timestamp: Date.now()
    };

    gameState.pendingTrades = gameState.pendingTrades || [];
    gameState.pendingTrades.push(pending);

    if (target.socketId) {
      io.to(target.socketId).emit('tradeProposed', {
        trade: pending,
        from: { id: proposer.id, name: proposer.name }
      });
    }

    socket.emit('tradeProposalSent', { tradeId });
    broadcastGameState();
  });

  // Handle responses to trades (accept or decline)
  socket.on('respondTrade', ({ tradeId, accept, respondAsId }) => {
    const responder = respondAsId
      ? gameState.players.find(p => p.id === respondAsId)
      : gameState.players.find(p => p.socketId === socket.id);

    if (!responder) {
      socket.emit('tradeError', 'Player not found');
      return;
    }

    gameState.pendingTrades = gameState.pendingTrades || [];
    const idx = gameState.pendingTrades.findIndex(t => t.id === tradeId);
    if (idx === -1) {
      socket.emit('tradeError', 'Trade not found or already handled');
      return;
    }

    const pending = gameState.pendingTrades[idx];
    const proposer = gameState.players.find(p => p.id === pending.fromId);
    const target = gameState.players.find(p => p.id === pending.toId);

    if (!proposer || !target) {
      socket.emit('tradeError', 'Trade participants not found');
      return;
    }

    if (responder.id !== pending.toId) {
      socket.emit('tradeError', 'Only the target player can respond to this trade');
      return;
    }

    gameState.pendingTrades.splice(idx, 1);

    if (!accept) {
      if (proposer.socketId) io.to(proposer.socketId).emit('tradeDeclined', { tradeId, by: responder.id });
      if (target.socketId) io.to(target.socketId).emit('tradeDeclined', { tradeId, by: responder.id });
      broadcastGameState();
      return;
    }

    const offerProps = pending.offer.properties || [];
    const requestProps = pending.request.properties || [];

    const proposerStillOwns = offerProps.every(pid => proposer.properties.includes(pid));
    const targetStillOwns = requestProps.every(pid => target.properties.includes(pid));

    if (!proposerStillOwns || !targetStillOwns) {
      const msg = 'One or more properties are no longer owned by the proposing players';
      if (proposer.socketId) io.to(proposer.socketId).emit('tradeError', msg);
      if (target.socketId) io.to(target.socketId).emit('tradeError', msg);
      broadcastGameState();
      return;
    }

    if (proposer.money < pending.offer.money || target.money < pending.request.money) {
      const msg = 'One or both players lack sufficient funds for the proposed cash exchange';
      if (proposer.socketId) io.to(proposer.socketId).emit('tradeError', msg);
      if (target.socketId) io.to(target.socketId).emit('tradeError', msg);
      broadcastGameState();
      return;
    }

    offerProps.forEach((pid) => {
      proposer.properties = proposer.properties.filter(id => id !== pid);
      target.properties.push(pid);
      const space = gameState.board[Number(pid)];
      if (space) space.owner = target.id;
    });

    requestProps.forEach((pid) => {
      target.properties = target.properties.filter(id => id !== pid);
      proposer.properties.push(pid);
      const space = gameState.board[Number(pid)];
      if (space) space.owner = proposer.id;
    });

    const offerMoney = Number(pending.offer.money) || 0;
    const requestMoney = Number(pending.request.money) || 0;

    proposer.money -= offerMoney;
    target.money += offerMoney;

    target.money -= requestMoney;
    proposer.money += requestMoney;

    if (proposer.socketId) io.to(proposer.socketId).emit('tradeExecuted', { tradeId, with: target.id, details: pending });
    if (target.socketId) io.to(target.socketId).emit('tradeExecuted', { tradeId, with: proposer.id, details: pending });

    io.emit('tradeNotification', { message: `${proposer.name} and ${target.name} completed a trade.` });
    broadcastGameState();
  });

  // Handle removing a player from the lobby before the game starts
  socket.on('removePlayer', (playerId) => {
    if (gameState.gameStarted) return;
    gameState.players = gameState.players.filter(p => p.id !== playerId);
    broadcastGameState();
  });

  if (isTestMode) {
    socket.on('testSetState', (patch = {}) => {
      if (typeof patch.currentPlayerIndex === 'number') {
        gameState.currentPlayerIndex = patch.currentPlayerIndex;
      }
      if (typeof patch.gamePhase === 'string') {
        gameState.gamePhase = patch.gamePhase;
      }
      if (typeof patch.gameStarted === 'boolean') {
        gameState.gameStarted = patch.gameStarted;
      }
      if (typeof patch.freePlay === 'boolean') {
        gameState.freePlay = patch.freePlay;
      }
      if (patch.pendingRent === null) {
        delete gameState.pendingRent;
      } else if (patch.pendingRent) {
        gameState.pendingRent = patch.pendingRent;
      }
      if (Array.isArray(patch.players)) {
        patch.players.forEach((playerPatch) => {
          const player = gameState.players.find((p) => p.id === playerPatch.id);
          if (!player) return;
          Object.assign(player, playerPatch);
        });
      }
      if (Array.isArray(patch.board)) {
        patch.board.forEach((spacePatch) => {
          const space = gameState.board[Number(spacePatch.id)];
          if (!space) return;
          Object.assign(space, spacePatch);
        });
      }
      broadcastGameState();
    });

    socket.on('testSendToJail', (playerId) => {
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) return;
      player.position = 10;
      player.inJail = true;
      player.jailTurns = 0;
      player.hasPaidJailFine = false;
      player.consecutiveDoubles = 0;
      gameState.gamePhase = 'rolling';
      broadcastGameState();
    });

    socket.on('testSetCurrentPlayer', (playerId) => {
      const idx = gameState.players.findIndex((p) => p.id === playerId);
      if (idx >= 0) {
        gameState.currentPlayerIndex = idx;
        broadcastGameState();
      }
    });

    socket.on('testRollDice', ({ die1 = 1, die2 = 1 } = {}) => {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer) return;

      const total = Number(die1) + Number(die2);
      const oldPosition = currentPlayer.position;
      const newPosition = (oldPosition + total) % 40;
      const passedGo = (oldPosition + total) >= 40;

      currentPlayer.position = newPosition;
      if (passedGo && newPosition !== 0) {
        currentPlayer.money += 200;
      }

      io.emit('diceRolled', {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        spaceName: gameState.board[newPosition]?.name,
        finalSpaceName: gameState.board[newPosition]?.name,
        dice: [Number(die1), Number(die2)],
        total,
        isDoubles: Number(die1) === Number(die2),
        result: {
          action: 'testMove',
          oldPosition,
          newPosition,
        },
        postCardResult: null
      });

      broadcastGameState();
    });
  }

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    gameState.players = gameState.players.filter(p => p.socketId !== socket.id);
    
    // If no players left, reset game
    if (gameState.players.length === 0) {
      gameState.gameStarted = false;
      gameState.currentPlayerIndex = 0;
      gameState.gamePhase = 'waiting';
      delete gameState.pendingRent;
      gameState.pendingTrades = [];
      gameState.board = createInitialBoard();

    } else {
      // Adjust current player index if needed
      if (gameState.currentPlayerIndex >= gameState.players.length) {
        gameState.currentPlayerIndex = 0;
      }
    }
    
    broadcastGameState();
  });
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

