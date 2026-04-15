// Socket.io connection
const socket = io();

let gameState = null;
let currentPlayerId = null;
let myPlayerId = null;
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
const payRentBtn = document.getElementById('payRentBtn');
const buyPropertyBtn = document.getElementById('buyPropertyBtn');
const skipBuyBtn = document.getElementById('skipBuyBtn');
let proposeTradeBtn = document.getElementById('proposeTradeBtn');
const payJailFineBtn = document.getElementById('payJailFineBtn');
const useJailCardBtn = document.getElementById('useJailCardBtn');
const gameMessage = document.getElementById('gameMessage');
const gameStatus = document.getElementById('gameStatus');
const controlsTurnStatus = document.getElementById('controlsTurnStatus');
const diceDisplay = document.getElementById('diceDisplay');
const buildingControls = document.getElementById('buildingControls');
const howToPlayToggle = document.getElementById('howToPlayToggle');
const howToPlayContent = document.getElementById('howToPlayContent');
let lobbyTutorialBtn = document.getElementById('lobbyTutorialBtn');
let gameTutorialBtn = document.getElementById('gameTutorialBtn');
const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialCard = document.getElementById('tutorialCard');
const tutorialStepCounter = document.getElementById('tutorialStepCounter');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialText = document.getElementById('tutorialText');
const tutorialPrevBtn = document.getElementById('tutorialPrevBtn');
const tutorialNextBtn = document.getElementById('tutorialNextBtn');
const tutorialCloseBtn = document.getElementById('tutorialCloseBtn');
const saveGameBtn = document.getElementById('saveGameBtn');
const gameLogoutBtn = document.getElementById('gameLogoutBtn');
const saveGameMessage = document.getElementById('saveGameMessage');
const accountStatus = document.getElementById('accountStatus');
const accountQuickAuth = document.getElementById('accountQuickAuth');
const accountUsername = document.getElementById('accountUsername');
const accountPassword = document.getElementById('accountPassword');
const accountLoginBtn = document.getElementById('accountLoginBtn');
const accountRegisterBtn = document.getElementById('accountRegisterBtn');
const accountAuthMessage = document.getElementById('accountAuthMessage');
const strategyAdvisorTarget = document.getElementById('strategyAdvisorTarget');
const strategyAdvisorList = document.getElementById('strategyAdvisorList');

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

// Trade response modal elements
const tradeResponseModal = document.getElementById('tradeResponseModal');
const tradeProposalContent = document.getElementById('tradeProposalContent');
const respondAsPlayer = document.getElementById('respondAsPlayer');
const tradeAcceptBtn = document.getElementById('tradeAcceptBtn');
const tradeRejectBtn = document.getElementById('tradeRejectBtn');

let pendingTradeId = null;
let tutorialSteps = [];
let tutorialIndex = 0;
let tutorialActive = false;
let tradeHandlersBound = false;
const tokenElementsByPlayerId = new Map();
const previousPlayerPositions = new Map();
const tokenAnimationChains = new Map();

const TRADE_REQUIRED_IDS = [
    'tradeModal',
    'tradeModalClose',
    'tradeTarget',
    'offerMoney',
    'offerProperties',
    'requestMoney',
    'requestProperties',
    'tradeSubmitBtn',
    'tradeCancelBtn',
    'tradeResponseModal',
    'tradeProposalContent',
    'respondAsPlayer',
    'tradeAcceptBtn',
    'tradeRejectBtn'
];

function ensureTradeAndTutorialContainers() {
    const gameEl = document.getElementById('game');
    const hasAllTradeNodes = TRADE_REQUIRED_IDS.every((id) => !!document.getElementById(id));
    if (gameEl && !hasAllTradeNodes) {
        const oldTradeModal = document.getElementById('tradeModal');
        const oldTradeResponseModal = document.getElementById('tradeResponseModal');
        if (oldTradeModal) oldTradeModal.remove();
        if (oldTradeResponseModal) oldTradeResponseModal.remove();
        /*
        gameEl.insertAdjacentHTML('beforeend', `
        <div id="tradeModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Propose a Trade</h3>
                    <button id="tradeModalClose" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Trade With:</label>
                        <select id="tradeTarget"><option value="">Select a player</option></select>
                    </div>
                    <div class="trade-columns">
                        <div class="trade-column">
                            <h4>You Offer</h4>
                            <div class="form-group"><label>Money:</label><input type="number" id="offerMoney" min="0" value="0" placeholder="0"></div>
                            <div class="form-group"><label>Properties (select):</label><div id="offerProperties" class="property-list"></div></div>
                        </div>
                        <div class="trade-column">
                            <h4>You Request</h4>
                            <div class="form-group"><label>Money:</label><input type="number" id="requestMoney" min="0" value="0" placeholder="0"></div>
                            <div class="form-group"><label>Properties (select):</label><div id="requestProperties" class="property-list"></div></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="tradeSubmitBtn" class="action-btn">Send Proposal</button>
                    <button id="tradeCancelBtn" class="action-btn secondary">Cancel</button>
                </div>
            </div>
        </div>
        <div id="tradeResponseModal" class="modal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header"><h3>Trade Proposal</h3></div>
                <div class="modal-body">
                    <div id="tradeProposalContent" style="font-size: 16px; line-height: 1.6;"></div>
                    <div class="form-group" style="margin-top: 20px;">
                        <label>Respond as (local testing only):</label>
                        <select id="respondAsPlayer"><option value="">Select player</option></select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="tradeAcceptBtn" class="action-btn">Accept</button>
                    <button id="tradeRejectBtn" class="action-btn secondary">Decline</button>
                </div>
            </div>
        </div>`);*/

        tradeHandlersBound = false;
    }
   
}

