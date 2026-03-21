// Socket.io connection
const socket = io();

let gameState = null;
let currentPlayerId = null;
let myPlayerId = null; // Track which player is "me" by player ID, not socket ID
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
const proposeTradeBtn = document.getElementById('proposeTradeBtn');
const payJailFineBtn = document.getElementById('payJailFineBtn');
const useJailCardBtn = document.getElementById('useJailCardBtn');
const gameMessage = document.getElementById('gameMessage');
const gameStatus = document.getElementById('gameStatus');
const controlsTurnStatus = document.getElementById('controlsTurnStatus');
const diceDisplay = document.getElementById('diceDisplay');
const buildingControls = document.getElementById('buildingControls');
const howToPlayToggle = document.getElementById('howToPlayToggle');
const howToPlayContent = document.getElementById('howToPlayContent');

// Trade Modal elements
const tradeModal = document.getElementById('tradeModal');
const tradeModalClose = document.getElementById('tradeModalClose');
const tradeTarget = document.getElementById('tradeTarget');
const offerMoney = document.getElementById('offerMoney');
const offerProperties = document.getElementById('offerProperties');
const requestMoney = document.getElementById('requestMoney');
const requestProperties = document.getElementById('requestProperties');
const tradeSubmitBtn = document.getElementById('tradeSubmitBtn');
const tradeCancelBtn = document.getElementById('tradeCancelBtn');

// Trade Response Modal elements
const tradeResponseModal = document.getElementById('tradeResponseModal');
const tradeProposalContent = document.getElementById('tradeProposalContent');
const respondAsPlayer = document.getElementById('respondAsPlayer');
const tradeAcceptBtn = document.getElementById('tradeAcceptBtn');
const tradeRejectBtn = document.getElementById('tradeRejectBtn');

let pendingTradeId = null;
let pendingTradeTargetId = null;

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
    const isMyTurn = currentPlayer && currentPlayer.socketId === socket.id;

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

// Propose trade button - open modal
if (proposeTradeBtn) {
    proposeTradeBtn.addEventListener('click', () => {
        if (!gameState) return alert('No game in progress');

        const others = gameState.players.filter(p => p.id !== myPlayerId);
        if (others.length === 0) return alert('No other players to trade with');

        // Populate player dropdown
        tradeTarget.innerHTML = '<option value="">Select a player</option>';
        others.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            tradeTarget.appendChild(option);
        });

        // Clear form
        offerMoney.value = '0';
        requestMoney.value = '0';
        offerProperties.innerHTML = '';
        requestProperties.innerHTML = '';

        // Show modal
        tradeModal.style.display = 'flex';
    });
}

// Modal close handlers
tradeModalClose.addEventListener('click', () => {
    tradeModal.style.display = 'none';
});

tradeCancelBtn.addEventListener('click', () => {
    tradeModal.style.display = 'none';
});

// Close modal when clicking outside of it
tradeModal.addEventListener('click', (e) => {
    if (e.target === tradeModal) {
        tradeModal.style.display = 'none';
    }
});

// When target player changes, populate available properties
tradeTarget.addEventListener('change', () => {
    const targetId = tradeTarget.value;
    if (!targetId) {
        offerProperties.innerHTML = '';
        requestProperties.innerHTML = '';
        return;
    }

    const me = gameState.players.find(p => p.id === myPlayerId);
    const target = gameState.players.find(p => p.id === targetId);

    // Populate my properties (offer)
    offerProperties.innerHTML = '';
    if (me && me.properties && me.properties.length > 0) {
        me.properties.forEach(propId => {
            const prop = gameState.board[propId];
            const label = document.createElement('label');
            label.className = 'property-checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = propId;
            checkbox.dataset.player = 'me';
            const text = document.createElement('span');
            text.textContent = prop.name;
            label.appendChild(checkbox);
            label.appendChild(text);
            offerProperties.appendChild(label);
        });
    } else {
        offerProperties.innerHTML = '<div style="color: #999; font-size: 12px;">No properties owned</div>';
    }

    // Populate target properties (request)
    requestProperties.innerHTML = '';
    if (target && target.properties && target.properties.length > 0) {
        target.properties.forEach(propId => {
            const prop = gameState.board[propId];
            const label = document.createElement('label');
            label.className = 'property-checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = propId;
            checkbox.dataset.player = 'target';
            const text = document.createElement('span');
            text.textContent = prop.name;
            label.appendChild(checkbox);
            label.appendChild(text);
            requestProperties.appendChild(label);
        });
    } else {
        requestProperties.innerHTML = '<div style="color: #999; font-size: 12px;">No properties owned</div>';
    }
});

