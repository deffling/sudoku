// Tests for logic.js: run with  node --test "tests/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const Logic = createRequire(import.meta.url)('../logic.js');
const LEVEL = { boxRows: 3, boxCols: 3, clues: 38 };
const geo = Logic.geometry(LEVEL);

const clueCount = puzzle => puzzle.filter(v => v >= 0).length;

// Every row, column and box holds each of the digits 0 to 8 exactly once.
function isValidSolution(grid) {
  if (grid.length !== 81 || grid.some(v => !Number.isInteger(v) || v < 0 || v > 8)) return false;
  const groups = Array.from({ length: 27 }, () => new Set());
  grid.forEach((v, i) => {
    groups[geo.row[i]].add(v);
    groups[9 + geo.col[i]].add(v);
    groups[18 + geo.box[i]].add(v);
  });
  return groups.every(set => set.size === 9);
}

test('geometry: 81 cells, 20 peers each, nine boxes of nine', () => {
  assert.equal(geo.n, 9);
  assert.equal(geo.peers.length, 81);
  assert.ok(geo.peers.every(p => p.length === 20));
  for (let b = 0; b < 9; b++) assert.equal(geo.box.filter(x => x === b).length, 9);
});

for (const [level, target] of Object.entries(Logic.DIFFICULTIES)) {
  test(`makePuzzle (${level}): valid solution, matching clues, exactly one solution`, () => {
    for (let k = 0; k < 3; k++) {
      const game = Logic.makePuzzle(LEVEL, geo, target);
      assert.ok(isValidSolution(game.solution), 'solution is a valid grid');
      game.puzzle.forEach((v, i) => {
        if (v >= 0) assert.equal(v, game.solution[i], `clue ${i} matches the solution`);
      });
      assert.ok(clueCount(game.puzzle) >= target, `at least ${target} clues stay`);
      assert.equal(Logic.countSolutions(game.puzzle, geo), 1, 'exactly one solution');
      assert.deepEqual(game.values, game.puzzle);
      assert.ok(game.notes.length === 81 && game.notes.every(n => n === 0));
    }
  });
}

test('countSolutions: a solved grid has one, an empty grid stops at two, capture gets the first', () => {
  const { solution } = Logic.makePuzzle(LEVEL, geo, 45);
  assert.equal(Logic.countSolutions(solution, geo), 1);
  assert.equal(Logic.countSolutions(new Array(81).fill(-1), geo), 2);
  const captured = [];
  const game = Logic.makePuzzle(LEVEL, geo, 45);
  assert.equal(Logic.countSolutions(game.puzzle, geo, captured), 1);
  assert.deepEqual(captured, game.solution);
});

test('share code: round trip through a link keeps the puzzle, its solution and the time to beat', () => {
  const game = Logic.makePuzzle(LEVEL, geo, 38);
  const code = Logic.puzzleCode(game.puzzle);
  assert.match(code, /^[0-9]{81}$/);
  const link = `https://example.test/sudoku/sudoku.html#p=${code}&t=76534`;
  const parsed = Logic.parseShared(link);
  assert.deepEqual(parsed, { digits: code, beat: 76534 });
  const shared = Logic.buildSharedGame(parsed, geo);
  assert.deepEqual(shared.puzzle, game.puzzle);
  assert.deepEqual(shared.solution, game.solution);
  assert.equal(shared.beat, 76534);
  assert.equal(shared.elapsed, 0);
  assert.equal(shared.mistakes, 0);
});

test('share code: a bare code, extra spaces and no time all parse', () => {
  const code = Logic.puzzleCode(Logic.makePuzzle(LEVEL, geo, 45).puzzle);
  assert.deepEqual(Logic.parseShared(`  ${code}\n`), { digits: code, beat: 0 });
  assert.deepEqual(Logic.parseShared(`#p=${code}`), { digits: code, beat: 0 });
  assert.deepEqual(Logic.parseShared(`?x=1&p=${code}&t=5`), { digits: code, beat: 5 });
});