function getTradeDom() {
    ensureTradeAndTutorialContainers();
    return {
        tradeModal: document.getElementById('tradeModal'),
        tradeModalClose: document.getElementById('tradeModalClose'),
        tradeTarget: document.getElementById('tradeTarget'),
        offerMoney: document.getElementById('offerMoney'),
        offerProperties: document.getElementById('offerProperties'),
        requestMoney: document.getElementById('requestMoney'),
        requestProperties: document.getElementById('requestProperties'),
        tradeSubmitBtn: document.getElementById('tradeSubmitBtn'),
        tradeCancelBtn: document.getElementById('tradeCancelBtn'),
        tradeResponseModal: document.getElementById('tradeResponseModal'),
        tradeProposalContent: document.getElementById('tradeProposalContent'),
        respondAsPlayer: document.getElementById('respondAsPlayer'),
    };
}

function ensureFeatureButtonsVisible() {
    if (!lobbyTutorialBtn) {
        const lobbyContainer = document.querySelector('#lobby .lobby-container');
        if (lobbyContainer) {
            const btn = document.createElement('button');
            btn.id = 'lobbyTutorialBtn';
            btn.className = 'start-btn';
            btn.style.marginTop = '10px';
            btn.textContent = 'Start Tutorial';
            lobbyContainer.appendChild(btn);
            lobbyTutorialBtn = btn;
        }
    }

    if (!proposeTradeBtn) {
        const controlsPanel = document.querySelector('.controls-panel');
        const anchor = document.getElementById('skipBuyBtn');
        if (controlsPanel) {
            const btn = document.createElement('button');
            btn.id = 'proposeTradeBtn';
            btn.className = 'action-btn';
            btn.textContent = 'Propose Trade';
            if (anchor && anchor.parentElement === controlsPanel) {
                anchor.insertAdjacentElement('afterend', btn);
            } else {
                controlsPanel.appendChild(btn);
            }
            proposeTradeBtn = btn;
        }
    }

    if (!gameTutorialBtn) {
        const howToPlayContainer = document.querySelector('.how-to-play-container');
        if (howToPlayContainer) {
            const btn = document.createElement('button');
            btn.id = 'gameTutorialBtn';
            btn.className = 'action-btn secondary how-to-play-button';
            btn.style.marginTop = '10px';
            btn.textContent = 'Guided Tutorial';
            const howToPlayContentEl = document.getElementById('howToPlayContent');
            if (howToPlayContentEl) {
                howToPlayContentEl.insertAdjacentElement('beforebegin', btn);
            } else {
                howToPlayContainer.appendChild(btn);
            }
            gameTutorialBtn = btn;
        }
    }

    if (lobbyTutorialBtn) lobbyTutorialBtn.style.display = 'inline-block';
    if (proposeTradeBtn) proposeTradeBtn.style.display = 'inline-block';
    if (gameTutorialBtn) gameTutorialBtn.style.display = 'block';

    // If any trade node was rebuilt, ensure handlers are present on the current DOM nodes.
    bindTradeHandlers();
}

ensureFeatureButtonsVisible();

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

if (payRentBtn) {
    payRentBtn.addEventListener('click', () => {
        if (!gameState || gameState.gamePhase !== 'payingRent' || !gameState.pendingRent) return;
        socket.emit('payRent');
        payRentBtn.disabled = true;
        gameMessage.textContent = 'Paying rent...';
    });
}

function openTradeModal() {
    const {
        tradeModal,
        tradeTarget,
        offerMoney,
        offerProperties,
        requestMoney,
        requestProperties,
    } = getTradeDom();

    if (!tradeModal || !tradeTarget || !offerMoney || !requestMoney || !offerProperties || !requestProperties) {
        if (gameMessage) gameMessage.textContent = 'Trade UI is missing. Please refresh the page.';
        return;
    }

    if (!gameState) {
        gameMessage.textContent = 'Join and start a game first.';
        return;
    }

    const others = gameState.players.filter(p => p.id !== myPlayerId);
    if (others.length === 0) {
        alert('No other players to trade with');
        return;
    }

    tradeTarget.innerHTML = '<option value="">Select a player</option>';
    others.forEach((player) => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        tradeTarget.appendChild(option);
    });

    offerMoney.value = '0';
    requestMoney.value = '0';
    offerProperties.innerHTML = '';
    requestProperties.innerHTML = '';
    tradeModal.style.display = 'flex';
}

