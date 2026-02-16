// Socket.io connection
const socket = io();

let gameState = null;
let currentPlayerId = null;

// DOM Elements
const lobbyScreen = document.getElementById('lobby');
const gameScreen = document.getElementById('game');
const playerNameInput = document.getElementById('playerName');
const joinBtn = document.getElementById('joinBtn');
const startBtn = document.getElementById('startBtn');
const lobbyStatus = document.getElementById('lobbyStatus');
const playerList = document.getElementById('playerList');
const gameBoard = document.getElementById('gameBoard');
const playersList = document.getElementById('playersList');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const buyPropertyBtn = document.getElementById('buyPropertyBtn');
const skipBuyBtn = document.getElementById('skipBuyBtn');
const gameMessage = document.getElementById('gameMessage');
const gameStatus = document.getElementById('gameStatus');
const diceDisplay = document.getElementById('diceDisplay');

// Join game
joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        socket.emit('joinGame', name);
        currentPlayerId = socket.id;
    }
});

// Start game
startBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

// Roll dice
rollDiceBtn.addEventListener('click', () => {
    socket.emit('rollDice');
});

// Buy property
buyPropertyBtn.addEventListener('click', () => {
    socket.emit('buyProperty');
});

// Skip buying
skipBuyBtn.addEventListener('click', () => {
    socket.emit('skipBuy');
});

// Socket event listeners
socket.on('gameState', (state) => {
    gameState = state;
    updateUI();
});

socket.on('diceRolled', (data) => {
    displayDice(data.dice);
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const space = gameState.board[currentPlayer.position];
    
    if (data.result.action === 'paidRent') {
        gameMessage.textContent = `${currentPlayer.name} pays $${data.result.rent} rent to ${data.result.owner}`;
    } else if (data.result.action === 'paidTax') {
        gameMessage.textContent = `${currentPlayer.name} pays $${data.result.amount} in taxes`;
    } else if (data.result.action === 'goToJail') {
        gameMessage.textContent = `${currentPlayer.name} goes to jail!`;
    } else if (data.result.action === 'passedGo') {
        gameMessage.textContent = `${currentPlayer.name} passed GO! Collect $200`;
    } else if (data.result.action === 'canBuy') {
        gameMessage.textContent = `${currentPlayer.name} landed on ${space.name}. Buy for $${space.price}?`;
    } else {
        gameMessage.textContent = `${currentPlayer.name} rolled ${data.total} (${data.dice[0]} + ${data.dice[1]})`;
    }
    
    updateUI();
});

socket.on('propertyBought', (data) => {
    gameMessage.textContent = `${data.playerId === currentPlayerId ? 'You' : 'Player'} bought ${data.propertyName} for $${data.price}`;
    updateUI();
});

socket.on('error', (message) => {
    gameMessage.textContent = `Error: ${message}`;
    console.error('Socket error:', message);
});

// Update UI based on game state
function updateUI() {
    if (!gameState) return;

    // Update lobby
    if (!gameState.gameStarted) {
        updateLobby();
        return;
    }

    // Show game screen
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';

    // Update board
    renderBoard();

    // Update players list
    updatePlayersList();

    // Update controls
    updateControls();

    // Update game status
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer) {
        gameStatus.textContent = `${currentPlayer.name}'s Turn`;
        gameStatus.style.color = currentPlayer.color;
    }
}