test('share code: text that is not an 81-digit puzzle is refused', () => {
  const code = Logic.puzzleCode(Logic.makePuzzle(LEVEL, geo, 45).puzzle);
  for (const bad of ['', null, undefined, '12345', code.slice(1), `${code}0`, `#p=${code}0`, `#p=${code.slice(1)}`, 'x'.repeat(81)]) {
    assert.equal(Logic.parseShared(bad), null, `refuses ${JSON.stringify(bad)?.slice(0, 20)}`);
  }
});

test('buildSharedGame refuses unsound puzzles', () => {
  const game = Logic.makePuzzle(LEVEL, geo, 38);
  const build = cells => Logic.buildSharedGame({ digits: cells.map(v => (v < 0 ? '0' : String(v + 1))).join(''), beat: 0 }, geo);

  assert.equal(build(new Array(81).fill(-1)), null, 'too few clues');

  const few = new Array(81).fill(-1);
  game.solution.slice(0, 16).forEach((v, i) => { few[i] = v; });
  assert.equal(build(few), null, '16 clues is below the minimum');

  const many = new Array(81).fill(-1);
  game.solution.slice(0, 25).forEach((v, i) => { many[i] = v; });
  assert.equal(build(many), null, 'several solutions');

  const clash = new Array(81).fill(-1);
  game.solution.slice(0, 20).forEach((v, i) => { clash[i] = v; });
  clash[1] = clash[0];   // cells 0 and 1 share a row
  assert.equal(build(clash), null, 'two equal digits that see each other');

  // A puzzle whose clues do not clash cell to cell but cannot be completed.
  let unsolvable = null;
  outer: for (let i = 0; i < 81 && !unsolvable; i++) {
    if (game.puzzle[i] < 0) continue;
    for (let v = 0; v < 9; v++) {
      if (v === game.puzzle[i]) continue;
      const cells = [...game.puzzle];
      cells[i] = v;
      if (geo.peers[i].some(j => cells[j] === v)) continue;
      if (Logic.countSolutions(cells, geo) === 0) { unsolvable = cells; break outer; }
    }
  }
  assert.ok(unsolvable, 'found an unsolvable variant to test with');
  assert.equal(build(unsolvable), null, 'no solution');
});

test('buildSharedGame rates a puzzle by its clue count', () => {
  assert.equal(Logic.classifyDifficulty(45), 'easy');
  assert.equal(Logic.classifyDifficulty(42), 'easy');
  assert.equal(Logic.classifyDifficulty(41), 'medium');
  assert.equal(Logic.classifyDifficulty(38), 'medium');
  assert.equal(Logic.classifyDifficulty(34), 'medium');
  assert.equal(Logic.classifyDifficulty(33), 'hard');
  assert.equal(Logic.classifyDifficulty(30), 'hard');
  const easy = Logic.makePuzzle(LEVEL, geo, 45);
  const built = Logic.buildSharedGame({ digits: Logic.puzzleCode(easy.puzzle), beat: 0 }, geo);
  assert.equal(built.difficulty, Logic.classifyDifficulty(clueCount(easy.puzzle)));
});

test('formatTime: minutes and seconds, hours only when needed', () => {
  assert.equal(Logic.formatTime(0), '00:00');
  assert.equal(Logic.formatTime(999), '00:00');
  assert.equal(Logic.formatTime(59999), '00:59');
  assert.equal(Logic.formatTime(75000), '01:15');
  assert.equal(Logic.formatTime(3599000), '59:59');
  assert.equal(Logic.formatTime(3600000), '1:00:00');
  assert.equal(Logic.formatTime(3725000), '1:02:05');
});

test('shuffled keeps every item and range counts up', () => {
  assert.deepEqual(Logic.range(4), [0, 1, 2, 3]);
  const list = Logic.range(50);
  assert.deepEqual([...Logic.shuffled(list)].sort((a, b) => a - b), list);
  assert.deepEqual(list, Logic.range(50), 'the input is not changed');
});