function bindTradeHandlers() {
    if (tradeHandlersBound) return;
    const {
        tradeModal,
        tradeModalClose,
        tradeTarget,
        offerMoney,
        offerProperties,
        requestMoney,
        requestProperties,
        tradeSubmitBtn,
        tradeCancelBtn,
    } = getTradeDom();
    if (!tradeModal || !tradeTarget || !offerMoney || !requestMoney || !offerProperties || !requestProperties || !tradeSubmitBtn || !tradeCancelBtn) return;

    tradeHandlersBound = true;

    tradeModalClose?.addEventListener('click', () => {
        tradeModal.style.display = 'none';
    });

    tradeCancelBtn.addEventListener('click', () => {
        tradeModal.style.display = 'none';
    });

    tradeModal.addEventListener('click', (e) => {
        if (e.target === tradeModal) {
            tradeModal.style.display = 'none';
        }
    });

    tradeTarget.addEventListener('change', () => {
        const targetId = tradeTarget.value;
        if (!targetId) {
            offerProperties.innerHTML = '';
            requestProperties.innerHTML = '';
            return;
        }

        const me = gameState.players.find(p => p.id === myPlayerId);
        const target = gameState.players.find(p => p.id === targetId);

        offerProperties.innerHTML = '';
        if (me && Array.isArray(me.properties) && me.properties.length > 0) {
            me.properties.forEach((propId) => {
                const prop = gameState.board[propId];
                if (!prop) return;
                const label = document.createElement('label');
                label.className = 'property-checkbox';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = String(propId);
                const text = document.createElement('span');
                text.textContent = prop.name;
                label.appendChild(checkbox);
                label.appendChild(text);
                offerProperties.appendChild(label);
            });
        } else {
            offerProperties.innerHTML = '<div style="color: #999; font-size: 12px;">No properties owned</div>';
        }

        requestProperties.innerHTML = '';
        if (target && Array.isArray(target.properties) && target.properties.length > 0) {
            target.properties.forEach((propId) => {
                const prop = gameState.board[propId];
                if (!prop) return;
                const label = document.createElement('label');
                label.className = 'property-checkbox';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = String(propId);
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

    tradeSubmitBtn.addEventListener('click', () => {
        const targetId = tradeTarget.value;
        if (!targetId) {
            alert('Please select a player');
            return;
        }

        const offerMoneyVal = Number(offerMoney.value) || 0;
        const requestMoneyVal = Number(requestMoney.value) || 0;
        const offerPropsChecked = Array.from(offerProperties.querySelectorAll('input:checked')).map(c => Number(c.value));
        const requestPropsChecked = Array.from(requestProperties.querySelectorAll('input:checked')).map(c => Number(c.value));

        socket.emit('proposeTrade', {
            toPlayerId: targetId,
            offer: { money: offerMoneyVal, properties: offerPropsChecked },
            request: { money: requestMoneyVal, properties: requestPropsChecked }
        });

        tradeModal.style.display = 'none';
    });
}

bindTradeHandlers();

document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const clickedTradeBtn = target.closest('#proposeTradeBtn');
    if (clickedTradeBtn) {
        e.preventDefault();
        bindTradeHandlers();
        openTradeModal();
        return;
    }

    const clickedTutorialBtn = target.closest('#lobbyTutorialBtn, #gameTutorialBtn');
    if (clickedTutorialBtn) {
        e.preventDefault();
        startTutorial();
        const overlay = document.getElementById('tutorialOverlay');
        if (!overlay || overlay.style.display === 'none') {
            if (gameMessage) {
                gameMessage.textContent = 'Tutorial could not open. Please refresh and try again.';
            }
        }
        return;
    }

    const clickedTradeRespond = target.closest('#tradeAcceptBtn, #tradeRejectBtn');
    if (clickedTradeRespond) {
        const { respondAsPlayer, tradeResponseModal } = getTradeDom();
        if (!pendingTradeId || !respondAsPlayer || !tradeResponseModal) return;
        const selectedPlayerId = respondAsPlayer.value;
        if (!selectedPlayerId) {
            alert('Please select a player to respond as');
            return;
        }
        const accept = clickedTradeRespond.id === 'tradeAcceptBtn';
        socket.emit('respondTrade', { tradeId: pendingTradeId, accept, respondAsId: selectedPlayerId });
        tradeResponseModal.style.display = 'none';
        pendingTradeId = null;
        return;
    }

    const clickedTutorialNav = target.closest('#tutorialPrevBtn, #tutorialNextBtn, #tutorialCloseBtn');
    if (clickedTutorialNav) {
        if (clickedTutorialNav.id === 'tutorialCloseBtn') {
            closeTutorial();
            return;
        }
        if (clickedTutorialNav.id === 'tutorialPrevBtn') {
            if (tutorialIndex > 0) {
                tutorialIndex -= 1;
                renderTutorialStep();
            }
            return;
        }
        if (clickedTutorialNav.id === 'tutorialNextBtn') {
            if (tutorialIndex >= tutorialSteps.length - 1) {
                closeTutorial();
            } else {
                tutorialIndex += 1;
                renderTutorialStep();
            }
        }
    }
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
    if (!authMessage) return;
    authMessage.textContent = msg;
    authMessage.style.color = isError ? '#c0392b' : '#27ae60';
}

function refreshAccountPanel() {
    const loggedIn = !!currentUser;
    if (saveGameBtn) saveGameBtn.style.display = loggedIn ? 'block' : 'none';
    if (gameLogoutBtn) gameLogoutBtn.style.display = loggedIn ? 'block' : 'none';
    if (accountQuickAuth) accountQuickAuth.style.display = loggedIn ? 'none' : 'flex';
    if (accountStatus) {
        accountStatus.textContent = loggedIn
            ? `Logged in as ${currentUser.username}`
            : 'Not logged in. Use the lobby to log in.';
    }
    if (loggedIn && accountAuthMessage) accountAuthMessage.textContent = '';
}

function showAccountAuthMessage(msg, isError = false) {
    if (!accountAuthMessage) return;
    accountAuthMessage.textContent = msg;
    accountAuthMessage.style.color = isError ? '#c0392b' : '#27ae60';
}

async function submitAccountAuth(mode) {
    const username = accountUsername?.value?.trim();
    const password = accountPassword?.value || '';
    if (!username || !password) {
        showAccountAuthMessage('Enter username and password', true);
        return;
    }

    const endpoint = mode === 'register' ? '/api/register' : '/api/login';
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            showAccountAuthMessage(data.error || 'Authentication failed', true);
            return;
        }

        setLoggedIn(data);
        if (accountUsername) accountUsername.value = '';
        if (accountPassword) accountPassword.value = '';
    } catch {
        showAccountAuthMessage('Authentication failed', true);
    }
}

function setLoggedIn(user) {
    hasLoggedOut = false;
    currentUser = user;
    if (authForms) authForms.style.display = 'none';
    if (loggedInSection) loggedInSection.style.display = 'block';
    if (loggedInName) loggedInName.textContent = user.username;
    refreshAccountPanel();
    loadSavedGames();
}

function setLoggedOut() {
    hasLoggedOut = true;
    currentUser = null;
    if (authForms) authForms.style.display = 'block';
    if (loggedInSection) loggedInSection.style.display = 'none';
    refreshAccountPanel();
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
if (showLoginTab && loginTab && registerTab && showRegisterTab) {
    showLoginTab.addEventListener('click', () => {
        loginTab.style.display = 'block';
        registerTab.style.display = 'none';
        showLoginTab.classList.add('auth-tab-active');
        showRegisterTab.classList.remove('auth-tab-active');
        if (authMessage) authMessage.textContent = '';
    });
}

if (showRegisterTab && loginTab && registerTab && showLoginTab) {
    showRegisterTab.addEventListener('click', () => {
        loginTab.style.display = 'none';
        registerTab.style.display = 'block';
        showRegisterTab.classList.add('auth-tab-active');
        showLoginTab.classList.remove('auth-tab-active');
        if (authMessage) authMessage.textContent = '';
    });
}

// Login
const loginBtn = document.getElementById('loginBtn');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
if (loginBtn && loginUsername && loginPassword) {
    loginBtn.addEventListener('click', async () => {
        const username = loginUsername.value.trim();
        const password = loginPassword.value;
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
            loginUsername.value = '';
            loginPassword.value = '';
        } catch { showAuthMessage('Login failed', true); }
    });
}

// Register
const registerBtn = document.getElementById('registerBtn');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');
if (registerBtn && regUsername && regPassword) {
    registerBtn.addEventListener('click', async () => {
        const username = regUsername.value.trim();
        const password = regPassword.value;
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
            regUsername.value = '';
            regPassword.value = '';
        } catch { showAuthMessage('Registration failed', true); }
    });
}

if (accountLoginBtn) {
    accountLoginBtn.addEventListener('click', () => submitAccountAuth('login'));
}

if (accountRegisterBtn) {
    accountRegisterBtn.addEventListener('click', () => submitAccountAuth('register'));
}

if (accountPassword) {
    accountPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitAccountAuth('login');
    });
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        setLoggedOut();
    });
}

