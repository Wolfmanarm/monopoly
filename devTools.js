export function registerDevTools(io, socket, gameState, helpers = {}) {
  const {
    COLOR_GROUPS = {},
    broadcastGameState = () => {}
  } = helpers;

  socket.on('devGiveMoney', (amount = 5000) => {
    const player = gameState.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }

    player.money += Number(amount) || 0;
    broadcastGameState();
  });

  socket.on('devGiveProperty', (propertyId) => {
    const player = gameState.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }

    const space = gameState.board[Number(propertyId)];
    if (!space) {
      socket.emit('error', 'Invalid property id');
      return;
    }

    if (!(space.type === 'property' || space.type === 'railroad' || space.type === 'utility')) {
      socket.emit('error', 'That space is not ownable');
      return;
    }

    if (space.owner) {
      const oldOwner = gameState.players.find(p => p.id === space.owner);
      if (oldOwner) {
        oldOwner.properties = oldOwner.properties.filter(id => id !== space.id);
      }
    }

    space.owner = player.id;
    if (!player.properties.includes(space.id)) {
      player.properties.push(space.id);
    }

    broadcastGameState();
  });

  socket.on('devGiveColorSet', (color) => {
    const player = gameState.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }

    const group = COLOR_GROUPS[color];
    if (!group) {
      socket.emit('error', 'Invalid color group');
      return;
    }

    group.forEach(propertyId => {
      const space = gameState.board[propertyId];
      if (!space) return;

      if (space.owner) {
        const oldOwner = gameState.players.find(p => p.id === space.owner);
        if (oldOwner) {
          oldOwner.properties = oldOwner.properties.filter(id => id !== propertyId);
        }
      }

      space.owner = player.id;
      if (!player.properties.includes(propertyId)) {
        player.properties.push(propertyId);
      }
    });

    broadcastGameState();
  });

  socket.on('devMoveTo', (position) => {
    const player = gameState.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }

    const numericPosition = Number(position);
    if (!Number.isInteger(numericPosition) || numericPosition < 0 || numericPosition > 39) {
      socket.emit('error', 'Invalid board position');
      return;
    }

    player.position = numericPosition;
    broadcastGameState();
  });

    socket.on('devSetMoney', (amount) => {
    const player = gameState.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      socket.emit('error', 'Invalid money amount');
      return;
    }

    player.money = numericAmount;
    broadcastGameState();
  });
}