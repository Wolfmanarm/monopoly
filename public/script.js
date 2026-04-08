// Socket.io connection
const socket = io();

let gameState = null;
let currentPlayerId = null;
let currentUser = null; // { id, username } when logged in, null otherwise
let hasLoggedOut = false; // true after explicit logout, prevents game screen from reappearing

// Track connection id when connected
socket.on('connect', () => {
    currentPlayerId = socket.id;
    console.log('Socket connected:', socket.id);
});

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
const payJailFineBtn = document.getElementById('payJailFineBtn');
const useJailCardBtn = document.getElementById('useJailCardBtn');
const gameMessage = document.getElementById('gameMessage');
const gameStatus = document.getElementById('gameStatus');
const controlsTurnStatus = document.getElementById('controlsTurnStatus');
const diceDisplay = document.getElementById('diceDisplay');
const howToPlayToggle = document.getElementById('howToPlayToggle');
const howToPlayContent = document.getElementById('howToPlayContent');
const saveGameBtn = document.getElementById('saveGameBtn');
const gameLogoutBtn = document.getElementById('gameLogoutBtn');
const saveGameMessage = document.getElementById('saveGameMessage');

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
    if (!gameState) return;

    const currentPlayer = gameState.players?.[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayer && (gameState.freePlay || currentPlayer.socketId === socket.id);

    if (gameState.gamePhase === 'payingRent' && isMyTurn && gameState.pendingRent && currentPlayer && gameState.pendingRent.payerId === currentPlayer.id) {
        console.log('Pay Rent clicked via roll button — emitting payRent');
        socket.emit('payRent');
        rollDiceBtn.disabled = true;
        gameMessage.textContent = 'Paying rent...';
        return;
    }

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

// How to Play toggle
if (howToPlayToggle && howToPlayContent) {
    howToPlayToggle.addEventListener('click', () => {
        const isHidden = howToPlayContent.style.display === 'none' || howToPlayContent.style.display === '';
        howToPlayContent.style.display = isHidden ? 'block' : 'none';
    });
}

payJailFineBtn.addEventListener('click', () => {
    socket.emit('payJailFine');
});

useJailCardBtn.addEventListener('click', () => {
    socket.emit('useGetOutOfJailCard');
});
//send chat
function sendChat() {
  const input = document.getElementById('chatInput');
  socket.emit('sendMessage', input.value);
  input.value = '';
}
//message send
socket.on('chatMessage', (data) => {
  const box = document.getElementById('chatBox');
  box.innerHTML += `<div><b>${data.player}:</b> ${data.message}</div>`;
  box.scrollTop = box.scrollHeight;
});
// ── Auth UI ──────────────────────────────────────────────────────────────────

const authForms = document.getElementById('authForms');
const loggedInSection = document.getElementById('loggedInSection');
const loggedInName = document.getElementById('loggedInName');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const showLoginTab = document.getElementById('showLoginTab');
const showRegisterTab = document.getElementById('showRegisterTab');
const authMessage = document.getElementById('authMessage');
const savedGamesList = document.getElementById('savedGamesList');

function showAuthMessage(msg, isError) {
    authMessage.textContent = msg;
    authMessage.style.color = isError ? '#c0392b' : '#27ae60';
}

function setLoggedIn(user) {
    hasLoggedOut = false;
    currentUser = user;
    authForms.style.display = 'none';
    loggedInSection.style.display = 'block';
    loggedInName.textContent = user.username;
    if (saveGameBtn) saveGameBtn.style.display = 'block';
    if (gameLogoutBtn) gameLogoutBtn.style.display = 'block';
    loadSavedGames();
}

function setLoggedOut() {
    hasLoggedOut = true;
    currentUser = null;
    authForms.style.display = 'block';
    loggedInSection.style.display = 'none';
    if (saveGameBtn) saveGameBtn.style.display = 'none';
    if (gameLogoutBtn) gameLogoutBtn.style.display = 'none';
    if (savedGamesList) savedGamesList.innerHTML = '';
    lobbyScreen.style.display = 'block';
    gameScreen.style.display = 'none';
}

// Check if already logged in on page load
fetch('/api/me')
    .then(r => r.ok ? r.json() : null)
    .then(user => { if (user) setLoggedIn(user); })
    .catch(() => {});

// Tab switching
showLoginTab.addEventListener('click', () => {
    loginTab.style.display = 'block';
    registerTab.style.display = 'none';
    showLoginTab.classList.add('auth-tab-active');
    showRegisterTab.classList.remove('auth-tab-active');
    authMessage.textContent = '';
});

showRegisterTab.addEventListener('click', () => {
    loginTab.style.display = 'none';
    registerTab.style.display = 'block';
    showRegisterTab.classList.add('auth-tab-active');
    showLoginTab.classList.remove('auth-tab-active');
    authMessage.textContent = '';
});

// Login
document.getElementById('loginBtn').addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { showAuthMessage('Enter username and password', true); return; }
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { showAuthMessage(data.error, true); return; }
        setLoggedIn(data);
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    } catch { showAuthMessage('Login failed', true); }
});

