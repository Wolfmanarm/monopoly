import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// Game state stored in memory
let gameState = {
  players: [],
  currentPlayerIndex: 0,
  board: [],
  gameStarted: false,
  gamePhase: 'waiting' // waiting, rolling, moving, buying, ended
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

// Broadcast game state to all clients
function broadcastGameState() {
  io.emit('gameState', gameState);
}

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
  } else if (space.type === 'gotojail') {
    player.position = 10;
    player.inJail = true;
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
      inJail: false
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
    
    if (socket.id !== currentPlayer.socketId) {
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

    // Update game phase
    if (result.action === 'canBuy') {
      gameState.gamePhase = 'buying';
    } else if (result.action === 'rentDue') {
      // Create a pending rent object and wait for payer confirmation
      console.log(`Rent due: payer=${currentPlayer.id}, owner=${result.ownerId}, rent=${result.rent}, property=${result.propertyName}`);
      gameState.pendingRent = {
        payerId: currentPlayer.id,
        ownerId: result.ownerId,
        rent: result.rent,
        propertyId: result.propertyId,
        propertyName: result.propertyName,
        isDoubles: isDoubles,
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
      dice: [die1, die2],
      total: total,
      isDoubles: isDoubles,
      result: result
    });

    broadcastGameState();

    // Handle turn progression:
    // - If result.action === 'canBuy', wait for buy/skip handlers
    // - If doubles (and not buying), same player rolls again
    // - Otherwise, advance to next player
    // If renting is due we wait for the payer to confirm; otherwise handle turn progression
    if (result.action !== 'canBuy' && result.action !== 'rentDue') {
      if (isDoubles) {
        setTimeout(() => {
          gameState.gamePhase = 'rolling';
          broadcastGameState();
        }, 2000);
      } else {
        setTimeout(() => {
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

    if (socket.id !== payer.socketId) {
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
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.gamePhase = 'rolling';
        broadcastGameState();
      }, 1000);
    }
  });

  // Handle buying property
  socket.on('buyProperty', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (socket.id !== currentPlayer.socketId) {
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
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      gameState.gamePhase = 'rolling';
      broadcastGameState();
    }, 2000);
  });

  // Handle skipping property purchase
  socket.on('skipBuy', () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (socket.id !== currentPlayer.socketId) {
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
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
      gameState.gamePhase = 'rolling';
      broadcastGameState();
    }, 1000);
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    gameState.players = gameState.players.filter(p => p.socketId !== socket.id);
    
    // If no players left, reset game
    if (gameState.players.length === 0) {
      gameState.gameStarted = false;
      gameState.currentPlayerIndex = 0;
      gameState.gamePhase = 'waiting';
      // Reset board ownership
      gameState.board = BOARD_SPACES.map(space => ({ ...space }));
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
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

