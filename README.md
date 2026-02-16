# Monopoly Multiplayer Game

A real-time multiplayer Monopoly-style game built with Node.js, Express, and Socket.io.

## Features

- **Real-time Multiplayer**: Play with up to 6 players simultaneously
- **Game Lobby**: Join system with player list
- **Classic Board**: 40 spaces including properties, railroads, utilities, and special spaces
- **Turn-based Gameplay**: Server-side dice rolling prevents cheating
- **Property System**: Buy properties, collect rent
- **Economy**: Starting money $1500, automatic rent collection
- **Real-time Sync**: All players see game state updates instantly

## Tech Stack

- **Backend**: Node.js with Express and Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Storage**: In-memory game state (no database)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## How to Play

1. **Join Game**: Enter your name and click "Join Game"
2. **Start Game**: Once 2+ players have joined, click "Start Game"
3. **Roll Dice**: When it's your turn, click "Roll Dice" (server-side rolling)
4. **Buy Properties**: If you land on an unowned property, you can buy it
5. **Pay Rent**: If you land on an owned property, rent is automatically deducted
6. **Win**: Last player with money wins!

## Game Rules

- Each player starts with $1,500
- Roll dice to move around the board
- Buy unowned properties when you land on them
- Pay rent to property owners automatically
- Pass GO to collect $200
- Rolling doubles gives you another turn

## File Structure

```
Monopoly/
├── server.js          # Express server with Socket.io and game logic
├── package.json       # Dependencies
├── public/
│   ├── index.html    # Main HTML file
│   ├── script.js     # Client-side JavaScript
│   └── style.css     # Styling
└── README.md         # This file
```

## Development

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable.

## Future Enhancements

- Chance and Community Chest cards
- Property development (houses/hotels)
- Property trading between players
- Auction system for unowned properties
- Jail mechanics (3 turns or pay to get out)
- Bankruptcy detection and game end conditions