// Register
document.getElementById('registerBtn').addEventListener('click', async () => {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!username || !password) { showAuthMessage('Enter username and password', true); return; }
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { showAuthMessage(data.error, true); return; }
        setLoggedIn(data);
        document.getElementById('regUsername').value = '';
        document.getElementById('regPassword').value = '';
    } catch { showAuthMessage('Registration failed', true); }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    setLoggedOut();
});

// Game screen logout button
if (gameLogoutBtn) {
    gameLogoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        setLoggedOut();
    });
}

// Refresh saves button
document.getElementById('refreshSavesBtn').addEventListener('click', loadSavedGames);

async function loadSavedGames() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/saved-games');
        if (!res.ok) return;
        const saves = await res.json();
        savedGamesList.innerHTML = '';
        if (saves.length === 0) {
            savedGamesList.innerHTML = '<div class="no-saves">No saved games yet.</div>';
            return;
        }
        saves.forEach(save => {
            const date = new Date(save.saved_at).toLocaleString();
            const item = document.createElement('div');
            item.className = 'saved-game-item';
            item.innerHTML = `
                <span class="save-name">${save.name}</span>
                <span class="save-date">${date}</span>
                <div class="save-actions">
                    <button class="auth-btn-small load-save-btn" data-id="${save.id}" data-name="${save.name}">Load</button>
                    <button class="auth-btn-small delete-save-btn" data-id="${save.id}">Delete</button>
                </div>
            `;
            savedGamesList.appendChild(item);
        });

        savedGamesList.querySelectorAll('.load-save-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm(`Load "${btn.dataset.name}"? This will replace the current game for all players.`)) return;
                try {
                    const res = await fetch('/api/load-game', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ saveId: Number(btn.dataset.id) })
                    });
                    const data = await res.json();
                    if (!res.ok) { alert(data.error); return; }
                } catch { alert('Failed to load game'); }
            });
        });

        savedGamesList.querySelectorAll('.delete-save-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this save?')) return;
                try {
                    const res = await fetch(`/api/saved-games/${btn.dataset.id}`, { method: 'DELETE' });
                    if (res.ok) loadSavedGames();
                } catch { alert('Failed to delete save'); }
            });
        });
    } catch { /* ignore */ }
}

// ── Save Game ────────────────────────────────────────────────────────────────