// Submit trade
tradeSubmitBtn.addEventListener('click', () => {
    const targetId = tradeTarget.value;
    if (!targetId) return alert('Please select a player');

    const offerMonetyVal = Number(offerMoney.value) || 0;
    const requestMoneyVal = Number(requestMoney.value) || 0;

    const offerPropsChecked = Array.from(offerProperties.querySelectorAll('input:checked')).map(c => Number(c.value));
    const requestPropsChecked = Array.from(requestProperties.querySelectorAll('input:checked')).map(c => Number(c.value));

    socket.emit('proposeTrade', {
        toPlayerId: targetId,
        offer: { money: offerMonetyVal, properties: offerPropsChecked },
        request: { money: requestMoneyVal, properties: requestPropsChecked }
    });

    tradeModal.style.display = 'none';
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

// Socket event listeners
socket.on('gameState', (state) => {
    gameState = state;
    
    // Set myPlayerId when we first see a player with our socketId
    if (!myPlayerId && gameState.players) {
        const mePlayer = gameState.players.find(p => p.socketId === currentPlayerId);
        if (mePlayer) {
            myPlayerId = mePlayer.id;
        }
    }
    
    updateUI();
});

socket.on('diceRolled', (data) => {
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

// Trade-related socket handlers
socket.on('tradeProposed', (data) => {
    const trade = data.trade;
    const fromName = data.from?.name || 'Someone';
    
    pendingTradeId = trade.id;
    pendingTradeTargetId = trade.toId;

    // Build content HTML
    let offerPropsHtml = 'None';
    if (trade.offer.properties && trade.offer.properties.length > 0) {
        offerPropsHtml = trade.offer.properties
            .map(pid => gameState.board[pid]?.name || `Property #${pid}`)
            .join(', ');
    }

    let requestPropsHtml = 'None';
    if (trade.request.properties && trade.request.properties.length > 0) {
        requestPropsHtml = trade.request.properties
            .map(pid => gameState.board[pid]?.name || `Property #${pid}`)
            .join(', ');
    }

    tradeProposalContent.innerHTML = `
        <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid #ff9800;">
            <strong style="color: #ff9800;">⚠️ To respond to this trade, select your player below (for local testing)</strong>
        </div>
        <strong>${fromName}</strong> is proposing a trade:<br><br>
        <div style="margin-left: 10px; border-left: 3px solid #667eea; padding-left: 10px;">
            <strong style="color: #667eea;">They offer:</strong><br>
            $${trade.offer.money} and properties: ${offerPropsHtml}<br><br>
            <strong style="color: #667eea;">They request:</strong><br>
            $${trade.request.money} and properties: ${requestPropsHtml}
        </div>
    `;

    // Populate player dropdown
    respondAsPlayer.innerHTML = '<option value="">Select player to respond</option>';
    gameState.players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        respondAsPlayer.appendChild(option);
    });

    tradeResponseModal.style.display = 'flex';
});


socket.on('tradeProposalSent', (data) => {
    gameMessage.textContent = 'Trade proposal sent.';
});

// Trade response modal handlers
tradeAcceptBtn.addEventListener('click', () => {
    if (!pendingTradeId) return;
    const selectedPlayerId = respondAsPlayer.value;
    if (!selectedPlayerId) return alert('Please select a player to respond as');
    
    socket.emit('respondTrade', { tradeId: pendingTradeId, accept: true, respondAsId: selectedPlayerId });
    tradeResponseModal.style.display = 'none';
    pendingTradeId = null;
    pendingTradeTargetId = null;
});

tradeRejectBtn.addEventListener('click', () => {
    if (!pendingTradeId) return;
    const selectedPlayerId = respondAsPlayer.value;
    if (!selectedPlayerId) return alert('Please select a player to respond as');
    
    socket.emit('respondTrade', { tradeId: pendingTradeId, accept: false, respondAsId: selectedPlayerId });
    tradeResponseModal.style.display = 'none';
    pendingTradeId = null;
    pendingTradeTargetId = null;
});


socket.on('tradeExecuted', (data) => {
    gameMessage.textContent = 'Trade executed.';
    updateUI();
});

socket.on('tradeDeclined', (data) => {
    gameMessage.textContent = 'Trade declined.';
});

socket.on('tradeError', (msg) => {
    gameMessage.textContent = `Trade error: ${msg}`;
    console.error('Trade error:', msg);
});

socket.on('tradeNotification', (data) => {
    gameMessage.textContent = data.message || 'Trade update';
    updateUI();
});

socket.on('buildingBought', (data) => {
    if (data.buildingType === 'hotel') {
        gameMessage.textContent = `${data.playerName} bought a hotel on ${data.propertyName} for $${data.cost}`;
    } else {
        gameMessage.textContent = `${data.playerName} bought a house on ${data.propertyName} for $${data.cost}`;
    }
    updateUI();
});

// Log unhandled promise rejections to help debug extension vs app issues
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason, e);
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
        playerDiv.innerHTML = `
            <span class="player-name" title="${propertyTooltip}">${player.name}</span>
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
        ${renderBuildingMarkers(space)}
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
    const isMyTurn = currentPlayer && currentPlayer.socketId === socket.id;

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
        rollDiceBtn.classList.add('flashing');
        buyPropertyBtn.style.display = 'none';
        skipBuyBtn.style.display = 'none';
    } else {
        rollDiceBtn.classList.remove('flashing');
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

    updateBuildingControls(currentPlayer, isMyTurn);
}

function updateBuildingControls(currentPlayer, isMyTurn) {
    if (!buildingControls) return;

    buildingControls.innerHTML = '';

    if (!currentPlayer || !isMyTurn) return;

    if (!['rolling', 'buying'].includes(gameState.gamePhase)) return;

    const ownedBuildableProperties = currentPlayer.properties
        .map(propertyId => gameState.board[propertyId])
        .filter(space => space && space.type === 'property' && space.color && space.houseCost);

    const eligibleSetProperties = ownedBuildableProperties.filter(space =>
        playerOwnsFullSetLocal(currentPlayer, space.color)
    );

    if (eligibleSetProperties.length === 0) return;

    const title = document.createElement('div');
    title.className = 'building-controls-title';
    title.textContent = 'Buy Houses / Hotels';
    buildingControls.appendChild(title);

    eligibleSetProperties.forEach(space => {
        const row = document.createElement('div');
        row.className = 'building-row';

        const currentCount = space.hotel ? 'Hotel' : `${space.houses || 0} house(s)`;
        const nextLabel = space.hotel
            ? 'Maxed'
            : ((space.houses || 0) < 4 ? 'Buy House' : 'Buy Hotel');

        const info = document.createElement('span');
        info.textContent = `${space.name} — ${currentCount}`;

        const button = document.createElement('button');
        button.textContent = `${nextLabel} ($${space.houseCost})`;
        button.disabled = !canBuildOnPropertyLocal(currentPlayer, space.id);

        button.addEventListener('click', () => {
            socket.emit('buyBuilding', { propertyId: space.id });
        });

        row.appendChild(info);
        row.appendChild(button);
        buildingControls.appendChild(row);
    });
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

//purpose: check if play owns all of a color group to let them buy houses and hotels
function playerOwnsFullSetLocal(player, color) {
    const groups = {
        brown: [1, 3],
        lightblue: [6, 8, 9],
        pink: [11, 13, 14],
        orange: [16, 18, 19],
        red: [21, 23, 24],
        yellow: [26, 27, 29],
        green: [31, 32, 34],
        darkblue: [37, 39]
    };

    const group = groups[color];
    if (!group) return false;
    return group.every(id => player.properties.includes(id));
}

function getLocalBuildingCount(space) {
    return space.hotel ? 5 : (space.houses || 0);
}

function canBuildOnPropertyLocal(player, propertyId) {
    const property = gameState.board[propertyId];
    if (!property || property.type !== 'property' || !property.color || !property.houseCost) {
        return false;
    }

    if (!player.properties.includes(propertyId)) {
        return false;
    }

    if (!playerOwnsFullSetLocal(player, property.color)) {
        return false;
    }

    if (property.hotel) {
        return false;
    }

    const groups = {
        brown: [1, 3],
        lightblue: [6, 8, 9],
        pink: [11, 13, 14],
        orange: [16, 18, 19],
        red: [21, 23, 24],
        yellow: [26, 27, 29],
        green: [31, 32, 34],
        darkblue: [37, 39]
    };

    const groupIds = groups[property.color] || [];
    const groupSpaces = groupIds.map(id => gameState.board[id]);

    const propertyCount = getLocalBuildingCount(property);
    const minCount = Math.min(...groupSpaces.map(getLocalBuildingCount));

    if (propertyCount > minCount) {
        return false;
    }

    return player.money >= property.houseCost;
}

function renderBuildingMarkers(space) {
    if (!space || space.type !== 'property') return '';

    if (space.hotel) {
        return `<div class="building-markers"><span class="hotel-marker">🏨</span></div>`;
    }

    const houses = space.houses || 0;
    if (houses <= 0) return '';

    return `
        <div class="building-markers">
            ${Array.from({ length: houses }).map(() => `<span class="house-marker">🏠</span>`).join('')}
        </div>
    `;
}

