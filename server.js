import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import pool, { initDb } from './database.js';

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
  gamePhase: 'waiting' // waiting, rolling, moving, buying, ended
  transactions: []
};

function createPlayerId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Board configuration (40 spaces)
const BOARD_SPACES = [
  { id: 0, name: 'GO', type: 'special', color: null, price: 0, rent: 0 },
  { id: 1, name: 'Mediterranean Avenue', type: 'property', color: 'brown', price: 60, rent: 2, owner: null },
  { id: 2, name: 'Community Chest', type: 'chest', color: null, price: 0, rent: 0 },
  { id: 3, name: 'Baltic Avenue', type: 'property', color: 'brown', price: 60, rent: 4, owner: null },
  { id: 4, name: 'Income Tax', type: 'tax', color: null, price: 0, rent: 0, amount: 200 },
  { id: 5, name: 'Reading Railroad', type: 'railroad', color: null, price: 200, rent: 25, owner: null },
  { id: 6, name: 'Oriental Avenue', type: 'property', color: 'lightblue', price: 100, rent: 6, owner: null },
  { id: 7, name: 'Chance', type: 'chance', color: null, price: 0, rent: 0 },
  { id: 8, name: 'Vermont Avenue', type: 'property', color: 'lightblue', price: 100, rent: 6, owner: null },
  { id: 9, name: 'Connecticut Avenue', type: 'property', color: 'lightblue', price: 120, rent: 8, owner: null },
  { id: 10, name: 'JAIL', type: 'jail', color: null, price: 0, rent: 0 },
  { id: 11, name: 'St. Charles Place', type: 'property', color: 'pink', price: 140, rent: 10, owner: null },
  { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150, rent: 0, owner: null },
  { id: 13, name: 'States Avenue', type: 'property', color: 'pink', price: 140, rent: 10, owner: null },
  { id: 14, name: 'Virginia Avenue', type: 'property', color: 'pink', price: 160, rent: 12, owner: null },
  { id: 15, name: 'Pennsylvania Railroad', type: 'railroad', color: null, price: 200, rent: 25, owner: null },
  { id: 16, name: 'St. James Place', type: 'property', color: 'orange', price: 180, rent: 14, owner: null },
  { id: 17, name: 'Community Chest', type: 'chest', color: null, price: 0, rent: 0 },
  { id: 18, name: 'Tennessee Avenue', type: 'property', color: 'orange', price: 180, rent: 14, owner: null },
  { id: 19, name: 'New York Avenue', type: 'property', color: 'orange', price: 200, rent: 16, owner: null },
  { id: 20, name: 'FREE PARKING', type: 'special', color: null, price: 0, rent: 0 },
  { id: 21, name: 'Kentucky Avenue', type: 'property', color: 'red', price: 220, rent: 18, owner: null },
  { id: 22, name: 'Chance', type: 'chance', color: null, price: 0, rent: 0 },
  { id: 23, name: 'Indiana Avenue', type: 'property', color: 'red', price: 220, rent: 18, owner: null },
  { id: 24, name: 'Illinois Avenue', type: 'property', color: 'red', price: 240, rent: 20, owner: null },
  { id: 25, name: 'B&O Railroad', type: 'railroad', color: null, price: 200, rent: 25, owner: null },
  { id: 26, name: 'Atlantic Avenue', type: 'property', color: 'yellow', price: 260, rent: 22, owner: null },
  { id: 27, name: 'Ventnor Avenue', type: 'property', color: 'yellow', price: 260, rent: 22, owner: null },
  { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150, rent: 0, owner: null },
  { id: 29, name: 'Marvin Gardens', type: 'property', color: 'yellow', price: 280, rent: 24, owner: null },
  { id: 30, name: 'GO TO JAIL', type: 'gotojail', color: null, price: 0, rent: 0 },
  { id: 31, name: 'Pacific Avenue', type: 'property', color: 'green', price: 300, rent: 26, owner: null },
  { id: 32, name: 'North Carolina Avenue', type: 'property', color: 'green', price: 300, rent: 26, owner: null },
  { id: 33, name: 'Community Chest', type: 'chest', color: null, price: 0, rent: 0 },
  { id: 34, name: 'Pennsylvania Avenue', type: 'property', color: 'green', price: 320, rent: 28, owner: null },
  { id: 35, name: 'Short Line', type: 'railroad', color: null, price: 200, rent: 25, owner: null },
  { id: 36, name: 'Chance', type: 'chance', color: null, price: 0, rent: 0 },
  { id: 37, name: 'Park Place', type: 'property', color: 'darkblue', price: 350, rent: 35, owner: null },
  { id: 38, name: 'Luxury Tax', type: 'tax', color: null, price: 0, rent: 0, amount: 100 },
  { id: 39, name: 'Boardwalk', type: 'property', color: 'darkblue', price: 400, rent: 50, owner: null },
];