if (saveGameBtn) {
    saveGameBtn.addEventListener('click', async () => {
        if (!currentUser) {
            saveGameMessage.textContent = 'You must be logged in to save.';
            saveGameMessage.style.color = '#c0392b';
            return;
        }
        const name = prompt('Enter a name for this save:');
        if (!name || !name.trim()) return;
        try {
            const res = await fetch('/api/save-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            const data = await res.json();
            if (!res.ok) {
                saveGameMessage.textContent = data.error;
                saveGameMessage.style.color = '#c0392b';
                return;
            }
            saveGameMessage.textContent = `Game saved as "${data.name}"!`;
            saveGameMessage.style.color = '#27ae60';
            setTimeout(() => { saveGameMessage.textContent = ''; }, 3000);
        } catch {
            saveGameMessage.textContent = 'Failed to save game.';
            saveGameMessage.style.color = '#c0392b';
        }
    });
}

// ── Socket event listeners ───────────────────────────────────────────────────
function showMoneyEffect(t) {
  console.log('💸 Transaction:', t);
}
// Socket event listeners
socket.on('gameState', (state) => {
    gameState = state;
    updateUI();

    const last = state.transactions?.slice(-1)[0];
    if (!last) return;

    showMoneyEffect(last);
});

// animation Rolled
function animateMove(playerId, steps) {
  let step = 0;

  const interval = setInterval(() => {
    moveTokenOneStep(playerId); // you already have token positioning
    step++;

    if (step >= steps) clearInterval(interval);
  }, 200);
}

socket.on('diceRolled', (data) => {
    animateMove(data.playerId, data.total);
    console.log('diceRolled event', data);
    displayDice(data.dice);
    const currentPlayer = gameState?.players?.find(player => player.id === data.playerId)
        || gameState?.players?.[gameState?.currentPlayerIndex];
    const space = currentPlayer ? gameState?.board?.[currentPlayer.position] : null;
    const playerName = data.playerName || currentPlayer?.name || 'Player';
    const spaceName = data.spaceName || data.result.propertyName || space?.name || 'this space';
    
    if (data.result.action === 'paidRent') {
        gameMessage.textContent = `${playerName} pays $${data.result.rent} rent to ${data.result.owner} for ${data.result.propertyName || spaceName}`;
    } else if (data.result.action === 'rentDue') {
        gameMessage.textContent = `${playerName} owes $${data.result.rent} rent to ${data.result.owner} for ${data.result.propertyName || spaceName}`;
    } else if (data.result.action === 'paidTax') {
        gameMessage.textContent = `${playerName} pays $${data.result.amount} in taxes`;
    } else if (data.result.action === 'goToJail') {
        gameMessage.textContent = `${playerName} goes to jail!`;
    } else if (data.result.action === 'goToJailByDoubles') {
        gameMessage.textContent = `${playerName} rolled three doubles in a row and goes to jail!`;
    } else if (data.result.action === 'jailStay') {
        gameMessage.textContent = `${playerName} did not roll doubles and stays in jail (${data.result.turnsRemaining} attempts left).`;
    } else if (data.result.action === 'jailThirdFailPaid') {
        gameMessage.textContent = `${playerName} failed their 3rd jail roll, paid $${data.result.amount}, and now moves normally.`;
    } else if (data.result.action === 'passedGo') {
        gameMessage.textContent = `${playerName} passed GO! Collect $200`;
    } else if (data.result.action === 'canBuy') {
        gameMessage.textContent = `${playerName} landed on ${spaceName}. Buy for $${space?.price || data.result.space?.price || 0}?`;
    } else if (data.result.action === 'chanceCard') {
        const movementText = data.result.newSpaceName ? ` Moved to ${data.result.newSpaceName}.` : '';
        const moneyText = typeof data.result.amount === 'number'
            ? ` ${data.result.amount >= 0 ? `Collect $${data.result.amount}` : `Pay $${Math.abs(data.result.amount)}`}.`
            : '';
        const cardText = data.result.cardGranted === 'getOutOfJail' ? ' Received a Get Out of Jail Free card.' : '';
        let followUpText = '';
        if (data.postCardResult?.action === 'canBuy') {
            const followUpSpace = data.postCardResult.space?.name || data.finalSpaceName || 'this property';
            const followUpPrice = data.postCardResult.space?.price || 0;
            followUpText = ` ${playerName} can buy ${followUpSpace} for $${followUpPrice}.`;
        } else if (data.postCardResult?.action === 'rentDue') {
            followUpText = ` ${playerName} owes $${data.postCardResult.rent} rent to ${data.postCardResult.owner} for ${data.postCardResult.propertyName}.`;
        }
        gameMessage.textContent = `${playerName} drew Chance: ${data.result.cardText}.${movementText}${moneyText}${cardText}${followUpText}`;
    } else if (data.result.action === 'chestCard') {
        const movementText = data.result.newSpaceName ? ` Moved to ${data.result.newSpaceName}.` : '';
        const moneyText = typeof data.result.amount === 'number'
            ? ` ${data.result.amount >= 0 ? `Collect $${data.result.amount}` : `Pay $${Math.abs(data.result.amount)}`}.`
            : '';
        const cardText = data.result.cardGranted === 'getOutOfJail' ? ' Received a Get Out of Jail Free card.' : '';
        let followUpText = '';
        if (data.postCardResult?.action === 'canBuy') {
            const followUpSpace = data.postCardResult.space?.name || data.finalSpaceName || 'this property';
            const followUpPrice = data.postCardResult.space?.price || 0;
            followUpText = ` ${playerName} can buy ${followUpSpace} for $${followUpPrice}.`;
        } else if (data.postCardResult?.action === 'rentDue') {
            followUpText = ` ${playerName} owes $${data.postCardResult.rent} rent to ${data.postCardResult.owner} for ${data.postCardResult.propertyName}.`;
        }
        gameMessage.textContent = `${playerName} drew Community Chest: ${data.result.cardText}.${movementText}${moneyText}${cardText}${followUpText}`;
    } else {
        gameMessage.textContent = `${playerName} rolled ${data.total} (${data.dice[0]} + ${data.dice[1]})`;
    }
    
    updateUI();

    
    
});

// Rent paid event from server
socket.on('rentPaid', (data) => {
    console.log('rentPaid event', data);
    gameMessage.textContent = `${data.payerName} paid $${data.rent} rent to ${data.ownerName} for ${data.propertyName}`;
    updateUI();
});

socket.on('propertyBought', (data) => {
    gameMessage.textContent = `${data.playerName || 'Player'} bought ${data.propertyName} for $${data.price}`;
    updateUI();
});

socket.on('jailFinePaid', (data) => {
    gameMessage.textContent = `${data.playerName} paid $${data.amount} to get out of jail and may roll now.`;
    updateUI();
});

socket.on('usedGetOutOfJailCard', (data) => {
    gameMessage.textContent = `${data.playerName} used a Get Out of Jail Free card.`;
    updateUI();
});

socket.on('error', (message) => {
    gameMessage.textContent = `Error: ${message}`;
    console.error('Socket error:', message);
});

// Log unhandled promise rejections to help debug extension vs app issues
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason, e);
});

