// Sudoku puzzle logic: the generator, the solver and the share codes. It uses nothing
// from the page (no document, no storage), so it loads as a plain script in the
// browser (global SudokuLogic) and as a module in Node, where tests/logic.test.mjs
// checks it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SudokuLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Clues left on the board per difficulty: fewer clues is a harder puzzle.
  const DIFFICULTIES = { easy: 45, medium: 38, hard: 30 };
  const DEFAULT_DIFFICULTY = 'medium';
  // Search steps allowed per uniqueness check. Running out keeps that clue,
  // so a puzzle never ships unless its single solution was proven.
  const SOLVER_BUDGET = 20000;
  // A shared puzzle needs at least this many clues (17 is the proven minimum for 9 × 9).
  const MIN_SHARED_CLUES = 17;

  function range(n) { return Array.from({ length: n }, (_, i) => i); }

  function shuffled(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function bitCount(x) {
    let count = 0;
    for (; x; x &= x - 1) count++;
    return count;
  }

  // Row, column, box and peers of every cell, for a level's grid.
  function geometry(lv) {
    const n = lv.boxRows * lv.boxCols;
    const boxesAcross = n / lv.boxCols;
    const row = [], col = [], box = [], peers = [];
    for (let i = 0; i < n * n; i++) {
      row[i] = Math.floor(i / n);
      col[i] = i % n;
      box[i] = Math.floor(row[i] / lv.boxRows) * boxesAcross + Math.floor(col[i] / lv.boxCols);
    }
    for (let i = 0; i < n * n; i++) {
      peers[i] = range(n * n).filter(j => j !== i && (row[j] === row[i] || col[j] === col[i] || box[j] === box[i]));
    }
    return { n, row, col, box, peers };
  }

  // A random solved grid: the standard pattern, shuffled by moves that keep it
  // valid (rows within a band, bands, columns within a stack, stacks, symbols).
  function solvedGrid(lv, n) {
    const rows = shuffled(range(n / lv.boxRows))
      .flatMap(band => shuffled(range(lv.boxRows)).map(k => band * lv.boxRows + k));
    const cols = shuffled(range(n / lv.boxCols))
      .flatMap(stack => shuffled(range(lv.boxCols)).map(k => stack * lv.boxCols + k));
    const symbols = shuffled(range(n));
    const pattern = (r, c) => (lv.boxCols * (r % lv.boxRows) + Math.floor(r / lv.boxRows) + c) % n;
    const grid = [];
    for (const r of rows) for (const c of cols) grid.push(symbols[pattern(r, c)]);
    return grid;
  }

  const OUT_OF_BUDGET = new Error('solver budget');

  // Solutions of a grid (-1 = empty), counting no further than 2; 0 if the
  // search ran out of budget. Fills the cell with the fewest options first.
  function countSolutions(cells0, g, capture) {
    const { n, row, col, box } = g;
    const grid = [...cells0];
    const rowUsed = new Array(n).fill(0), colUsed = new Array(n).fill(0), boxUsed = new Array(n).fill(0);
    const empty = [];
    grid.forEach((v, i) => {
      if (v < 0) { empty.push(i); return; }
      const bit = 1 << v;
      rowUsed[row[i]] |= bit; colUsed[col[i]] |= bit; boxUsed[box[i]] |= bit;
    });
    const all = (1 << n) - 1;
    let steps = 0;
    let found = 0;

    function search() {
      if (++steps > SOLVER_BUDGET) throw OUT_OF_BUDGET;
      let best = -1, bestFree = 0, bestCount = n + 1;
      for (const i of empty) {
        if (grid[i] >= 0) continue;
        const free = all & ~(rowUsed[row[i]] | colUsed[col[i]] | boxUsed[box[i]]);
        const count = bitCount(free);
        if (count < bestCount) {
          best = i; bestFree = free; bestCount = count;
          if (count <= 1) break;
        }
      }
      if (best < 0) {                      // all filled: one more solution
        if (capture && !found) capture.splice(0, capture.length, ...grid);
        return ++found >= 2;
      }
      for (let v = 0; v < n; v++) {
        const bit = 1 << v;
        if (!(bestFree & bit)) continue;
        grid[best] = v;
        rowUsed[row[best]] |= bit; colUsed[col[best]] |= bit; boxUsed[box[best]] |= bit;
        const stop = search();
        grid[best] = -1;
        rowUsed[row[best]] &= ~bit; colUsed[col[best]] &= ~bit; boxUsed[box[best]] &= ~bit;
        if (stop) return true;
      }
      return false;
    }

    try {
      search();
    } catch (e) {
      if (e === OUT_OF_BUDGET) return 0;
      throw e;
    }
    return found;
  }

  // Take numbers out of a solved grid in random order, putting back any whose
  // removal would allow a second solution, until the level's clue count.
  function makePuzzle(lv, g, target = lv.clues) {
    const solution = solvedGrid(lv, g.n);
    const puzzle = [...solution];
    let clues = puzzle.length;
    for (const i of shuffled(range(puzzle.length))) {
      if (clues <= target) break;
      const v = puzzle[i];
      puzzle[i] = -1;
      if (countSolutions(puzzle, g) === 1) clues--;
      else puzzle[i] = v;
    }
    return { puzzle, solution, values: [...puzzle], notes: new Array(puzzle.length).fill(0) };
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // The puzzle as 81 digits, 0 for a blank.
  function puzzleCode(puzzle) {
    return puzzle.map(v => (v < 0 ? '0' : String(v + 1))).join('');
  }

  // A link or a bare 81-digit code: { digits, beat } or null.
  function parseShared(text) {
    const raw = String(text || '').trim();
    const m = raw.match(/(?:^|[#&?])p=(\d{81})(?!\d)/) || raw.replace(/\s+/g, '').match(/^(\d{81})$/);
    if (!m) return null;
    const tm = raw.match(/[#&?]t=(\d{1,9})(?!\d)/);
    return { digits: m[1], beat: tm ? Number(tm[1]) : 0 };
  }

  // Turns a parsed puzzle into a game, or null unless it is sound: the givens
  // do not clash and there is exactly one solution (the same proof as a made puzzle).
  function buildSharedGame(parsed) {
    const cells = [...parsed.digits].map(ch => Number(ch) - 1);
    const clues = cells.filter(v => v >= 0).length;
    if (clues < 17) return null;
    if (cells.some((v, i) => v >= 0 && geo.peers[i].some(j => cells[j] === v))) return null;
    const solution = [];
    if (countSolutions(cells, geo, solution) !== 1) return null;
    return {
      puzzle: cells,
      solution,
      values: [...cells],
      notes: new Array(cells.length).fill(0),
      difficulty: clues >= 42 ? 'easy' : clues <= 33 ? 'hard' : 'medium',
      elapsed: 0,
      mistakes: 0,
      beat: parsed.beat,
    };
  }

  // Easy, Medium or Hard from the number of clues left.
  function classifyDifficulty(clues) {
    return clues >= 42 ? 'easy' : clues <= 33 ? 'hard' : 'medium';
  }

  // Turns a parsed puzzle into a game, or null unless it is sound: the givens
  // do not clash and there is exactly one solution (the same proof as a made puzzle).
  function buildSharedGame(parsed, geo) {
    const cells = [...parsed.digits].map(ch => Number(ch) - 1);
    const clues = cells.filter(v => v >= 0).length;
    if (clues < MIN_SHARED_CLUES) return null;
    if (cells.some((v, i) => v >= 0 && geo.peers[i].some(j => cells[j] === v))) return null;
    const solution = [];
    if (countSolutions(cells, geo, solution) !== 1) return null;
    return {
      puzzle: cells,
      solution,
      values: [...cells],
      notes: new Array(cells.length).fill(0),
      difficulty: classifyDifficulty(clues),
      elapsed: 0,
      mistakes: 0,
      beat: parsed.beat,
    };
  }

  return {
    DIFFICULTIES, DEFAULT_DIFFICULTY, SOLVER_BUDGET, MIN_SHARED_CLUES,
    range, shuffled, bitCount, geometry, solvedGrid, countSolutions, makePuzzle,
    formatTime, puzzleCode, parseShared, classifyDifficulty, buildSharedGame,
  };
});