// Initialize board in game state
gameState.board = BOARD_SPACES.map(space => ({ ...space }));

// Player colors
const PLAYER_COLORS = ['#fa0000', '#0bf2e3', '#efca13', '#35e71a', '#2d00a8', '#fc870b'];

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
  if (!gameState.transactions) {
    gameState.transactions = [];
  }
  io.emit('gameState', gameState);
}

// ── Auth & Game Save API Routes ──────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
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
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Must be logged in to save' });
  }
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Save name required' });
  }
  try {
    const gameData = gameState;
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
  if (space.type === 'railroad') {
    const railroadCount = gameState.board.filter(s => 
      s.type === 'railroad' && s.owner === owner.id
    ).length;
    return space.rent * railroadCount;
  }
  if (space.type === 'utility') {
    const utilityCount = gameState.board.filter(s => 
      s.type === 'utility' && s.owner === owner.id
    ).length;
    // For utilities, rent is 4x dice roll for 1 utility, 10x for 2
    return 0; // Will be calculated with dice roll
  }
  return space.rent;
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

  // Send current game state to newly connected client
  socket.emit('gameState', gameState);

  // Handle player joining
  socket.on('joinGame', (playerName) => {
    // If a loaded save has a player with this name waiting to reconnect, restore them
    // (must be checked before the gameStarted guard so reconnection works after loading)
    history: [];
    const existingDisconnected = gameState.players.find(
      p => p.name === playerName && !p.socketId
    );

    if (existingDisconnected) {
      existingDisconnected.socketId = socket.id;
      broadcastGameState();
      return;
    }

    const existingActive = gameState.players.find(
      p => p.name === playerName && p.socketId
    );

    if (existingActive) {
      socket.emit('error', 'Name already taken');
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
    consecutiveDoubles: 0,
    history: []
  };

  gameState.players.push(player);
  broadcastGameState();
  });

  // Handle starting the game
  socket.on('startGame', () => {
    if (gameState.players.length < 1) {
      socket.emit('error', 'Need at least 1 player');
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
    currentPlayer.history.push({
      type: 'move',
      from: oldPosition,
      to: newPosition,
      dice: total,
      time: Date.now()
    });
    
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

    // Broadcast dice result and game state
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

    // Check funds
    if (payer.money < pending.rent) {
      console.log(`Payer ${payer.id} has insufficient funds: ${payer.money} < ${pending.rent}`);
      // Still allow negative balance for now, but notify
      socket.emit('error', 'Not enough money to fully pay rent (will allow negative balance)');
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

    gameState.transactions.push({
      type: 'rent',
      from: payer.id,
      to: owner.id,
      amount: pending.rent,
      property: pending.propertyName,
      time: Date.now()
    });
    
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

    gameState.transactions.push({
      type: 'buy',
      playerId: currentPlayer.id,
      property: space.name,
      amount: space.price,
      time: Date.now()
    });

    currentPlayer.history.push({
      type: 'buy',
      property: space.name,
      price: space.price,
      time: Date.now()
});
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

  // Handle removing a player from the lobby before the game starts
  socket.on('removePlayer', (playerId) => {
    if (gameState.gameStarted) return;
    gameState.players = gameState.players.filter(p => p.id !== playerId);
    broadcastGameState();
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const player = gameState.players.find(p => p.socketId === socket.id);
    if (player) {
      player.socketId = null;
    }    
    // If no players left, reset game
    if (gameState.players.length === 0) {
      gameState.gameStarted = false;
      gameState.currentPlayerIndex = 0;
      gameState.gamePhase = 'waiting';
      // Reset board ownership
      gameState.board = BOARD_SPACES.map(space => ({ ...space }));
      gameState.transactions = [];
    } else {
      // Adjust current player index if needed
      if (gameState.currentPlayerIndex >= gameState.players.length) {
        gameState.currentPlayerIndex = 0;
      }
    }
    
    broadcastGameState();
  });
  // in-game chat
  socket.on('sendMessage', (msg) => {
  const player = gameState.players.find(p => p.socketId === socket.id);

  io.emit('chatMessage', {
    player: player ? player.name : 'Unknown',
    message: msg,
    time: Date.now()
    });
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