// Game screen logout button
if (gameLogoutBtn) {
    gameLogoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        setLoggedOut();
    });
}

// Refresh saves button
const refreshSavesBtn = document.getElementById('refreshSavesBtn');
if (refreshSavesBtn) {
    refreshSavesBtn.addEventListener('click', loadSavedGames);
}

async function loadSavedGames() {
    if (!currentUser || !savedGamesList) return;
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
    const me = gameState?.players?.find(p => p.socketId === socket.id);
    if (me) myPlayerId = me.id;
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

socket.on('buildingBought', (data) => {
    const label = data.buildingType === 'hotel' ? 'a hotel' : 'a house';
    gameMessage.textContent = `${data.playerName} built ${label} on ${data.propertyName} for $${data.cost}`;
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
    const { tradeResponseModal, tradeProposalContent, respondAsPlayer } = getTradeDom();
    if (!tradeResponseModal || !tradeProposalContent || !respondAsPlayer) return;

    const trade = data.trade;
    const fromName = data.from?.name || 'Someone';

    pendingTradeId = trade.id;

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
        <strong>${fromName}</strong> is proposing a trade:<br><br>
        <div style="margin-left: 10px; border-left: 3px solid #667eea; padding-left: 10px;">
            <strong style="color: #667eea;">They offer:</strong><br>
            $${trade.offer.money} and properties: ${offerPropsHtml}<br><br>
            <strong style="color: #667eea;">They request:</strong><br>
            $${trade.request.money} and properties: ${requestPropsHtml}
        </div>
    `;

    respondAsPlayer.innerHTML = '<option value="">Select player to respond</option>';
    gameState.players.forEach((player) => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        if (player.id === myPlayerId) option.selected = true;
        respondAsPlayer.appendChild(option);
    });

    tradeResponseModal.style.display = 'flex';
});

socket.on('tradeProposalSent', () => {
    gameMessage.textContent = 'Trade proposal sent.';
});

if (tradeAcceptBtn && tradeRejectBtn && respondAsPlayer && tradeResponseModal) {
    tradeAcceptBtn.addEventListener('click', () => {
        if (!pendingTradeId) return;
        const selectedPlayerId = respondAsPlayer.value;
        if (!selectedPlayerId) {
            alert('Please select a player to respond as');
            return;
        }

        socket.emit('respondTrade', { tradeId: pendingTradeId, accept: true, respondAsId: selectedPlayerId });
        tradeResponseModal.style.display = 'none';
        pendingTradeId = null;
    });

    tradeRejectBtn.addEventListener('click', () => {
        if (!pendingTradeId) return;
        const selectedPlayerId = respondAsPlayer.value;
        if (!selectedPlayerId) {
            alert('Please select a player to respond as');
            return;
        }

        socket.emit('respondTrade', { tradeId: pendingTradeId, accept: false, respondAsId: selectedPlayerId });
        tradeResponseModal.style.display = 'none';
        pendingTradeId = null;
    });
}

socket.on('tradeExecuted', () => {
    gameMessage.textContent = 'Trade executed.';
    updateUI();
});

socket.on('tradeDeclined', () => {
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

socket.on('playerBankrupt', (data) => {
  if (data.creditorName) {
    gameMessage.textContent = `${data.playerName} went bankrupt and transferred all assets to ${data.creditorName}.`;
  } else {
    gameMessage.textContent = `${data.playerName} went bankrupt to the bank.`;
  }
  updateUI();
});

socket.on('gameOver', (data) => {
  gameMessage.textContent = `Game Over! ${data.winnerName} wins!`;
  gameStatus.textContent = 'Game Over';
  controlsTurnStatus.textContent = 'Game Over';
  updateUI();
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
    ensureFeatureButtonsVisible();

    // Keep account panel in sync with login state
    refreshAccountPanel();

    // Update board
    renderBoard();

    // Update players list
    updatePlayersList();

    // Update controls
    updateControls();

    // Update strategy suggestions for the active turn player.
    // This keeps local-host sessions in sync when testing multiple players on one host.
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    updateStrategyAdvisor(currentPlayer, currentPlayer);

    // Update game status
    if (gameState.gamePhase === 'ended' && gameState.players.length === 1) {
        const winner = gameState.players[0];
        gameStatus.textContent = `${winner.name} Wins!`;
        gameStatus.style.color = winner.color;
        controlsTurnStatus.textContent = 'Game Over';
        controlsTurnStatus.style.color = winner.color;
        return;
    }

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
    ensureFeatureButtonsVisible();

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
    gameBoard.querySelectorAll('.board-space').forEach((spaceEl) => spaceEl.remove());
    
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
    
    updateAnimatedTokens();
}

function ensureTokenLayer() {
    let tokenLayer = gameBoard.querySelector('.token-layer');
    if (!tokenLayer) {
        tokenLayer = document.createElement('div');
        tokenLayer.className = 'token-layer';
        gameBoard.appendChild(tokenLayer);
    }
    return tokenLayer;
}

function getTokenTargetPosition(spaceId, stackIndex) {
    const spaceDiv = gameBoard.querySelector(`.space-${spaceId}`);
    if (!spaceDiv) return null;

    const tokenSize = 16;
    const spaceCenterX = spaceDiv.offsetLeft + (spaceDiv.clientWidth / 2);
    const spaceCenterY = spaceDiv.offsetTop + (spaceDiv.clientHeight / 2);
    const offsetX = ((stackIndex % 3) - 1) * 8;
    const offsetY = (Math.floor(stackIndex / 3) - 0.5) * 8;

    return {
        x: Math.round(spaceCenterX - (tokenSize / 2) + offsetX),
        y: Math.round(spaceCenterY - (tokenSize / 2) + offsetY)
    };
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getForwardPath(start, end, boardSize = 40) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
    const steps = ((end - start) % boardSize + boardSize) % boardSize;
    if (steps === 0) return [];

    const path = [];
    for (let i = 1; i <= steps; i += 1) {
        path.push((start + i) % boardSize);
    }
    return path;
}

function queueTokenAnimation(playerId, task) {
    const existing = tokenAnimationChains.get(playerId) || Promise.resolve();
    const chained = existing
        .catch(() => {})
        .then(task)
        .catch((err) => console.error('Token animation error:', err));
    tokenAnimationChains.set(playerId, chained);
}

async function animatePlayerTokenStepByStep(player, tokenEl, startPosition, endPosition, slotIndex) {
    const path = getForwardPath(startPosition, endPosition);
    if (path.length === 0) {
        const target = getTokenTargetPosition(endPosition, slotIndex);
        if (target) tokenEl.style.transform = `translate(${target.x}px, ${target.y}px)`;
        return;
    }

    for (const spaceId of path) {
        // If the token was removed/replaced, stop this animation chain.
        if (tokenElementsByPlayerId.get(player.id) !== tokenEl) return;

        const target = getTokenTargetPosition(spaceId, slotIndex);
        if (!target) continue;
        tokenEl.style.transform = `translate(${target.x}px, ${target.y}px)`;
        await wait(280);
    }

    tokenEl.classList.remove('moving');
    void tokenEl.offsetWidth;
    tokenEl.classList.add('moving');
    setTimeout(() => {
        if (tokenElementsByPlayerId.get(player.id) === tokenEl) {
            tokenEl.classList.remove('moving');
        }
    }, 480);
}

function updateAnimatedTokens() {
    const tokenLayer = ensureTokenLayer();

    const activePlayerIds = new Set(gameState.players.map((player) => player.id));

    // Remove tokens for players no longer in game
    Array.from(tokenElementsByPlayerId.keys()).forEach((playerId) => {
        if (!activePlayerIds.has(playerId)) {
            const tokenEl = tokenElementsByPlayerId.get(playerId);
            if (tokenEl) tokenEl.remove();
            tokenElementsByPlayerId.delete(playerId);
            previousPlayerPositions.delete(playerId);
        }
    });

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    gameState.players.forEach((player, playerIndex) => {
        const stackIndex = playerIndex;
        const target = getTokenTargetPosition(player.position, stackIndex);
        if (!target) return;

        let tokenEl = tokenElementsByPlayerId.get(player.id);
        if (!tokenEl) {
            tokenEl = document.createElement('div');
            tokenEl.className = 'player-token';
            tokenEl.style.backgroundColor = player.color;
            tokenEl.title = player.name;
            tokenEl.style.transition = 'none';
            tokenEl.style.transform = `translate(${target.x}px, ${target.y}px)`;
            tokenLayer.appendChild(tokenEl);
            tokenElementsByPlayerId.set(player.id, tokenEl);

            requestAnimationFrame(() => {
                tokenEl.style.transition = '';
            });
        }

        tokenEl.classList.toggle('current-player', !!currentPlayer && currentPlayer.id === player.id);

        const previousPosition = previousPlayerPositions.get(player.id);
        const isFirstPlacement = previousPosition === undefined;

        if (isFirstPlacement) {
            tokenEl.style.transform = `translate(${target.x}px, ${target.y}px)`;
        } else if (previousPosition !== player.position) {
            queueTokenAnimation(player.id, () =>
                animatePlayerTokenStepByStep(player, tokenEl, previousPosition, player.position, stackIndex)
            );
        } else {
            // Keep token aligned when board dimensions or spacing change.
            tokenEl.style.transform = `translate(${target.x}px, ${target.y}px)`;
        }
        previousPlayerPositions.set(player.id, player.position);
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

    // Rent payment uses a dedicated highlighted button
    if (payRentBtn) {
        payRentBtn.style.display = 'none';
        payRentBtn.classList.remove('flashing');
        payRentBtn.disabled = true;
    }
    if (gameState.gamePhase === 'payingRent' && gameState.pendingRent) {
        const isPayer = isMyTurn && currentPlayer && gameState.pendingRent.payerId === currentPlayer.id;
        rollDiceBtn.disabled = true;
        buyPropertyBtn.style.display = 'none';
        skipBuyBtn.style.display = 'none';
        if (payRentBtn) {
            payRentBtn.style.display = 'block';
            payRentBtn.textContent = `Pay Rent: $${gameState.pendingRent.rent}`;
            payRentBtn.disabled = !isPayer;
            if (isPayer) payRentBtn.classList.add('flashing');
        }
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

    updateBuildingControls(currentPlayer, isMyTurn);
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

function getHouseCost(propertyColor) {
    const costs = {
        brown: 50,
        lightblue: 50,
        pink: 100,
        orange: 100,
        red: 150,
        yellow: 150,
        green: 200,
        darkblue: 200
    };
    return costs[propertyColor] || 100;
}

function renderBuildingMarkers(space) {
    if (!space || space.type !== 'property') return '';

    if (space.hotel) {
        return '<div class="building-markers"><span class="hotel-marker">🏨</span></div>';
    }

    const houses = Number(space.houses) || 0;
    if (houses <= 0) return '';

    let housesHtml = '';
    for (let i = 0; i < houses; i += 1) {
        housesHtml += '<span class="house-marker">🏠</span>';
    }

    return `<div class="building-markers">${housesHtml}</div>`;
}

function buildingLevel(space) {
    return space?.hotel ? 5 : (Number(space?.houses) || 0);
}

function ownsColorSet(player, color) {
    const setSpaces = gameState.board.filter(s => s.type === 'property' && s.color === color);
    const ownedSet = new Set((player.properties || []).map((id) => Number(id)));
    return setSpaces.length > 0
        && setSpaces.every(s => ownedSet.has(Number(s.id)));
}

function canBuildPropertyClient(player, property) {
    if (!property || property.type !== 'property') return false;
    const ownedSet = new Set((player.properties || []).map((id) => Number(id)));
    const ownsProperty = ownedSet.has(Number(property.id));
    if (!ownsProperty && property.owner !== player.id) return false;
    if (!ownsColorSet(player, property.color)) return false;

    const setSpaces = gameState.board.filter(s => s.type === 'property' && s.color === property.color);
    const nextLevel = Math.min(5, buildingLevel(property) + 1);
    const simulated = setSpaces.map((s) => (s.id === property.id ? nextLevel : buildingLevel(s)));
    const maxLevel = Math.max(...simulated);
    const minLevel = Math.min(...simulated);
    if (maxLevel - minLevel > 1) return false;

    return player.money >= getHouseCost(property.color);
}

function updateBuildingControls(currentPlayer, isMyTurn) {
    if (!buildingControls || !gameState || !currentPlayer) return;

    const ownedProps = (currentPlayer.properties || [])
        .map((id) => gameState.board[Number(id)])
        .filter((space) => space && space.type === 'property');

    if (ownedProps.length === 0) {
        buildingControls.innerHTML = '<div class="building-controls-title">Build Houses / Hotels</div><div class="player-properties">Own a full color set to build.</div>';
        return;
    }

    if (!isMyTurn || gameState.gamePhase === 'buying' || gameState.gamePhase === 'payingRent' || gameState.gamePhase === 'ended') {
        buildingControls.innerHTML = '<div class="building-controls-title">Build Houses / Hotels</div><div class="player-properties">Builds are available on your turn during rolling phase.</div>';
        return;
    }

    const buildableProps = ownedProps.filter((space) => ownsColorSet(currentPlayer, space.color));
    if (buildableProps.length === 0) {
        buildingControls.innerHTML = '<div class="building-controls-title">Build Houses / Hotels</div><div class="player-properties">You need all properties in a color set to build.</div>';
        return;
    }

    const title = '<div class="building-controls-title">Build Houses / Hotels</div>';
    const rows = buildableProps.map((space) => {
        const cost = getHouseCost(space.color);
        const level = buildingLevel(space);
        const canBuild = canBuildPropertyClient(currentPlayer, space) && level < 5;
        let buttonLabel = `Build House ($${cost})`;
        if (level >= 4 && !space.hotel) buttonLabel = `Build Hotel ($${cost})`;
        if (space.hotel) buttonLabel = 'Hotel Built';
        const disabledAttr = canBuild ? '' : 'disabled';

        return `
            <div class="building-row">
                <div>
                    <div>${space.name}</div>
                    ${renderBuildingMarkers(space)}
                </div>
                <button class="action-btn" data-build-property="${space.id}" ${disabledAttr}>${buttonLabel}</button>
            </div>
        `;
    }).join('');

    buildingControls.innerHTML = `${title}${rows}`;

    buildingControls.querySelectorAll('button[data-build-property]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const propertyId = Number(btn.getAttribute('data-build-property'));
            socket.emit('buyBuilding', { propertyId });
        });
    });
}

// Allow Enter key to join
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

window.addEventListener('resize', () => {
    if (gameState && gameScreen.style.display !== 'none') {
        updateAnimatedTokens();
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

function isOwnableSpace(space) {
    return !!space && (space.type === 'property' || space.type === 'railroad' || space.type === 'utility');
}

function forwardDistance(from, to, boardSize = 40) {
    return ((to - from) % boardSize + boardSize) % boardSize;
}

function colorSetSize(color) {
    return gameState.board.filter((space) => space.type === 'property' && space.color === color).length;
}

function playerOwnsColorCount(player, color) {
    const ownedSet = new Set((player.properties || []).map((id) => Number(id)));
    return gameState.board.filter((space) => space.type === 'property' && space.color === color && ownedSet.has(Number(space.id))).length;
}

function estimateClientRent(space, owner) {
    if (!space || !owner) return 0;

    if (space.type === 'railroad') {
        const count = gameState.board.filter((s) => s.type === 'railroad' && s.owner === owner.id).length;
        if (count <= 0) return 0;
        return (Number(space.rent) || 25) * Math.pow(2, count - 1);
    }

    if (space.type === 'utility') {
        const count = gameState.board.filter((s) => s.type === 'utility' && s.owner === owner.id).length;
        return count >= 2 ? 70 : 28;
    }

    if (space.type === 'property') {
        const rentTiers = Array.isArray(space.rentTiers) ? space.rentTiers : null;
        const houses = Number(space.houses) || 0;
        const level = space.hotel ? 5 : Math.max(0, Math.min(4, houses));
        if (rentTiers && typeof rentTiers[level] === 'number') {
            if (level > 0) return rentTiers[level];
            const sameColor = gameState.board.filter((s) => s.type === 'property' && s.color === space.color);
            const hasSet = sameColor.length > 0 && sameColor.every((s) => s.owner === owner.id);
            return hasSet ? rentTiers[0] * 2 : rentTiers[0];
        }
        const base = Number(space.rent) || 0;
        return base;
    }

    return Number(space.rent) || 0;
}

function rankUnownedProperties(player) {
    const ownedSet = new Set((player.properties || []).map((id) => Number(id)));
    const ownedRailroads = gameState.board.filter((s) => s.type === 'railroad' && ownedSet.has(Number(s.id))).length;
    const ownedUtilities = gameState.board.filter((s) => s.type === 'utility' && ownedSet.has(Number(s.id))).length;

    return gameState.board
        .filter((space) => isOwnableSpace(space) && !space.owner)
        .map((space) => {
            const price = Number(space.price) || 0;
            const baseRent = Array.isArray(space.rentTiers) ? Number(space.rentTiers[0]) || 0 : Number(space.rent) || 0;
            const distance = forwardDistance(player.position, space.id);
            let score = 0;

            if (price > 0) {
                score += Math.min(120, Math.round((baseRent / price) * 700));
                score += player.money >= price ? 70 : -220;
            }

            if (space.type === 'property') {
                const ownedInColor = playerOwnsColorCount(player, space.color);
                const setSize = colorSetSize(space.color);
                if (ownedInColor > 0) score += 95 * ownedInColor;
                if (ownedInColor === setSize - 1) score += 180;
            }

            if (space.type === 'railroad') {
                score += 70 + (ownedRailroads * 60);
            }

            if (space.type === 'utility') {
                score += 30 + (ownedUtilities * 30);
            }

            if (distance > 0 && distance <= 10) {
                score += (11 - distance) * 7;
            }

            return { space, score, distance };
        })
        .sort((a, b) => b.score - a.score);
}

function getNearbyThreat(player) {
    let highest = null;

    for (let step = 1; step <= 8; step += 1) {
        const space = gameState.board[(player.position + step) % 40];
        if (!isOwnableSpace(space) || !space.owner || space.owner === player.id) continue;
        const owner = gameState.players.find((p) => p.id === space.owner);
        if (!owner) continue;
        const rent = estimateClientRent(space, owner);
        if (!highest || rent > highest.rent) {
            highest = { step, space, owner, rent };
        }
    }

    return highest;
}

function updateStrategyAdvisor(advisoryPlayer, currentTurnPlayer) {
    if (!strategyAdvisorList || !strategyAdvisorTarget || !gameState || !advisoryPlayer) return;

    const tips = [];
    const me = advisoryPlayer;
    const isMyTurn = !!currentTurnPlayer && currentTurnPlayer.id === me.id;
    const wealth = Number(me.money) || 0;
    const here = gameState.board[me.position];

    strategyAdvisorTarget.textContent = `Advising ${me.name} • Cash $${wealth}`;

    if (gameState.gamePhase === 'buying' && isMyTurn && isOwnableSpace(here) && !here.owner) {
        const price = Number(here.price) || 0;
        const canAfford = wealth >= price;
        if (!canAfford) {
            tips.push(`Skip ${here.name}: it costs $${price}, and your cash is too low right now.`);
        } else if (here.type === 'property') {
            const ownedInColor = playerOwnsColorCount(me, here.color);
            const setSize = colorSetSize(here.color);
            if (ownedInColor === setSize - 1) {
                tips.push(`Buy ${here.name}: this completes your ${here.color} color set.`);
            } else if (ownedInColor > 0) {
                tips.push(`Buying ${here.name} strengthens your ${here.color} set for future builds.`);
            } else {
                tips.push(`Consider buying ${here.name} if you keep at least $250 in reserve.`);
            }
        } else if (here.type === 'railroad') {
            tips.push(`Railroads scale fast. Buying ${here.name} improves future rent pressure.`);
        } else if (here.type === 'utility') {
            tips.push(`Utilities are situational; buy ${here.name} mainly if you have a strong cash cushion.`);
        }
    }

    if (wealth < 200) {
        tips.push('Low cash warning: prioritize survival and avoid optional buys unless they complete a set.');
    } else if (wealth > 1200 && (me.properties?.length || 0) < 2) {
        tips.push('You have strong cash but low board control. Prioritize acquiring one or two high-value properties.');
    }

    const threat = getNearbyThreat(me);
    if (threat && threat.rent > 0) {
        tips.push(`Risk ahead: ${threat.space.name} in ${threat.step} spaces could cost about $${threat.rent} to ${threat.owner.name}.`);
    }

    const targets = rankUnownedProperties(me).slice(0, 2);
    targets.forEach((target, index) => {
        const distanceText = target.distance === 0 ? 'on your space' : `${target.distance} spaces ahead`;
        tips.push(`Target ${index + 1}: ${target.space.name} (${distanceText}) is a strong pickup opportunity.`);
    });

    if (tips.length === 0) {
        tips.push('Build cash and watch opponent monopolies; your next turn may open stronger buy options.');
    }

    strategyAdvisorList.innerHTML = tips.slice(0, 5).map((tip) => `<li>${tip}</li>`).join('');
}

function clearTutorialFocus() {
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
}

function findStepElement(step) {
    if (!step?.selector) return null;
    return document.querySelector(step.selector);
}

function getTutorialSteps() {
    return [
        {
            title: 'Welcome to Monopoly',
            text: 'This quick guide walks through the main controls so your group can start fast.',
            selector: '#lobby'
        },
        {
            title: 'Join the Game',
            text: 'Enter a name and press Join Game. You need at least 2 players to begin.',
            selector: '#playerName'
        },
        {
            title: 'Start the Match',
            text: 'When enough players join, press Start Game to begin turn-based play.',
            selector: '#startBtn'
        },
        {
            title: 'Rolling and Turns',
            text: 'Use Roll Dice on your turn. The status header and sidebar both show whose turn it is.',
            selector: '#rollDiceBtn'
        },
        {
            title: 'Buying and Rent',
            text: 'Land on unowned property to buy it. Land on owned property to pay rent.',
            selector: '#buyPropertyBtn'
        },
        {
            title: 'Trading System',
            text: 'Use Propose Trade to offer money/properties and negotiate with other players.',
            selector: '#proposeTradeBtn'
        },
        {
            title: 'Railroad Rent Rule',
            text: 'Railroad rent scales as $25, $50, $100, then $200 as the owner holds more railroads.',
            selector: '#howToPlayContent'
        },
        {
            title: 'You Are Ready',
            text: 'Use the How to Play panel anytime and restart this tutorial from the lobby or game screen.',
            selector: '#howToPlayToggle'
        }
    ];
}

function positionTutorialCard(targetEl) {
    const card = document.getElementById('tutorialCard');
    if (!card) return;
    if (!targetEl) {
        card.style.top = '24px';
        card.style.right = '24px';
        card.style.left = 'auto';
        return;
    }

    const rect = targetEl.getBoundingClientRect();
    const cardWidth = card.offsetWidth || 340;
    const gap = 14;
    let left = rect.right + gap;
    let top = rect.top;

    if (left + cardWidth > window.innerWidth - 16) {
        left = Math.max(16, rect.left - cardWidth - gap);
    }
    if (top + 220 > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - 236);
    }

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = 'auto';
}

function renderTutorialStep() {
    const overlay = document.getElementById('tutorialOverlay');
    const stepCounterEl = document.getElementById('tutorialStepCounter');
    const titleEl = document.getElementById('tutorialTitle');
    const textEl = document.getElementById('tutorialText');
    const prevBtnEl = document.getElementById('tutorialPrevBtn');
    const nextBtnEl = document.getElementById('tutorialNextBtn');
    if (!tutorialActive || !overlay || !stepCounterEl || !titleEl || !textEl || !prevBtnEl || !nextBtnEl) return;

    const step = tutorialSteps[tutorialIndex];
    if (!step) return;

    stepCounterEl.textContent = `Step ${tutorialIndex + 1} of ${tutorialSteps.length}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;

    clearTutorialFocus();
    const el = findStepElement(step);
    if (el) {
        el.classList.add('tutorial-focus');
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
    positionTutorialCard(el);

    prevBtnEl.disabled = tutorialIndex === 0;
    nextBtnEl.textContent = tutorialIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next';
}

function closeTutorial() {
    tutorialActive = false;
    clearTutorialFocus();
    const overlay = document.getElementById('tutorialOverlay');
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('monopolyTutorialSeen', '1');
}

function startTutorial() {
    ensureTradeAndTutorialContainers();
    const overlay = document.getElementById('tutorialOverlay');
    const card = document.getElementById('tutorialCard');
    if (!overlay || !card) return;
    tutorialSteps = getTutorialSteps();
    tutorialIndex = 0;
    tutorialActive = true;
    overlay.style.display = 'block';
    renderTutorialStep();
}

if (tutorialOverlay) {
    tutorialOverlay.addEventListener('click', (e) => {
        if (e.target === tutorialOverlay) closeTutorial();
    });
}

window.addEventListener('resize', () => {
    if (tutorialActive) renderTutorialStep();
});

window.addEventListener('scroll', () => {
    if (tutorialActive) renderTutorialStep();
}, { passive: true });

window.addEventListener('keydown', (e) => {
    if (!tutorialActive) return;
    if (e.key === 'Escape') closeTutorial();
    if (e.key === 'ArrowRight') {
        if (tutorialIndex >= tutorialSteps.length - 1) closeTutorial();
        else {
            tutorialIndex += 1;
            renderTutorialStep();
        }
    }
    if (e.key === 'ArrowLeft') {
        if (tutorialIndex > 0) {
            tutorialIndex -= 1;
            renderTutorialStep();
        }
    }
});

setTimeout(() => {
    if (!localStorage.getItem('monopolyTutorialSeen')) {
        startTutorial();
    }
}, 700);

