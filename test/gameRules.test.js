import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SPACES,
  HOUSE_COST_BY_COLOR,
  PROPERTY_RENT_TIERS,
  calculateRentForSpace,
  createInitialBoard,
  getColorGroups
} from '../gameRules.js';

test('11) createInitialBoard builds a full Monopoly board', () => {
  const board = createInitialBoard();

  assert.equal(board.length, 40);
  assert.notStrictEqual(board[1], BOARD_SPACES[1]);
  assert.deepEqual(board[1].rentTiers, PROPERTY_RENT_TIERS[1]);
  assert.equal(board[1].houses, 0);
  assert.equal(board[1].hotel, false);
  assert.equal(board[1].houseCost, HOUSE_COST_BY_COLOR.brown);
  assert.equal(board[39].houseCost, HOUSE_COST_BY_COLOR.darkblue);
});

test('12) getColorGroups returns each color set', () => {
  const groups = getColorGroups();

  assert.deepEqual(groups.brown, [1, 3]);
  assert.deepEqual(groups.darkblue, [37, 39]);
});

test('13) calculateRentForSpace doubles rent for a complete color set', () => {
  const board = createInitialBoard();
  const owner = { id: 'player-1' };

  board[1].owner = owner.id;
  board[3].owner = owner.id;

  assert.equal(calculateRentForSpace(board, board[1], owner), 4);
});

test('14) calculateRentForSpace uses railroad scaling', () => {
  const board = createInitialBoard();
  const owner = { id: 'player-1' };

  board[5].owner = owner.id;
  board[15].owner = owner.id;
  board[25].owner = owner.id;

  assert.equal(calculateRentForSpace(board, board[5], owner), 100);
});

test('15) calculateRentForSpace uses the correct house tier', () => {
  const board = createInitialBoard();
  const owner = { id: 'player-1' };

  board[39].owner = owner.id;
  board[37].owner = owner.id;
  board[39].houses = 1;

  assert.equal(calculateRentForSpace(board, board[39], owner), 200);
});