function updateLobby() {
    // Show lobby
    lobbyScreen.style.display = 'block';
    gameScreen.style.display = 'none';

    // Update player list
    playerList.innerHTML = '';
    gameState.players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'lobby-player';
        playerDiv.style.borderLeft = `4px solid ${player.color}`;
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-money">$${player.money}</span>
        `;
        playerList.appendChild(playerDiv);
    });

    // Show start button if 2+ players and not started
    if (gameState.players.length >= 2 && !gameState.gameStarted) {
        startBtn.style.display = 'block';
        lobbyStatus.textContent = `Waiting for players... (${gameState.players.length} joined)`;
    } else if (gameState.players.length < 2) {
        startBtn.style.display = 'none';
        lobbyStatus.textContent = `Need at least 2 players to start (${gameState.players.length}/2)`;
    } else {
        startBtn.style.display = 'none';
        lobbyStatus.textContent = 'Game in progress';
    }
}

function renderBoard() {
    gameBoard.innerHTML = '';
    
    // Create all 40 spaces in Monopoly board layout
    // Bottom row: 0-10 (left to right)
    for (let i = 0; i <= 10; i++) {
        createSpace(i, 10, 10 - i);
    }
    
    // Left column: 11-19 (bottom to top, excluding corner)
    for (let i = 11; i <= 19; i++) {
        createSpace(i, 10 - (i - 10), 0);
    }
    
    // Top row: 20-30 (right to left, excluding corner)
    for (let i = 20; i <= 30; i++) {
        createSpace(i, 0, i - 20);
    }
    
    // Right column: 31-39 (top to bottom, excluding corner)
    for (let i = 31; i <= 39; i++) {
        createSpace(i, i - 30, 10);
    }
    
    // Place player tokens
    gameState.players.forEach((player, playerIndex) => {
        const spaceDiv = gameBoard.querySelector(`.space-${player.position}`);
        if (spaceDiv) {
            const tokensContainer = spaceDiv.querySelector('.space-tokens');
            if (tokensContainer) {
                const token = document.createElement('div');
                token.className = 'player-token';
                token.style.backgroundColor = player.color;
                if (player.id === gameState.players[gameState.currentPlayerIndex].id) {
                    token.classList.add('current-player');
                }
                token.style.left = `${(playerIndex % 4) * 18}px`;
                token.style.top = `${Math.floor(playerIndex / 4) * 18}px`;
                token.title = player.name;
                tokensContainer.appendChild(token);
            }
        }
    });
}

function createSpace(spaceId, row, col) {
    const space = gameState.board[spaceId];
    if (!space) return;
    
    const spaceDiv = document.createElement('div');
    spaceDiv.className = `board-space space-${spaceId} ${space.type} ${space.color || ''}`;
    spaceDiv.style.gridRow = row + 1;
    spaceDiv.style.gridColumn = col + 1;
    
    // Check if property is owned
    const owner = space.owner ? gameState.players.find(p => p.id === space.owner) : null;
    const ownerColor = owner ? owner.color : null;
    
    spaceDiv.innerHTML = `
        <div class="space-content">
            ${space.color ? `<div class="color-bar" style="background-color: ${getColorHex(space.color)}"></div>` : ''}
            ${ownerColor ? `<div class="owner-indicator" style="background-color: ${ownerColor}"></div>` : ''}
            <div class="space-name">${space.name}</div>
            ${space.price > 0 ? `<div class="space-price">$${space.price}</div>` : ''}
            ${space.amount ? `<div class="space-price">$${space.amount}</div>` : ''}
        </div>
        <div class="space-tokens"></div>
    `;
    gameBoard.appendChild(spaceDiv);
}

function updatePlayersList() {
    playersList.innerHTML = '';
    gameState.players.forEach((player) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        if (player.id === gameState.players[gameState.currentPlayerIndex].id) {
            playerDiv.classList.add('current-turn');
        }
        playerDiv.style.borderLeft = `4px solid ${player.color}`;
        playerDiv.innerHTML = `
            <div class="player-info">
                <span class="player-name">${player.name}</span>
                <span class="player-money">$${player.money}</span>
            </div>
            <div class="player-properties">
                Properties: ${player.properties.length}
            </div>
        `;
        playersList.appendChild(playerDiv);
    });
}

function updateControls() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayer && currentPlayer.id === socket.id;

    // Roll dice button
    rollDiceBtn.disabled = !isMyTurn || gameState.gamePhase !== 'rolling';
    
    // Buy property buttons
    if (gameState.gamePhase === 'buying' && isMyTurn) {
        const space = gameState.board[currentPlayer.position];
        buyPropertyBtn.style.display = 'block';
        skipBuyBtn.style.display = 'block';
        buyPropertyBtn.textContent = `Buy ${space.name} ($${space.price})`;
        buyPropertyBtn.disabled = currentPlayer.money < space.price;
    } else {
        buyPropertyBtn.style.display = 'none';
        skipBuyBtn.style.display = 'none';
    }
}

function displayDice(dice) {
    diceDisplay.innerHTML = '';
    dice.forEach((value, index) => {
        const die = document.createElement('div');
        die.className = 'die';
        die.innerHTML = `<div class="die-face face-${value}">${getDiceDots(value)}</div>`;
        diceDisplay.appendChild(die);
    });
}

function getDiceDots(value) {
    const patterns = {
        1: '<span class="dot"></span>',
        2: '<span class="dot"></span><span class="dot"></span>',
        3: '<span class="dot"></span><span class="dot"></span><span class="dot"></span>',
        4: '<span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>',
        5: '<span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>',
        6: '<span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>'
    };
    return patterns[value] || '';
}

function getColorHex(color) {
    const colors = {
        brown: '#8B4513',
        lightblue: '#87CEEB',
        pink: '#FF69B4',
        orange: '#FFA500',
        red: '#FF0000',
        yellow: '#FFD700',
        green: '#228B22',
        darkblue: '#00008B'
    };
    return colors[color] || '#CCC';
}

// Allow Enter key to join
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

