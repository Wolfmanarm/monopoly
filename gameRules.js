export const BOARD_SPACES = [
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

export const HOUSE_COST_BY_COLOR = {
  brown: 50,
  lightblue: 50,
  pink: 100,
  orange: 100,
  red: 150,
  yellow: 150,
  green: 200,
  darkblue: 200,
};

export const PROPERTY_RENT_TIERS = {
  1: [2, 10, 30, 90, 160, 250],
  3: [4, 20, 60, 180, 320, 450],
  6: [6, 30, 90, 270, 400, 550],
  8: [6, 30, 90, 270, 400, 550],
  9: [8, 40, 100, 300, 450, 600],
  11: [10, 50, 150, 450, 625, 750],
  13: [10, 50, 150, 450, 625, 750],
  14: [12, 60, 180, 500, 700, 900],
  16: [14, 70, 200, 550, 750, 950],
  18: [14, 70, 200, 550, 750, 950],
  19: [16, 80, 220, 600, 800, 1000],
  21: [18, 90, 250, 700, 875, 1050],
  23: [18, 90, 250, 700, 875, 1050],
  24: [20, 100, 300, 750, 925, 1100],
  26: [22, 110, 330, 800, 975, 1150],
  27: [22, 110, 330, 800, 975, 1150],
  29: [24, 120, 360, 850, 1025, 1200],
  31: [26, 130, 390, 900, 1100, 1275],
  32: [26, 130, 390, 900, 1100, 1275],
  34: [28, 150, 450, 1000, 1200, 1400],
  37: [35, 175, 500, 1100, 1300, 1500],
  39: [50, 200, 600, 1400, 1700, 2000],
};

export function getColorGroups(boardSpaces = BOARD_SPACES) {
  return boardSpaces
    .filter(space => space.type === 'property' && space.color)
    .reduce((groups, space) => {
      if (!groups[space.color]) groups[space.color] = [];
      groups[space.color].push(space.id);
      return groups;
    }, {});
}

export function createInitialBoard() {
  return BOARD_SPACES.map((space) => {
    const base = { ...space };
    if (space.type === 'property') {
      base.houses = 0;
      base.hotel = false;
      base.houseCost = HOUSE_COST_BY_COLOR[space.color] || 100;
      base.rentTiers = PROPERTY_RENT_TIERS[space.id]
        || [base.rent, base.rent * 2, base.rent * 3, base.rent * 4, base.rent * 5, base.rent * 6];
    }
    return base;
  });
}

export function calculateRentForSpace(board, space, owner) {
  if (!space || !owner) return 0;

  if (space.type === 'railroad') {
    const railroadCount = board.filter(s => s.type === 'railroad' && s.owner === owner.id).length;
    if (railroadCount <= 0) return 0;
    return space.rent * Math.pow(2, railroadCount - 1);
  }

  if (space.type === 'property') {
    const baseRent = Number(space.rent) || 0;
    const rentTiers = Array.isArray(space.rentTiers) ? space.rentTiers : PROPERTY_RENT_TIERS[space.id];
    const houses = Number(space.houses) || 0;
    const hotel = !!space.hotel;
    const level = hotel ? 5 : Math.max(0, Math.min(4, houses));

    if (rentTiers && typeof rentTiers[level] === 'number') {
      if (level > 0) return rentTiers[level];
      const colorGroup = board.filter(s => s.type === 'property' && s.color === space.color);
      const ownsFullSet = colorGroup.length > 0 && colorGroup.every(s => s.owner === owner.id);
      return ownsFullSet ? rentTiers[0] * 2 : rentTiers[0];
    }

    if (hotel) {
      return baseRent * 6;
    }

    if (houses > 0) {
      return baseRent * (houses + 1);
    }

    const colorGroup = board.filter(s => s.type === 'property' && s.color === space.color);
    const ownsFullSet = colorGroup.length > 0 && colorGroup.every(s => s.owner === owner.id);
    return ownsFullSet ? baseRent * 2 : baseRent;
  }

  if (space.type === 'utility') {
    return 0;
  }

  return space.rent;
}