// Update UI based on game state
function updateUI() {
    if (!gameState) return;

    // Show lobby if game hasn't started, or if this socket hasn't reconnected to a
    // player slot yet (e.g. after a saved game is loaded and socketIds are cleared)
    const myPlayer = gameState.players.find(p => p.socketId === socket.id);
    if (!gameState.gameStarted || (!myPlayer && !gameState.freePlay)) {
        updateLobby();
        return;
    }

    // Show game screen
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';

    // Show save/logout buttons only if logged in
    if (saveGameBtn) saveGameBtn.style.display = currentUser ? 'block' : 'none';
    if (gameLogoutBtn) gameLogoutBtn.style.display = currentUser ? 'block' : 'none';

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
        controlsTurnStatus.textContent = `${currentPlayer.name}'s Turn`;
        controlsTurnStatus.style.color = currentPlayer.color;
    }
}

function updateLobby() {
    // Show lobby
    lobbyScreen.style.display = 'block';
    gameScreen.style.display = 'none';

    // Update player list
    playerList.innerHTML = '';
    gameState.players.forEach((player, index) => {
        const propertyTooltip = getPlayerPropertiesTooltip(player);
        const playerDiv = document.createElement('div');
        playerDiv.className = 'lobby-player';
        playerDiv.style.borderLeft = `4px solid ${player.color}`;
        const isMe = player.socketId === socket.id;
        playerDiv.innerHTML = `
            <span class="player-name" title="${propertyTooltip}">${player.name}</span>
            <span class="player-money">$${player.money}</span>
            ${isMe ? `<button class="remove-player-btn" data-id="${player.id}">Leave</button>` : ''}
        `;
        playerList.appendChild(playerDiv);
    });

    playerList.querySelectorAll('.remove-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            socket.emit('removePlayer', btn.dataset.id);
        });
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
        const reconnected = gameState.players.filter(p => p.socketId).length;
        const total = gameState.players.length;
        lobbyStatus.textContent = reconnected < total
            ? `Saved game loaded — enter your saved name to rejoin (${reconnected}/${total} reconnected)`
            : 'Game in progress';
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
    
    // Check if property is owned.
    // Primary source: players' owned property lists (most reliable for rendering owner colors).
    let owner = gameState.players.find(player =>
        Array.isArray(player.properties) && player.properties.includes(space.id)
    ) || null;

    // Fallback source: board owner field.
    if (!owner && space.owner) {
        owner = gameState.players.find(p => String(p.id) === String(space.owner)) || null;
        if (!owner) {
            const maybeIndex = Number(space.owner);
            if (Number.isInteger(maybeIndex) && maybeIndex >= 0 && maybeIndex < gameState.players.length) {
                owner = gameState.players[maybeIndex];
            } else {
                console.debug(`Owner id ${space.owner} not found among players`);
            }
        }
    }
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
        const ownedProperties = getPlayerPropertyNames(player);
        const propertyRows = ownedProperties.length > 0
            ? ownedProperties.map(propertyName => `<div class="player-tooltip-item">${propertyName}</div>`).join('')
            : '<div class="player-tooltip-item">None</div>';
        const tooltipContent = `<div class="player-tooltip-title">Properties Owned:</div>${propertyRows}`;
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
            <div class="player-properties player-properties-hover">
                Properties: ${player.properties.length}
                <span class="player-properties-tooltip">${tooltipContent}</span>
            </div>
        `;
        playersList.appendChild(playerDiv);
    });
}

function updateControls() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isMyTurn = currentPlayer && (gameState.freePlay || currentPlayer.socketId === socket.id);

    // Default roll dice button state
    rollDiceBtn.textContent = 'Roll Dice';
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

    // Rent payment uses the roll button as a context action
    if (gameState.gamePhase === 'payingRent' && gameState.pendingRent) {
        const isPayer = isMyTurn && currentPlayer && gameState.pendingRent.payerId === currentPlayer.id;
        rollDiceBtn.textContent = `Pay Rent: $${gameState.pendingRent.rent}`;
        rollDiceBtn.disabled = !isPayer;
        buyPropertyBtn.style.display = 'none';
        skipBuyBtn.style.display = 'none';
    }

    // Jail controls
    payJailFineBtn.style.display = 'none';
    useJailCardBtn.style.display = 'none';
    if (gameState.gamePhase === 'rolling' && isMyTurn && currentPlayer?.inJail) {
        rollDiceBtn.textContent = 'Roll for Doubles (Jail)';
        payJailFineBtn.style.display = currentPlayer.hasPaidJailFine ? 'none' : 'block';
        payJailFineBtn.disabled = !!currentPlayer.hasPaidJailFine;
        useJailCardBtn.style.display = currentPlayer.getOutOfJailCards > 0 ? 'block' : 'none';
        useJailCardBtn.disabled = currentPlayer.getOutOfJailCards <= 0;
    }

    // Legacy dedicated pay-rent button is hidden (rent now uses roll button)
    const payRentBtn = document.getElementById('payRentBtn');
    if (payRentBtn) {
        payRentBtn.style.display = 'none';
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

//Purpose: Helper function to get player properties
//Input: player
//Output: The player's properties as a string
function getPlayerPropertiesTooltip(player){
    const ownedPropertyNames = getPlayerPropertyNames(player);
    if(ownedPropertyNames.length === 0){
        return 'Properties: None';
    }

    return `Properties: ${ownedPropertyNames.join(', ')}`;
}

function getPlayerPropertyNames(player) {
    return player.properties
        .map(propertyID => gameState.board[propertyID]?.name)
        .filter(Boolean);
}

