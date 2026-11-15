// Sudoku game: the board, controls, clock, sharing and sound. Styles are in
// sudoku.css, puzzle logic in logic.js and the quick response code generator in
// vendor/qrcode.min.js. Every puzzle is generated in the browser, so the game
// plays offline once the page is cached.
//
// With data-sudoku-standalone on <html> the game opens as soon as the page loads.
// Without it the game is a hidden extra: tap the build number five times.
//
// The classic 9 × 9 with 3 × 3 boxes and digits only (Easy, Medium and Hard
// differ only in how many clues stay; see DIFFICULTIES in logic.js). The
// generator and board take any box shape, so bigger grids can come back by
// changing LEVEL. Wrapped in a function so the page's own globals stay its own.
(() => {
  // Pure puzzle logic (generator, solver, share codes) is in logic.js and the
  // quick response code generator in vendor/qrcode.min.js, which defines `qrcode`.
  const { DIFFICULTIES, DEFAULT_DIFFICULTY, range, geometry, makePuzzle, formatTime, parseShared } = SudokuLogic;
  const LEVEL = { id: 'game', boxRows: 3, boxCols: 3, clues: 38 };
  const SYMBOLS = '123456789';
  const MIN_CELL_PX = 26;          // smaller is hard to read and to tap on a phone
  const MAX_CELL_PX = 56;
  const BOARD_BORDER_PX = 2;       // .sdk-board's border, both sides
  const DIALOG_MARGIN_PX = 32;     // room kept above and below the dialog
  const TAPS_TO_OPEN = 5;
  const TAP_GAP_MS = 800;          // taps further apart start the count again
  const DOUBLE_TAP_MS = 300;       // a quick double tap reloads the page
  const ERASE_HOLD_MS = 2000;      // hold the erase button for 2s before deleting a value
  const BUILD_ID = '@@BUILD_ID@@'.startsWith('@@') ? 'local' : '@@BUILD_ID@@'.slice(0, 7);
  const I18N = {
    en: {
      title: 'Sudoku',
      sound: 'Sound',
      soundOn: 'Sound on',
      soundOff: 'Sound off',
      close: 'Close',
      notes: 'Notes',
      undo: 'Undo',
      erase: 'Erase',
      check: 'Check',
      guide: 'Guide',
      newGame: 'New game',
      confirmNew: 'Start a new game? Your current game will be lost.',
      confirmLevel: 'Start a new {level} game? Your current game will be lost.',
      confirmShared: 'Play the shared puzzle? Your current game will be lost.',
      confirmOk: 'Start new game',
      confirmCancel: 'Keep playing',
      build: 'Build',
      solved: 'Solved! Well done.',
      noMistakes: 'No mistakes so far.',
      wrong: '{n} wrong, shown in red.',
      hint: 'Hint: {reason}',
      hintCell: 'Only {value} can go in row {row}, column {col}.',
      hintRow: 'Only place for {value} in row {unit} is column {col}.',
      hintColumn: 'Only place for {value} in column {unit} is row {row}.',
      hintBox: 'Only place for {value} in box {unit} is row {row}, column {col}.',
      noHint: 'No direct deduction is available yet.',
      makingPuzzle: 'Making a puzzle…',
      companionIdle: 'Let’s take it one square at a time. Tap Guide if you need a hint.',
      companionWrong: 'A little mix-up! Check that row, column and box, then try again.',
      companionRow: 'row {n}',
      companionColumn: 'column {n}',
      companionBox: 'quadrant {n}',
      companionAnd: ' and ',
      companionUnitPraise: 'Lovely work! {units} complete — you’re on a roll!',
      level: 'Difficulty',
      levelEasy: 'Easy',
      levelMedium: 'Medium',
      levelHard: 'Hard',
      time: 'Time',
      mistakes: 'Mistakes',
      best: 'Best',
      newBest: 'New best!',
      digitLeft: '{n} left',
      digitDone: 'all placed',
      share: 'Share',
      shareTitle: 'Share this puzzle',
      shareHint: 'Anyone who opens the link or loads the code gets the same puzzle, so you can compare times.',
      shareLink: 'Link',
      shareCode: 'Puzzle code',
      shareCopy: 'Copy',
      shareCopied: 'Copied',
      shareIncludeTime: 'Include my time ({time}) as the time to beat',
      shareLoadLabel: 'Load a link or code',
      shareLoad: 'Load',
      shareReplace: 'Replace my game?',
      shareReplaceNote: 'Loading this puzzle replaces the game you are playing. Tap again to confirm.',
      shareQrNote: 'A scannable code needs this page to be hosted at an https address.',
      shareClose: 'Close',
      shareInvalid: 'That is not a valid puzzle.',
      shareLoaded: 'Shared puzzle loaded. Good luck!',
      toBeat: 'To beat',
      beatWin: 'You won by {d}!',
      beatLose: 'Slower by {d}',
      beatTie: 'A tie!',
      language: 'Language',
      languageName: 'English',
    },
    zh: {
      title: '数独',
      sound: '声音',
      soundOn: '声音已开',
      soundOff: '声音已关',
      close: '关闭',
      notes: '笔记',
      undo: '撤销',
      erase: '清除',
      check: '检查',
      guide: '提示',
      newGame: '新游戏',
      confirmNew: '开始新游戏？当前的游戏会丢失。',
      confirmLevel: '开始新的{level}游戏？当前的游戏会丢失。',
      confirmShared: '玩分享的题目吗？当前的游戏会丢失。',
      confirmOk: '开始新游戏',
      confirmCancel: '继续游戏',
      build: '构建',
      solved: '已完成！很好。',
      noMistakes: '目前还没有错误。',
      wrong: '{n} 处错误，已标红。',
      hint: '提示：{reason}',
      hintCell: '第 {row} 行第 {col} 列只能填 {value}。',
      hintRow: '第 {unit} 行中，{value} 只能填在第 {col} 列。',
      hintColumn: '第 {unit} 列中，{value} 只能填在第 {row} 行。',
      hintBox: '第 {unit} 宫中，{value} 只能填在第 {row} 行第 {col} 列。',
      noHint: '目前还没有可以直接推导的数字。',
      makingPuzzle: '正在生成题目…',
      companionIdle: '慢慢来，一格一格填。需要提示时，点“提示”就好。',
      companionWrong: '有个小差错！检查一下对应的行、列和宫，再试试看。',
      companionRow: '第 {n} 行',
      companionColumn: '第 {n} 列',
      companionBox: '第 {n} 宫',
      companionAnd: '和',
      companionUnitPraise: '做得真棒！{units}都完成了，继续加油！',
      level: '难度',
      levelEasy: '简单',
      levelMedium: '中等',
      levelHard: '困难',
      time: '用时',
      mistakes: '错误',
      best: '最佳',
      newBest: '新纪录！',
      digitLeft: '还剩 {n} 个',
      digitDone: '已填满',
      share: '分享',
      shareTitle: '分享这道题',
      shareHint: '打开链接或载入题号的人会得到同一道题，可以比较用时。',
      shareLink: '链接',
      shareCode: '题号',
      shareCopy: '复制',
      shareCopied: '已复制',
      shareIncludeTime: '附上我的用时（{time}）作为要超越的时间',
      shareLoadLabel: '载入链接或题号',
      shareLoad: '载入',
      shareReplace: '替换当前游戏？',
      shareReplaceNote: '载入这道题会替换你正在玩的游戏。再点一次确认。',
      shareQrNote: '要生成可扫描的二维码，需要把本页放在 https 地址上。',
      shareClose: '关闭',
      shareInvalid: '这不是有效的题目。',
      shareLoaded: '已载入分享的题目。加油！',
      toBeat: '要超越',
      beatWin: '你赢了 {d}！',
      beatLose: '慢了 {d}',
      beatTie: '平局！',
      language: '语言',
      languageName: '简体中文',
    },
  };
  // Own prefix, so saved games never mix with other keys stored on the same site.
  const STORE_PREFIX = 'sudoku_';
  // tools/build-sudoku.mjs builds a one-file sudoku.html with this attribute:
  // there the game is the whole page, open from the start, with no Close.
  const STANDALONE = document.documentElement.hasAttribute('data-sudoku-standalone');

  let dialog, board, pad, statusEl, companionEl, companionSpeech, notesBtn, newBtn, soundBtn, langSelect, buildLabel, guideBtn;
  let gameActionButtons = [];
  let cells = [];
  const level = LEVEL;
  let geo = null;
  let game = null;          // { puzzle, solution, values, notes }: one entry per cell
  let selected = -1;
  let hoveredSymbol = -1;
  let notesMode = false;
  let history = [];         // undo: the cells as they were before each move
  let wrong = new Set();    // shown after Check, until the next move
  let busy = false;
  let confirmDlg = null;
  let confirmAction = null;
  let eraseHoldFrame = 0;
  let difficulty = ((d) => (d in DIFFICULTIES ? d : DEFAULT_DIFFICULTY))(storeGet('difficulty'));
  let pendingDifficulty = null;  // picked mid-game: used if the player confirms a new game
  let metaEls = null;
  let runStart = 0;              // when the clock last started running; 0 means paused
  let clockTimer = 0;
  let justBest = false;
  let finishedGame = null;
  let shareDlg = null;
  let shareArmed = false;       // Load was tapped once and would replace a game in progress
  let startNotice = null;       // a message to show once the first game is on screen
  let eraseHoldStart = 0;
  let eraseHoldBtn = null;
  let eraseHoldTriggered = false;
  let suppressEraseClick = false;
  let suppressEraseClickTimer = 0;
  let guideMode = false;
  let guideHintTimer = 0;
  let hintVisual = null;
  let statusMessage = null;
  let statusMood = 'idle';
  let currentLang = storeGet('lang') || 'en';

  function t(key, params = {}) {
    const dict = I18N[currentLang] || I18N.en;
    const value = dict[key] || I18N.en[key] || key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
  }

  function renderMessage(message) {
    if (message.key === 'hint') {
      const reason = message.reason;
      return t('hint', { reason: t(reason.key, reason.params) });
    }
    if (message.key === 'companionUnitPraise') {
      const names = message.units.map(unit => t(unit.key, unit.params));
      const units = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')}${t('companionAnd')}${names[names.length - 1]}`;
      return t('companionUnitPraise', { units });
    }
    return t(message.key, message.params);
  }

  function setLanguage(lang) {
    currentLang = lang in I18N ? lang : 'en';
    storeSet('lang', currentLang);
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en-SG';
    if (!dialog) return;
    if (langSelect) langSelect.value = currentLang;
    const title = dialog.querySelector('#sdkTitle');
    if (title) title.textContent = t('title');
    const closeBtn = dialog.querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.textContent = t('close');
    const soundLabel = dialog.querySelector('[data-act="sound"] > span');
    if (soundLabel) soundLabel.textContent = t('sound');
    if (soundBtn) {
      soundBtn.setAttribute('aria-label', soundOn ? t('soundOn') : t('soundOff'));
      soundBtn.setAttribute('aria-pressed', String(soundOn));
    }
    const eraseBtn = dialog.querySelector('[data-act="erase"] > span');
    if (eraseBtn) eraseBtn.textContent = t('erase');
    if (notesBtn) notesBtn.textContent = t('notes');
    if (newBtn) newBtn.textContent = t('newGame');
    const undoBtn = dialog.querySelector('[data-act="undo"]');
    if (undoBtn) undoBtn.textContent = t('undo');
    const checkBtn = dialog.querySelector('[data-act="check"]');
    if (checkBtn) checkBtn.textContent = t('check');
    if (guideBtn) {
      guideBtn.textContent = t('guide');
      guideBtn.setAttribute('aria-pressed', String(guideMode));
    }
    if (buildLabel) buildLabel.textContent = t('build');
    if (statusEl) {
      const text = statusMessage ? renderMessage(statusMessage) : '';
      statusEl.textContent = text;
      statusEl.classList.toggle('sdk-solved', statusMood === 'celebrating' && statusMessage?.key === 'solved');
      if (companionSpeech) {
        companionSpeech.textContent = text || t('companionIdle');
        companionEl.dataset.mood = statusMood;
      }
    }
    const langLabel = dialog.querySelector('.lang-label');
    if (langLabel) langLabel.textContent = t('language');
    const shareBtn = dialog.querySelector('[data-act="share"]');
    if (shareBtn) shareBtn.textContent = t('share');
    renderMeta();
    refreshShare();
  }

  // ── Saved games: one per level, in this browser only ──

  function storeGet(key) {
    try { return localStorage.getItem(STORE_PREFIX + key); } catch { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(STORE_PREFIX + key, value); } catch { /* private window: play unsaved */ }
  }
  function storeRemove(key) {
    try { localStorage.removeItem(STORE_PREFIX + key); } catch { /* nothing to remove */ }
  }

  function loadGame(lv, g) {
    try {
      const saved = JSON.parse(storeGet(lv.id));
      const size = g.n * g.n;
      const valid = saved && ['puzzle', 'solution', 'values', 'notes'].every(k => Array.isArray(saved[k]) && saved[k].length === size);
      return valid ? saved : null;
    } catch {
      return null;
    }
  }

  function saveGame() {
    if (game) storeSet(level.id, JSON.stringify({ ...game, elapsed: elapsedMs() }));
  }

  // ── Game state ──

  // ── Clock, difficulty and stats ──

  function elapsedMs() {
    return game ? game.elapsed + (runStart ? Date.now() - runStart : 0) : 0;
  }

  function pauseClock() {
    if (runStart && game) game.elapsed += Date.now() - runStart;
    runStart = 0;
  }

  function resumeClock() {
    if (game && !isSolved() && !runStart && dialog && dialog.open && !document.hidden && document.hasFocus() && !(shareDlg && shareDlg.open) && !(confirmDlg && confirmDlg.open)) runStart = Date.now();
  }

  // Stop the clock and keep the time if it beats the best for this difficulty.
  function finishGame() {
    if (!game || finishedGame === game) return;
    finishedGame = game;
    pauseClock();
    const key = `best_${game.difficulty}`;
    const previous = Number(storeGet(key)) || 0;
    justBest = game.elapsed > 0 && (!previous || game.elapsed < previous);
    if (justBest) storeSet(key, String(game.elapsed));
    renderMeta();
  }

  function renderMeta() {
    if (!metaEls) return;
    const shown = pendingDifficulty || (game && game.difficulty) || difficulty;
    metaEls.group.setAttribute('aria-label', t('level'));
    metaEls.levels.forEach((b) => {
      const label = t(`level${b.dataset.level[0].toUpperCase()}${b.dataset.level.slice(1)}`);
      if (b.textContent !== label) b.textContent = label;
      b.setAttribute('aria-pressed', String(b.dataset.level === shown));
    });
    const own = game ? game.difficulty : difficulty;
    const best = Number(storeGet(`best_${own}`)) || 0;
    const main = game ? `${t('time')} ${formatTime(elapsedMs())} · ${t('mistakes')} ${game.mistakes}` : '';
    let bestText;
    if (game && game.beat) {
      // A shared puzzle with a time to beat: show the target, then the result.
      const gap = game.beat - game.elapsed;
      bestText = finishedGame === game
        ? (gap > 0 ? t('beatWin', { d: formatTime(gap) }) : gap < 0 ? t('beatLose', { d: formatTime(-gap) }) : t('beatTie'))
        : `${t('toBeat')} ${formatTime(game.beat)}`;
    } else {
      bestText = justBest && game && isSolved() ? t('newBest') : `${t('best')} ${best ? formatTime(best) : '—'}`;
    }
    if (metaEls.main.textContent !== main) metaEls.main.textContent = main;
    if (metaEls.best.textContent !== bestText) metaEls.best.textContent = bestText;
  }

  function pickLevel(id) {
    if (!(id in DIFFICULTIES) || busy || !game) return;
    if (id === (pendingDifficulty || game.difficulty)) return;
    pendingDifficulty = id;
    renderMeta();
    if (!midGame()) return newGame();
    const level = t(`level${id[0].toUpperCase()}${id.slice(1)}`);
    askConfirm(t('confirmLevel', { level }), newGame, () => {
      pendingDifficulty = null;
      renderMeta();
    });
  }

  // How many of each digit are still to place, shown on the number pad.
  function updatePad() {
    if (!pad || !game) return;
    const counts = new Array(geo.n).fill(0);
    game.values.forEach((v) => { if (v >= 0) counts[v] += 1; });
    pad.querySelectorAll('.sdk-key').forEach((key) => {
      const k = Number(key.dataset.sym);
      const left = Math.max(0, geo.n - counts[k]);
      key.classList.toggle('sdk-key-done', left === 0);
      const badge = key.querySelector('.sdk-key-left');
      const text = left ? String(left) : '';
      if (badge && badge.textContent !== text) badge.textContent = text;
      key.setAttribute('aria-label', `${SYMBOLS[k]}, ${left ? t('digitLeft', { n: left }) : t('digitDone')}`);
    });
  }

  // ── Sharing a puzzle ──
  // The puzzle travels as 81 digits (0 = blank) in the link's # part, plus an
  // optional time to beat in milliseconds: #p=<81 digits>&t=<ms>.

  function puzzleCode() {
    return SudokuLogic.puzzleCode(game.puzzle);
  }

  function shareLink(withTime) {
    const base = location.href.split('#')[0].split('?')[0];
    const time = withTime && game.elapsed > 0 ? `&t=${Math.round(game.elapsed)}` : '';
    return `${base}#p=${puzzleCode()}${time}`;
  }

  // Turns a parsed puzzle into a game, or null unless it is sound (see logic.js).
  function buildSharedGame(parsed) {
    return SudokuLogic.buildSharedGame(parsed, geo);
  }

  function readSharedFromUrl() {
    if (!/[#&]p=/.test(location.hash)) return null;
    const parsed = parseShared(location.hash);
    try {
      history.replaceState(null, '', location.href.split('#')[0]);
    } catch {
      location.hash = '';   // some file pages refuse replaceState; clearing the hash does the same job
    }
    return parsed || { invalid: true };
  }

  function loadShared(g) {
    showGame(g);
    saveGame();
    rippleIn();
    play('start');
    setStatus(t('shareLoaded'), false, 'helpful', { key: 'shareLoaded' });
  }

  // A shared puzzle arrived: play it at once, or ask first if a game is in progress.
  function offerShared(g) {
    if (busy) return;
    if (midGame()) return askConfirm(t('confirmShared'), () => loadShared(g));
    loadShared(g);
  }

  function onSharedHash() {
    const shared = readSharedFromUrl();
    if (!shared || !game) return;
    const g = shared.invalid ? null : buildSharedGame(shared);
    if (g) offerShared(g);
    else setStatus(t('shareInvalid'), false, 'concerned', { key: 'shareInvalid' });
  }

  function buildShareDialog() {
    shareDlg = document.createElement('dialog');
    shareDlg.className = 'sdk-share';
    shareDlg.setAttribute('aria-labelledby', 'sdkShareTitle');
    shareDlg.innerHTML = `
      <h3 id="sdkShareTitle"></h3>
      <p class="sdk-share-hint"></p>
      <label class="sdk-share-field">
        <span class="sdk-share-label" data-i="shareLink"></span>
        <span class="sdk-share-row">
          <input type="text" readonly data-field="link">
          <button type="button" class="btn btn-sm" data-share="copy-link" data-i="shareCopy"></button>
        </span>
      </label>
      <label class="sdk-share-field">
        <span class="sdk-share-label" data-i="shareCode"></span>
        <span class="sdk-share-row">
          <input type="text" readonly data-field="code">
          <button type="button" class="btn btn-sm" data-share="copy-code" data-i="shareCopy"></button>
        </span>
      </label>
      <label class="sdk-share-time"><input type="checkbox" data-field="time" checked><span data-i="shareIncludeTime"></span></label>
      <div class="sdk-share-qr"><canvas width="1" height="1" aria-hidden="true"></canvas><p class="sdk-share-qr-note" data-i="shareQrNote"></p></div>
      <label class="sdk-share-field">
        <span class="sdk-share-label" data-i="shareLoadLabel"></span>
        <span class="sdk-share-row">
          <input type="text" data-field="load" autocomplete="off" spellcheck="false">
          <button type="button" class="btn btn-sm" data-share="load" data-i="shareLoad"></button>
        </span>
      </label>
      <p class="sdk-share-msg" role="status"></p>
      <div class="sdk-share-actions"><button type="button" class="btn btn-sm" data-share="close" data-i="shareClose"></button></div>`;
    document.body.appendChild(shareDlg);
    shareDlg.addEventListener('click', onShareClick);
    shareDlg.addEventListener('close', onShareClosed);
    shareDlg.querySelector('[data-field="time"]').addEventListener('change', refreshShare);
    shareDlg.querySelector('[data-field="load"]').addEventListener('input', () => { shareArmed = false; refreshShare(); });
  }

  function shareMessage(text) {
    shareDlg.querySelector('.sdk-share-msg').textContent = text;
  }

  function refreshShare() {
    if (!shareDlg || !game) return;
    const solved = isSolved() && game.elapsed > 0;
    shareDlg.querySelector('#sdkShareTitle').textContent = t('shareTitle');
    shareDlg.querySelector('.sdk-share-hint').textContent = t('shareHint');
    shareDlg.querySelectorAll('[data-i]').forEach((el) => {
      const key = el.dataset.i;
      if (key === 'shareLoad' && shareArmed) el.textContent = t('shareReplace');
      else el.textContent = t(key, key === 'shareIncludeTime' ? { time: formatTime(game.elapsed) } : {});
    });
    const timeRow = shareDlg.querySelector('.sdk-share-time');
    timeRow.hidden = !solved;
    const link = shareLink(solved && timeRow.querySelector('input').checked);
    shareDlg.querySelector('[data-field="link"]').value = link;
    shareDlg.querySelector('[data-field="code"]').value = puzzleCode();
    drawShareQr(link);
  }

  // A scannable code only helps when the link opens on another device, so only
  // when this page is served from an https address.
  function drawShareQr(link) {
    const canvas = shareDlg.querySelector('canvas');
    const note = shareDlg.querySelector('.sdk-share-qr-note');
    const hosted = location.protocol === 'https:';
    canvas.hidden = !hosted;
    note.hidden = hosted;
    if (!hosted) return;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      const count = qr.getModuleCount();
      const quiet = 4;
      const scale = Math.max(3, Math.floor(240 / (count + quiet * 2)));
      canvas.width = canvas.height = (count + quiet * 2) * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    } catch {
      canvas.hidden = true;
    }
  }

  function openShare() {
    if (!game) return;
    if (!shareDlg) buildShareDialog();
    pauseClock();   // looking at the share panel is not play time
    shareArmed = false;
    shareDlg.querySelector('[data-field="time"]').checked = true;
    shareDlg.querySelector('[data-field="load"]').value = '';
    shareMessage('');
    refreshShare();
    shareDlg.showModal();
  }

  // The share panel closed (Close, Escape or a loaded puzzle). The clock runs again,
  // and starts over from zero if no numbers have been entered yet.
  function onShareClosed() {
    if (!game) return;
    pauseClock();
    if (!isSolved() && !hasProgress()) game.elapsed = 0;
    resumeClock();
    saveGame();
    renderMeta();
  }

  async function copyField(field) {
    const input = shareDlg.querySelector(`[data-field="${field}"]`);
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();   // no clipboard access (a file page, say): select it so Ctrl+C works
      try { document.execCommand('copy'); } catch { /* the text stays selected */ }
    }
    shareMessage(t('shareCopied'));
  }

  function onShareClick(e) {
    const button = e.target.closest('button');
    if (!button || !button.dataset.share) return;
    const act = button.dataset.share;
    if (act === 'close') return shareDlg.close();
    if (act === 'copy-link') return copyField('link');
    if (act === 'copy-code') return copyField('code');
    if (act === 'load') {
      const parsed = parseShared(shareDlg.querySelector('[data-field="load"]').value);
      const g = parsed && buildSharedGame(parsed);
      if (!g) return shareMessage(t('shareInvalid'));
      if (midGame() && !shareArmed) {
        shareArmed = true;
        refreshShare();
        return shareMessage(t('shareReplaceNote'));
      }
      shareDlg.close();
      loadShared(g);
    }
  }

  function isSolved() {
    return game.values.every((v, i) => v === game.solution[i]);
  }

  function hasProgress() {
    return game && !isSolved() && game.values.some((v, i) => v >= 0 && game.puzzle[i] < 0);
  }

  function conflicts() {
    const found = new Set();
    game.values.forEach((v, i) => {
      if (v >= 0 && geo.peers[i].some(j => game.values[j] === v)) found.add(i);
    });
    return found;
  }

  function firstEmpty() {
    const i = game.values.indexOf(-1);
    return i >= 0 ? i : 0;
  }

  function snapshot(indices) {
    return indices.map(i => ({ i, value: game.values[i], notes: game.notes[i] }));
  }

  function clearGuideHintTimer() {
    if (guideHintTimer) {
      clearTimeout(guideHintTimer);
      guideHintTimer = 0;
    }
  }

  function scheduleGuideHint() {
    clearGuideHintTimer();
    if (!guideMode) return;
    guideHintTimer = setTimeout(() => {
      guideHintTimer = 0;
      if (!guideMode) return;
      const hint = findNextHint(true);
      if (!hint) return;
      selected = hint.index;
      renderBoard();
      cells[hint.index]?.focus();
      setGuideKeyHighlight(hint.value);
    }, 10000);
  }

  function afterMove() {
    wrong.clear();
    hintVisual = null;
    saveGame();
    renderBoard();
    if (isSolved()) {
      finishGame();
      storeRemove(level.id);
      setStatus(t('solved'), true, 'celebrating', { key: 'solved' });
    } else if (guideMode) {
      clearGuideHintTimer();
      scheduleGuideHint();
    } else {
      setStatus('');
    }
  }

  function enter(symbol) {
    const i = selected;
    if (i < 0 || game.puzzle[i] >= 0 || isSolved()) return;
    if (guideMode) {
      setGuideKeyHighlight(undefined);
    }
    if (notesMode) {
      if (game.values[i] >= 0) return;
      history.push(snapshot([i]));
      game.notes[i] ^= 1 << symbol;
      afterMove();
      play('note');
      return;
    }
    const placing = game.values[i] !== symbol;
    const bit = 1 << symbol;
    // Placing a number also clears it from the notes of the cells it rules out.
    const touched = placing ? [i, ...geo.peers[i].filter(j => game.notes[j] & bit)] : [i];
    if (!placing) animate(cells[i], 'sdk-pop');
    history.push(snapshot(touched));
    if (placing && symbol !== game.solution[i]) game.mistakes += 1;
    game.values[i] = placing ? symbol : -1;
    game.notes[i] = 0;
    if (placing) touched.slice(1).forEach(j => { game.notes[j] &= ~bit; });
    afterMove();
    if (placing) reactToPlacing(i, symbol);
    else play('erase');
  }

  function erase() {
    if (!game || isSolved()) return;
    const touched = [];
    for (let i = 0; i < game.values.length; i++) {
      if (game.puzzle[i] >= 0) continue;
      if (game.values[i] < 0 && !game.notes[i]) continue;
      touched.push({ i, value: game.values[i], notes: game.notes[i] });
      animate(cells[i], 'sdk-pop');
      game.values[i] = -1;
      game.notes[i] = 0;
    }
    if (!touched.length) return;
    history.push(touched);
    selected = touched[0].i;
    afterMove();
    play('erase');
  }

  function eraseSelected() {
    if (!game || isSolved()) return;
    if (wrong.size >= 2) {
      const indices = [...wrong].filter(i => game.puzzle[i] < 0 && game.values[i] >= 0);
      if (!indices.length) return;
      indices.forEach(i => animate(cells[i], 'sdk-pop'));
      history.push(snapshot(indices));
      indices.forEach(i => {
        game.values[i] = -1;
        game.notes[i] = 0;
      });
      selected = indices[0];
      afterMove();
      play('erase');
      return;
    }
    if (selected < 0 || game.puzzle[selected] >= 0) return;
    if (game.values[selected] < 0 && !game.notes[selected]) return;
    animate(cells[selected], 'sdk-pop');
    history.push(snapshot([selected]));
    game.values[selected] = -1;
    game.notes[selected] = 0;
    afterMove();
    play('erase');
  }

  // ── Delight: small animations and synthesised sounds ──
  // Sounds are made with Web Audio (no files, so offline too) and can be
  // switched off. Animations stop under prefers-reduced-motion (see the styles).

  let audio = null;
  let soundOn = storeGet('sound') !== 'off';
  let ambientLoop = null;
  let ambientNodes = [];
  let ambientBus = null;
  let ambientDuckUntil = 0;
  const SOUND_GAIN = 0.2;
  const AMBIENT_GAIN = 0.45;
  const AMBIENT_DUCK_GAIN = 0.25;
  const SOUNDS = {
    place:  [[660, 0, 0.09, 'triangle']],
    note:   [[990, 0, 0.08, 'sine', 0.5]],
    erase:  [[392, 0, 0.07, 'triangle', 0.7]],
    clash:  [[196, 0, 0.16, 'triangle', 0.35], [185, 0.05, 0.18, 'triangle', 0.35]],
    unit:   [[523, 0, 0.12, 'sine'], [659, 0.07, 0.12, 'sine'], [784, 0.14, 0.2, 'sine']],
    chime:  [[659.25, 0.00, 0.18, 'sine', 0.9], [783.99, 0.10, 0.18, 'triangle', 0.8], [1046.50, 0.20, 0.36, 'sine', 0.7]],
    check:  [[523, 0, 0.16, 'sine', 0.9], [659, 0.09, 0.16, 'sine', 0.9], [784, 0.18, 0.20, 'triangle', 0.9],
             [1047, 0.34, 0.36, 'sine', 0.8], [784, 0.52, 0.36, 'triangle', 0.7]],
    solved: [[523, 0.00, 0.18, 'sine', 0.9], [659, 0.08, 0.18, 'triangle', 0.9], [784, 0.16, 0.20, 'sine', 1.0],
             [1047, 0.28, 0.38, 'triangle', 1.1], [1318, 0.42, 0.34, 'sine', 0.9],
             [1047, 0.52, 0.56, 'triangle', 0.8], [784, 0.68, 0.52, 'sine', 0.7]],
    start:  [[440, 0, 0.08, 'sine', 0.6], [587, 0.06, 0.12, 'sine', 0.6]],
  };

  function playAmbientLoop() {
    if (!soundOn) return;
    try {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
    } catch {
      return;
    }
    if (!ambientBus) {
      ambientBus = audio.createGain();
      ambientBus.connect(audio.destination);
    }
    const phrase = [
      [261.63, 0.00, 4.00, 'sine', 0.12],
      [329.63, 0.10, 4.00, 'sine', 0.10],
      [392.00, 0.20, 4.00, 'triangle', 0.08],
      [523.25, 0.32, 4.00, 'sine', 0.07],

      [392.00, 4.40, 4.20, 'sine', 0.11],
      [440.00, 4.55, 4.20, 'triangle', 0.09],
      [523.25, 4.70, 4.20, 'sine', 0.08],
      [659.25, 4.90, 4.20, 'triangle', 0.06],

      [587.33, 9.20, 4.50, 'sine', 0.10],
      [659.25, 9.35, 4.50, 'triangle', 0.08],
      [783.99, 9.50, 4.50, 'sine', 0.07],
      [698.46, 9.65, 4.50, 'triangle', 0.06],

      [659.25, 14.10, 4.80, 'sine', 0.09],
      [587.33, 14.30, 4.80, 'triangle', 0.08],
      [523.25, 14.55, 4.80, 'sine', 0.07],
      [392.00, 14.80, 4.80, 'triangle', 0.06],

      [329.63, 19.30, 5.20, 'sine', 0.08],
      [293.66, 19.55, 5.20, 'triangle', 0.07],
      [261.63, 19.80, 5.20, 'sine', 0.06],
    ];
    const now = audio.currentTime;
    ambientNodes.forEach(node => {
      const { amp, osc } = node;
      try {
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value || 0.0001, now);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.stop(now + 0.12);
      } catch {}
    });
    ambientNodes = [];
    for (const [freq, start, length, type, volume] of phrase) {
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0.0001, now + start);
      amp.gain.exponentialRampToValueAtTime(AMBIENT_GAIN * volume * 0.825, now + start + 0.38);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(amp).connect(ambientBus);
      osc.start(now + start);
      osc.stop(now + start + length + 0.45);
      ambientNodes.push({ osc, amp });
    }
  }

  function startAmbientLoop() {
    if (!soundOn || ambientLoop) return;
    playAmbientLoop();
    ambientLoop = setInterval(() => {
      if (soundOn) playAmbientLoop();
    }, 25000);
  }

  function stopAmbientLoop() {
    if (ambientLoop) {
      clearInterval(ambientLoop);
      ambientLoop = null;
    }
    ambientNodes.forEach(({ amp, osc }) => {
      try {
        const now = audio?.currentTime ?? 0;
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value || 0.0001, now);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.stop(now + 0.09);
      } catch {}
    });
    ambientNodes = [];
  }

  function setSound(on) {
    soundOn = on;
    storeSet('sound', on ? 'on' : 'off');
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? t('soundOn') : t('soundOff'));
    soundBtn.classList.toggle('is-on', on);
    if (on) startAmbientLoop();
    else stopAmbientLoop();
  }

  // Each tone: [frequency Hz, start s, length s, waveform, relative volume].
  function play(name) {
    if (!soundOn) return;
    try {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
    } catch {
      return;   // no Web Audio: silent
    }
    const now = audio.currentTime;
    const tones = SOUNDS[name];
    if (ambientBus) {
      const end = Math.max(...tones.map(([, start, length]) => now + start + length)) + 0.08;
      ambientDuckUntil = Math.max(ambientDuckUntil, end);
      ambientBus.gain.cancelScheduledValues(now);
      ambientBus.gain.setValueAtTime(ambientBus.gain.value, now);
      ambientBus.gain.linearRampToValueAtTime(AMBIENT_DUCK_GAIN, now + 0.03);
      ambientBus.gain.setValueAtTime(AMBIENT_DUCK_GAIN, ambientDuckUntil);
      ambientBus.gain.linearRampToValueAtTime(1, ambientDuckUntil + 0.25);
    }
    for (const [freq, start, length, type, volume = 1] of tones) {
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      // A quick rise and an exponential fall: a soft pluck, no click.
      amp.gain.setValueAtTime(0.0001, now + start);
      amp.gain.exponentialRampToValueAtTime(SOUND_GAIN * volume, now + start + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(amp).connect(audio.destination);
      osc.start(now + start);
      osc.stop(now + start + length + 0.02);
    }
  }

  // Restarts a one-shot CSS animation on a cell, after an optional delay.
  function animate(el, cls, delayMs = 0) {
    el.classList.remove(cls);
    void el.offsetWidth;   // reflow, so the same animation can play again
    if (delayMs) el.style.setProperty('--sdk-delay', `${delayMs}ms`);
    else el.style.removeProperty('--sdk-delay');
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  function pulseSelectedCell() {
    const active = cells[selected];
    if (!active) return;
    active.classList.remove('sdk-focus-pulse');
    void active.offsetWidth;
    requestAnimationFrame(() => active.classList.add('sdk-focus-pulse'));
    active.addEventListener('animationend', () => active.classList.remove('sdk-focus-pulse'), { once: true });
  }

  // Rows, columns and boxes through cell i that are now full with no clash.
  function completedUnits(i) {
    const { n, row, col, box } = geo;
    const units = [
      { type: 'companionRow', number: row[i] + 1, cells: range(n * n).filter(j => row[j] === row[i]) },
      { type: 'companionColumn', number: col[i] + 1, cells: range(n * n).filter(j => col[j] === col[i]) },
      { type: 'companionBox', number: box[i] + 1, cells: range(n * n).filter(j => box[j] === box[i]) },
    ];
    return units.filter(({ cells: unit }) => {
      const values = unit.map(j => game.values[j]);
      return values.every(v => v >= 0) && new Set(values).size === n;
    });
  }

  function praiseCompletedUnits(units) {
    const names = units.map(unit => t(unit.type, { n: unit.number }));
    const joined = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')}${t('companionAnd')}${names[names.length - 1]}`;
    setStatus(t('companionUnitPraise', { units: joined }), false, 'celebrating', {
      key: 'companionUnitPraise',
      units: units.map(unit => ({ key: unit.type, params: { n: unit.number } })),
    });
  }

  function distance(a, b) {
    return Math.abs(geo.row[a] - geo.row[b]) + Math.abs(geo.col[a] - geo.col[b]);
  }

  function reactToPlacing(i, symbol) {
    if (isSolved()) return celebrate(i);
    if (geo.peers[i].some(j => game.values[j] === symbol)) {
      animate(cells[i], 'sdk-shake');
      setStatus(t('companionWrong'), false, 'concerned', { key: 'companionWrong' });
      return play('clash');
    }
    animate(cells[i], 'sdk-pop');
    const done = completedUnits(i);
    if (!done.length) return play('place');
    // The flash spreads out from the cell just filled.
    new Set(done.flatMap(unit => unit.cells)).forEach(j => animate(cells[j], 'sdk-flash', distance(i, j) * 35));
    const boxCompleted = done.some(unit => unit.type === 'companionBox');
    praiseCompletedUnits(done);
    if (boxCompleted) play('chime');
    else play('unit');
  }

  function celebrate(from) {
    cells.forEach((el, j) => animate(el, 'sdk-wave', distance(from, j) * 30));
    setStatus(t('solved'), true, 'celebrating', { key: 'solved' });
    play('solved');
  }

  // A new puzzle's numbers ripple in from the top-left corner.
  function rippleIn() {
    cells.forEach((el, j) => {
      if (game.values[j] >= 0) animate(el, 'sdk-pop', (geo.row[j] + geo.col[j]) * 14);
    });
  }

  function undo() {
    const move = history.pop();
    if (!move || isSolved()) return;
    move.forEach(({ i, value, notes }) => { game.values[i] = value; game.notes[i] = notes; });
    selected = move[0].i;
    afterMove();
  }

  function check() {
    hintVisual = null;
    wrong = new Set(game.values
      .map((v, i) => (v >= 0 && game.puzzle[i] < 0 && v !== game.solution[i] ? i : -1))
      .filter(i => i >= 0));
    renderBoard();
    cells[selected]?.focus();
    if (isSolved()) {
      finishGame();
      setStatus(t('solved'), true, 'celebrating', { key: 'solved' });
      return;
    }
    if (wrong.size) {
      setStatus(t('wrong', { n: wrong.size }), false, 'concerned', { key: 'wrong', params: { n: wrong.size } });
      return play('clash');
    }
    setStatus(t('noMistakes'), false, 'celebrating', { key: 'noMistakes' });
    play('check');
  }

  // ── Starting ──

  function contentWidth() {
    const style = getComputedStyle(dialog);
    return dialog.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - BOARD_BORDER_PX;
  }

  // The saved game if there is one, else a new puzzle.
  function start() {
    geo = geometry(level);
    const shared = readSharedFromUrl();
    const saved = loadGame(level, geo);
    if (saved) showGame(saved);
    const sharedGame = shared && !shared.invalid ? buildSharedGame(shared) : null;
    if (sharedGame) return offerShared(sharedGame);
    if (!saved) newGame();
    if (shared) {
      if (saved) setStatus(t('shareInvalid'), false, 'concerned', { key: 'shareInvalid' });
      else startNotice = { key: 'shareInvalid', mood: 'concerned' };
    }
  }

  function newGame() {
    if (busy) return;
    busy = true;
    const chosen = pendingDifficulty || (game && game.difficulty) || difficulty;
    setStatus(t('makingPuzzle'), false, 'idle', { key: 'makingPuzzle' });
    // Let the message paint first: proving the puzzle unique takes a moment.
    setTimeout(() => {
      try {
        const fresh = makePuzzle(level, geo, DIFFICULTIES[chosen]);
        fresh.difficulty = chosen;
        fresh.elapsed = 0;
        fresh.mistakes = 0;
        difficulty = chosen;
        pendingDifficulty = null;
        storeSet('difficulty', chosen);
        showGame(fresh);
        saveGame();
        rippleIn();
        play('start');
      } finally {
        busy = false;
      }
    }, 30);
  }

  function showGame(g) {
    game = g;
    game.difficulty = game.difficulty in DIFFICULTIES ? game.difficulty : DEFAULT_DIFFICULTY;
    game.elapsed = Number(game.elapsed) || 0;
    game.mistakes = Number(game.mistakes) || 0;
    game.beat = Number(game.beat) || 0;
    pendingDifficulty = null;
    runStart = 0;
    justBest = false;
    finishedGame = null;
    hintVisual = null;
    history = [];
    wrong.clear();
    selected = firstEmpty();
    buildBoard();
    sizeBoard();
    renderBoard();
    sizeBoard();   // the stats text just appeared: settle the size again
    resumeClock();
    cells[selected].focus();
    setStatus(isSolved() ? t('solved') : '', isSolved(), isSolved() ? 'celebrating' : 'idle',
      isSolved() ? { key: 'solved' } : null);
    if (startNotice) {
      const notice = startNotice;
      startNotice = null;
      setStatus(renderMessage(notice), false, notice.mood || 'idle', notice);
    }
  }

  // ── Rendering ──

  function buildBoard() {
    const { n, row, col } = geo;
    board.style.setProperty('--n', n);
    board.style.setProperty('--note-cols', level.boxCols);
    board.setAttribute('aria-label', `Sudoku board, ${n} by ${n}`);
    cells = range(n * n).map(i => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sdk-cell';
      b.dataset.cell = i;
      if (col[i] === n - 1) b.classList.add('sdk-edge-r');
      else if (col[i] % level.boxCols === level.boxCols - 1) b.classList.add('sdk-box-r');
      if (row[i] === n - 1) b.classList.add('sdk-edge-b');
      else if (row[i] % level.boxRows === level.boxRows - 1) b.classList.add('sdk-box-b');
      return b;
    });
    board.replaceChildren(...cells);

    pad.style.setProperty('--pad-cols', n <= 9 ? n : n / 2);
    pad.replaceChildren(...range(n).map(k => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sdk-key';
      b.dataset.sym = k;
      const sym = document.createElement('span');
      sym.className = 'sdk-key-sym';
      sym.textContent = SYMBOLS[k];
      const left = document.createElement('span');
      left.className = 'sdk-key-left';
      left.setAttribute('aria-hidden', 'true');
      b.append(sym, left);
      return b;
    }));
  }

  // Cells as large as the screen allows, never below MIN_CELL_PX (the dialog
  // scrolls instead, e.g. a phone held sideways). Keep the board stable across
  // puzzle reloads until the browser is actually resized.
  function sizeBoard() {
    if (!geo || !dialog.open) return;
    const dialogStyle = getComputedStyle(dialog);
    const play = dialog.querySelector('.sdk-play');
    const companion = dialog.querySelector('.sdk-companion');
    const footer = dialog.querySelector('.sdk-footer');
    const tools = dialog.querySelector('.sdk-tools');
    const header = dialog.querySelector('.sdk-head');
    const meta = dialog.querySelector('.sdk-meta');
    const gap = parseFloat(dialogStyle.rowGap) || parseFloat(dialogStyle.gap) || 0;
    // Everything that takes room around the board: the header, each row of the play
    // area that is in the layout flow, and the gaps between them.
    const boardStyle = getComputedStyle(board);
    const measureOthers = () => {
      const rows = [...play.children].filter(el => el !== board && getComputedStyle(el).position !== 'absolute');
      const playStyle = getComputedStyle(play);
      const playGap = parseFloat(playStyle.rowGap) || parseFloat(playStyle.gap) || 0;
      return (header ? header.offsetHeight + gap : 0)
        + rows.reduce((sum, el) => {
            const rowStyle = getComputedStyle(el);
            // The footer's top margin is auto on a phone (it just takes the spare room), so skip it.
            if (el === footer) return sum + el.offsetHeight;
            return sum + el.offsetHeight + (parseFloat(rowStyle.marginTop) || 0) + (parseFloat(rowStyle.marginBottom) || 0);
          }, 0)
        + playGap * rows.length
        + (parseFloat(boardStyle.marginTop) || 0) + (parseFloat(boardStyle.marginBottom) || 0);
    };
    // Sizing the board changes the width of the rows around it (a narrower button
    // row may wrap), so measure again and settle on the size that really fits.
    let boardSize = 0;
    let cell = 0;
    const apply = (c) => {
      cell = c;
      boardSize = cell * geo.n + BOARD_BORDER_PX * 2;
      board.style.setProperty('--cell', `${cell}px`);
      board.style.width = `${boardSize}px`;
      board.style.height = `${boardSize}px`;
      board.style.setProperty('--board-size', `${boardSize}px`);
      dialog.style.setProperty('--board-size', `${boardSize}px`);
      pad.style.width = `${boardSize}px`;
      if (tools) tools.style.width = `${boardSize}px`;
      if (header) header.style.width = `${boardSize}px`;
      if (meta) meta.style.width = `${boardSize}px`;
      if (companion) companion.style.width = `${boardSize}px`;
    };
    for (let pass = 0; pass < 4; pass++) {
      const availableWidth = contentWidth();
      const availableHeight = Math.max(
        MIN_CELL_PX * geo.n,
        window.innerHeight - DIALOG_MARGIN_PX
        - parseFloat(dialogStyle.paddingTop) - parseFloat(dialogStyle.paddingBottom)
        - measureOthers()
      );
      const nextCell = Math.max(MIN_CELL_PX, Math.floor(Math.min(availableWidth / geo.n, availableHeight / geo.n, MAX_CELL_PX)));
      const settled = nextCell === cell;
      apply(nextCell);
      if (settled) break;
    }
    // Last check against what the browser really laid out: step down until the
    // dialog stops scrolling, unless the board is already at its smallest.
    for (let k = 0; k < 6 && cell > MIN_CELL_PX && dialog.scrollHeight > dialog.clientHeight + 1; k++) {
      apply(cell - 1);
    }
  }

  function renderBoard() {
    const { n, row, col, box } = geo;
    const solved = isSolved();
    const selValue = selected >= 0 ? game.values[selected] : -1;
    const highlightValue = hoveredSymbol >= 0 ? hoveredSymbol : selValue;
    const clashes = conflicts();
    cells.forEach((el, i) => {
      const v = game.values[i];
      const given = game.puzzle[i] >= 0;
      const peer = selected >= 0 && i !== selected &&
        (row[i] === row[selected] || col[i] === col[selected] || box[i] === box[selected]);
      el.classList.toggle('sdk-given', given);
      el.classList.toggle('sdk-selected', i === selected);
      el.classList.toggle('sdk-peer', peer);
      el.classList.toggle('sdk-same', highlightValue >= 0 && i !== selected && v === highlightValue);
      el.classList.toggle('sdk-conflict', clashes.has(i) || wrong.has(i));
      const hintCell = Boolean(hintVisual && hintVisual.cells.includes(i) && v < 0);
      el.classList.toggle('sdk-hint-unit', hintCell && i !== hintVisual.index);
      el.classList.toggle('sdk-hint-target', Boolean(hintVisual && hintVisual.index === i));
      el.classList.toggle('sdk-hint-blocker', Boolean(hintVisual && hintVisual.blockers.includes(i)));
      el.tabIndex = i === selected ? 0 : -1;

      // Rebuild the content only when it changes: a new element would restart
      // a pop or shake that is still playing.
      const hintMask = hintCell ? hintVisual.options[i] : 0;
      const key = `${v}|${game.notes[i]}|${hintMask}|${hintVisual?.index === i ? hintVisual.value : -1}`;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.replaceChildren(...cellContent(v, game.notes[i], n, hintMask, hintVisual?.index === i ? hintVisual.value : -1));
      }
      const content = v >= 0 ? SYMBOLS[v] : 'empty';
      el.setAttribute('aria-label', `Row ${row[i] + 1}, column ${col[i] + 1}: ${content}${given ? ', given' : ''}`);
    });
    gameActionButtons.forEach(button => { button.disabled = solved; });
    if (selected >= 0) pulseSelectedCell();
    updatePad();
    renderMeta();
  }

  // A cell's number, or its notes laid out like a small box, or nothing.
  function cellContent(v, notes, n, hintMask = 0, hintValue = -1) {
    if (v >= 0) {
      const value = document.createElement('span');
      value.className = 'sdk-val';
      value.textContent = SYMBOLS[v];
      return [value];
    }
    const content = [];
    if (notes) {
      const marks = document.createElement('span');
      marks.className = 'sdk-notes';
      for (let k = 0; k < n; k++) {
        const s = document.createElement('span');
        s.textContent = notes & (1 << k) ? SYMBOLS[k] : '';
        marks.appendChild(s);
      }
      content.push(marks);
    }
    if (hintMask) {
      const candidates = document.createElement('span');
      candidates.className = 'sdk-hint-candidates';
      for (let k = 0; k < n; k++) {
        const s = document.createElement('span');
        if (hintMask & (1 << k)) {
          s.textContent = SYMBOLS[k];
          if (k === hintValue) s.className = 'sdk-hint-candidate-target';
        }
        candidates.appendChild(s);
      }
      content.push(candidates);
    }
    return content;
  }

  function setGuideKeyHighlight(symbol) {
    if (!pad) return;
    const keys = pad.querySelectorAll('.sdk-key');
    keys.forEach((button) => button.classList.remove('is-guide'));
    if (symbol === undefined) return;
    const highlighted = SYMBOLS.indexOf(String(symbol));
    if (highlighted < 0) return;
    const key = pad.querySelector(`.sdk-key[data-sym="${highlighted}"]`);
    if (key) key.classList.add('is-guide');
  }

  function onNumberPadPointer(event) {
    if (event.pointerType !== 'mouse') return;
    const key = event.target.closest('.sdk-key');
    if (!key) return;
    if (event.type === 'pointerout' && key.contains(event.relatedTarget)) return;
    const symbol = event.type === 'pointerover' ? Number(key.dataset.sym) : -1;
    if (hoveredSymbol === symbol) return;
    hoveredSymbol = symbol;
    if (game) updateNumberHighlights();
  }

  function updateNumberHighlights() {
    const selectedValue = selected >= 0 ? game.values[selected] : -1;
    const highlightValue = hoveredSymbol >= 0 ? hoveredSymbol : selectedValue;
    cells.forEach((cell, i) => {
      cell.classList.toggle('sdk-same',
        highlightValue >= 0 && i !== selected && game.values[i] === highlightValue);
    });
  }

  function setGuideMode(on) {
    guideMode = on;
    if (!on) {
      clearGuideHintTimer();
      setGuideKeyHighlight(undefined);
      hintVisual = null;
      if (game) renderBoard();
      setStatus('');
      if (guideBtn) {
        guideBtn.setAttribute('aria-pressed', String(on));
        guideBtn.classList.toggle('is-on', on);
        guideBtn.textContent = t('guide');
      }
      return;
    }
    if (guideBtn) {
      guideBtn.setAttribute('aria-pressed', String(on));
      guideBtn.classList.toggle('is-on', on);
      guideBtn.textContent = t('guide');
    }
    const hint = findNextHint();
    if (hint) {
      selected = hint.index;
      renderBoard();
      cells[hint.index]?.focus();
      setGuideKeyHighlight(hint.value);
    }
  }

  function findNextHint(skipSelected = false) {
    if (!game || isSolved() || wrong.size) return null;

    const open = range(game.values.length).filter(i => game.values[i] < 0 && game.puzzle[i] < 0);
    if (!open.length) {
      setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
      return null;
    }

    for (let i = 0; i < game.values.length; i++) {
      const value = game.values[i];
      if (value >= 0 && geo.peers[i].some(j => j < i && game.values[j] === value)) {
        setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
        return null;
      }
    }

    const n = geo.n;
    const all = (1 << n) - 1;
    const options = new Array(game.values.length).fill(0);
    for (const i of open) {
      let used = 0;
      for (const j of geo.peers[i]) {
        if (game.values[j] >= 0) used |= 1 << game.values[j];
      }
      options[i] = all & ~used;
      if (!options[i]) {
        setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
        return null;
      }
    }

    const units = [];
    for (let r = 0; r < n; r++) {
      units.push({ cells: range(n * n).filter(i => geo.row[i] === r), type: 0, index: r });
    }
    for (let c = 0; c < n; c++) {
      units.push({ cells: range(n * n).filter(i => geo.col[i] === c), type: 1, index: c });
    }
    for (let b = 0; b < n; b++) {
      units.push({ cells: range(n * n).filter(i => geo.box[i] === b), type: 2, index: b });
    }

    const deductions = new Map();
    const addDeduction = (i, value, score, type, reason) => {
      const current = deductions.get(i);
      if (current && current.value !== value) return false;
      if (!current || score > current.score || (score === current.score && type < current.type)) {
        deductions.set(i, { i, value, score, type, reason, selected: i === selected });
      }
      return true;
    };

    for (const i of open) {
      if ((options[i] & (options[i] - 1)) === 0) {
        const value = Math.log2(options[i]);
        const bestUnit = units
          .filter(unit => unit.cells.includes(i))
          .map(unit => ({
            score: unit.cells.length - unit.cells.filter(j => game.values[j] < 0).length,
            type: unit.type,
          }))
          .sort((a, b) => b.score - a.score || a.type - b.type)[0];
        if (!addDeduction(i, value, bestUnit.score, bestUnit.type, { kind: 'cell' })) {
          setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
          return null;
        }
      }
    }

    for (const unit of units) {
      const filled = unit.cells.filter(i => game.values[i] >= 0).length;
      for (let value = 0; value < n; value++) {
        if (unit.cells.some(i => game.values[i] === value)) continue;
        const locations = unit.cells.filter(i => game.values[i] < 0 && (options[i] & (1 << value)));
        if (!locations.length) {
          setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
          return null;
        }
        if (locations.length === 1 &&
            !addDeduction(locations[0], value, filled, unit.type, { kind: unit.type, index: unit.index, cells: unit.cells })) {
          setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
          return null;
        }
      }
    }

    const inferred = [...deductions.values()];
    const candidates = skipSelected ? inferred.filter(hint => hint.i !== selected) : inferred;
    const source = candidates.length ? candidates : inferred;
    if (!source.length) {
      setStatus(t('noHint'), false, 'idle', { key: 'noHint' });
      return null;
    }
    source.sort((a, b) =>
      b.score - a.score ||
      Number(b.selected) - Number(a.selected) ||
      a.type - b.type ||
      a.i - b.i
    );

    const preferred = source[0].i;
    const value = SYMBOLS[source[0].value];
    const row = geo.row[preferred] + 1;
    const col = geo.col[preferred] + 1;
    const reason = source[0].reason;
    hintVisual = {
      index: preferred,
      value: source[0].value,
      cells: reason.kind === 'cell' ? [preferred] : reason.cells,
      blockers: reason.kind === 'cell'
        ? geo.peers[preferred].filter(i => game.values[i] >= 0)
        : [],
      options,
    };
    const reasonKey = ['hintRow', 'hintColumn', 'hintBox'][reason.kind];
    const explanation = reason.kind === 'cell'
      ? t('hintCell', { value, row, col })
      : t(reasonKey, { value, row, col, unit: reason.index + 1 });
    const reasonMessage = reason.kind === 'cell'
      ? { key: 'hintCell', params: { value, row, col } }
      : { key: reasonKey, params: { value, row, col, unit: reason.index + 1 } };
    setStatus(t('hint', { reason: explanation }), false, 'helpful', { key: 'hint', reason: reasonMessage });
    setGuideKeyHighlight(value);
    animate(cells[preferred], 'sdk-flash', 0);
    return { index: preferred, value, row, col };
  }

  function animateCompanionMood(mood) {
    if (!companionEl) return;
    const className = mood === 'concerned'
      ? 'sdk-companion-animate-tilt'
      : (mood === 'celebrating' || mood === 'helpful')
        ? 'sdk-companion-animate-nod'
        : null;
    if (!className) {
      companionEl.classList.remove('sdk-companion-animate-nod', 'sdk-companion-animate-tilt');
      return;
    }
    companionEl.classList.remove('sdk-companion-animate-nod', 'sdk-companion-animate-tilt');
    void companionEl.offsetWidth;
    companionEl.classList.add(className);
    companionEl.addEventListener('animationend', () => {
      companionEl.classList.remove(className);
    }, { once: true });
  }

  function setStatus(text, solved = false, mood = 'idle', message = null) {
    statusMessage = message;
    statusMood = mood;
    statusEl.textContent = text;
    statusEl.classList.toggle('sdk-solved', solved);
    if (companionSpeech) {
      const next = message ? renderMessage(message) : text || t('companionIdle');
      companionSpeech.classList.add('sdk-message-fade');
      setTimeout(() => {
        companionSpeech.textContent = next;
        void companionSpeech.offsetWidth;
        companionSpeech.classList.remove('sdk-message-fade');
      }, 80);
    }
    if (companionEl) {
      companionEl.dataset.mood = mood;
      if (mood === 'celebrating' || mood === 'helpful' || mood === 'concerned') {
        animateCompanionMood(mood);
      } else {
        animateCompanionMood('idle');
      }
    }
  }

  function select(i, focus) {
    selected = i;
    renderBoard();
    if (cells[i]) {
      if (focus) cells[i].focus();
    }
  }

  function setNotesMode(on) {
    notesMode = on;
    notesBtn.setAttribute('aria-pressed', String(on));
  }

  function cancelEraseHold() {
    if (eraseHoldFrame) {
      clearTimeout(eraseHoldFrame);
      eraseHoldFrame = 0;
    }
    if (eraseHoldBtn) {
      eraseHoldBtn.style.setProperty('--erase-progress', '0%');
      eraseHoldBtn.classList.remove('is-holding');
      eraseHoldBtn = null;
    }
  }

  function suppressNextEraseClick() {
    suppressEraseClick = true;
    clearTimeout(suppressEraseClickTimer);
    suppressEraseClickTimer = setTimeout(() => {
      suppressEraseClick = false;
      suppressEraseClickTimer = 0;
    }, 1000);
  }

  function startEraseHold(button, pointerId) {
    if (!button || !game) return;
    cancelEraseHold();
    suppressEraseClick = false;
    clearTimeout(suppressEraseClickTimer);
    suppressEraseClickTimer = 0;
    eraseHoldTriggered = false;
    eraseHoldBtn = button;
    eraseHoldStart = performance.now();
    eraseHoldBtn.classList.add('is-holding');
    if (pointerId !== undefined && button.setPointerCapture) {
      try { button.setPointerCapture(pointerId); } catch {}
    }
    const tick = () => {
      const elapsed = performance.now() - eraseHoldStart;
      const progress = Math.min(100, (elapsed / ERASE_HOLD_MS) * 100);
      if (eraseHoldBtn) {
        eraseHoldBtn.style.setProperty('--erase-progress', `${progress}%`);
      }
      if (progress >= 100) {
        const completedBtn = eraseHoldBtn;
        eraseHoldTriggered = true;
        suppressNextEraseClick();
        cancelEraseHold();
        erase();
        if (completedBtn && completedBtn.isConnected) {
          completedBtn.style.setProperty('--erase-progress', '100%');
          setTimeout(() => completedBtn.style.setProperty('--erase-progress', '0%'), 120);
        }
        return;
      }
      eraseHoldFrame = setTimeout(tick, 16);
    };
    eraseHoldFrame = setTimeout(tick, 16);
  }

  // A game with numbers or notes on the board counts as in progress.
  function midGame() {
    return Boolean(game) && !isSolved() && (hasProgress() || game.notes.some(n => n));
  }

  // Unfinished work is only thrown away after an explicit yes.
  function askNewGame() {
    if (!midGame()) return newGame();
    askConfirm(t('confirmNew'), newGame);
  }

  function askConfirm(text, onOk, onCancel) {
    if (!confirmDlg) buildConfirmDialog();
    pauseClock();   // a question is not play time
    confirmDlg.querySelector('.sdk-confirm-text').textContent = text;
    confirmDlg.querySelector('[data-confirm="ok"]').textContent = t('confirmOk');
    confirmDlg.querySelector('[data-confirm="cancel"]').textContent = t('confirmCancel');
    confirmAction = { onOk, onCancel };
    confirmDlg.returnValue = '';
    confirmDlg.showModal();
  }

  function buildConfirmDialog() {
    confirmDlg = document.createElement('dialog');
    confirmDlg.className = 'sdk-confirm';
    confirmDlg.setAttribute('role', 'alertdialog');
    confirmDlg.setAttribute('aria-describedby', 'sdkConfirmText');
    confirmDlg.innerHTML = `
      <p class="sdk-confirm-text" id="sdkConfirmText"></p>
      <div class="sdk-confirm-actions">
        <button type="button" class="btn btn-sm" data-confirm="cancel" autofocus></button>
        <button type="button" class="btn btn-sm sdk-confirm-ok" data-confirm="ok"></button>
      </div>`;
    document.body.appendChild(confirmDlg);
    confirmDlg.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button && button.dataset.confirm) confirmDlg.close(button.dataset.confirm);
    });
    // Escape counts as "Keep playing".
    confirmDlg.addEventListener('close', () => {
      const action = confirmAction;
      confirmAction = null;
      resumeClock();
      if (!action) return;
      if (confirmDlg.returnValue === 'ok') action.onOk();
      else if (action.onCancel) action.onCancel();
    });
  }

  // ── Events ──

  function onPointerHold(e) {
    const t = e.target.closest('button');
    if (!t || t.dataset.act !== 'erase') return;
    if (e.type === 'pointerdown') {
      startEraseHold(t, e.pointerId);
      return;
    }
    if (e.type === 'pointerup') {
      const wasHolding = eraseHoldBtn === t;
      const heldLongEnough = wasHolding && performance.now() - eraseHoldStart >= ERASE_HOLD_MS;
      if (heldLongEnough && !eraseHoldTriggered) {
        eraseHoldTriggered = true;
        suppressNextEraseClick();
        erase();
      }
      cancelEraseHold();
      eraseHoldTriggered = false;
      if (e.pointerId !== undefined && t.releasePointerCapture) {
        try { t.releasePointerCapture(e.pointerId); } catch {}
      }
      return;
    }
    if (e.type === 'pointercancel' || e.type === 'pointerleave') {
      cancelEraseHold();
      eraseHoldTriggered = false;
      if (e.type === 'pointercancel') {
        suppressEraseClick = false;
        clearTimeout(suppressEraseClickTimer);
        suppressEraseClickTimer = 0;
      }
      if (e.pointerId !== undefined && t.releasePointerCapture) {
        try { t.releasePointerCapture(e.pointerId); } catch {}
      }
    }
  }

  function pulsePadKey(key) {
    if (!key || !key.classList) return;
    key.classList.remove('is-ripple');
    void key.offsetWidth;
    key.classList.add('is-ripple');
  }

  function onClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'close') return dialog.close();
    if (t.dataset.act === 'sound') return setSound(!soundOn);
    if (t.dataset.act === 'animations') return setAnimations(!animationsOn);
    if (t.dataset.act === 'erase') {
      if (suppressEraseClick) {
        suppressEraseClick = false;
        clearTimeout(suppressEraseClickTimer);
        suppressEraseClickTimer = 0;
        return;
      }
      return eraseSelected();
    }
    if (t.dataset.sym !== undefined) {
      pulsePadKey(t);
      return enter(Number(t.dataset.sym));
    }
    if (t.dataset.act === 'share') return openShare();
    if (t.dataset.level) return pickLevel(t.dataset.level);
    if (!game) return;
    if (t.dataset.cell !== undefined) return select(Number(t.dataset.cell), true);
    const actions = {
      notes: () => setNotesMode(!notesMode),
      undo,
      check,
      guide: () => setGuideMode(!(guideBtn && guideBtn.getAttribute('aria-pressed') === 'true')),
      new: askNewGame,
    };
    actions[t.dataset.act]?.();
  }

  function onBoardKey(e) {
    if (!game || selected < 0) return;
    const target = e.target;
    const isCell = target instanceof Element && target.closest('.sdk-cell');
    if (!isCell && !e.key.startsWith('Arrow')) return;
    if (target instanceof Element && target.closest('select, input, textarea, [contenteditable="true"]')) return;
    const n = geo.n;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const r = geo.row[selected], c = geo.col[selected];
    const moves = {
      ArrowUp: r > 0 ? -n : 0,
      ArrowDown: r < n - 1 ? n : 0,
      ArrowLeft: c > 0 ? -1 : 0,
      ArrowRight: c < n - 1 ? 1 : 0,
    };
    if (e.key in moves) {
      e.preventDefault();
      if (moves[e.key]) select(selected + moves[e.key], true);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); return erase(); }
    if (e.key.toLowerCase() === 'n') return setNotesMode(!notesMode);
    if (!isSolved() && e.key.toLowerCase() === 'c') return check();
    if (!isSolved() && e.key.toLowerCase() === 'g') return setGuideMode(!(guideBtn && guideBtn.getAttribute('aria-pressed') === 'true'));
    const symbol = SYMBOLS.indexOf(e.key.toUpperCase());
    if (e.key.length === 1 && symbol >= 0 && symbol < n) { e.preventDefault(); enter(symbol); }
  }

  function buildUi() {
    dialog = document.createElement('dialog');
    dialog.className = 'sdk';
    dialog.setAttribute('aria-labelledby', 'sdkTitle');
    dialog.innerHTML = `
      <div class="sdk-head">
        <h2 id="sdkTitle">${t('title')}</h2>
        <span class="sdk-head-tools">
          <label class="lang-select-wrap" style="display:inline-flex;align-items:center;gap:0.35rem;">
            <span class="lang-label">${t('language')}</span>
            <select class="lang-select" aria-label="${t('language')}" data-act="language">
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </label>
          <button type="button" class="sound-toggle" data-act="sound" aria-pressed="false" aria-label="${t('soundOn')}" role="switch">
            <span>${t('sound')}</span>
            <span class="sound-toggle-track" aria-hidden="true">
              <span class="sound-toggle-thumb"></span>
            </span>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="close">${t('close')}</button>
        </span>
      </div>
      <div class="sdk-play">
        <section class="sdk-companion" aria-label="Kitchen helper" data-mood="idle">
          <svg class="sdk-kitchen-backdrop" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">
            <rect width="600" height="160" fill="#eee3c8"/>
            <rect width="600" height="8" fill="#6b493d"/>
            <rect y="8" width="600" height="67" fill="#c7ded0"/>
            <rect x="192" y="9" width="216" height="64" rx="3" fill="#76503f"/>
            <rect x="199" y="15" width="202" height="52" fill="#dfc99e"/>
            <rect x="205" y="20" width="190" height="42" fill="#8db8ad"/>
            <path d="M205 27h190M205 37h190M205 47h190M205 57h190" stroke="#e6d6b1" stroke-width="5"/>
            <path d="M225 20v42M252 20v42M279 20v42M306 20v42M333 20v42M360 20v42M387 20v42" stroke="#527c71" stroke-width="3"/>
            <rect x="28" y="18" width="116" height="55" fill="#bd9770"/>
            <rect x="34" y="23" width="104" height="45" fill="#e9d6ae"/>
            <path d="M86 24v43M35 45h102" stroke="#8a6048" stroke-width="3"/>
            <rect x="452" y="18" width="120" height="55" fill="#bd9770"/>
            <rect x="458" y="23" width="108" height="45" fill="#e9d6ae"/>
            <path d="M512 24v43M459 45h106" stroke="#8a6048" stroke-width="3"/>
            <rect y="75" width="600" height="68" fill="#f1e5cb"/>
            <path d="M0 77h600" stroke="#6f5948" stroke-width="5"/>
            <path d="M0 113h600" stroke="#c9b99a" stroke-width="2"/>
            <g fill="#80aaa0" stroke="#52786f" stroke-width="2">
              <path d="M0 81h40v30H0zM80 81h40v30H80zM160 81h40v30H160zM240 81h40v30H240zM320 81h40v30H320zM400 81h40v30H400zM480 81h40v30H480zM560 81h40v30h-40z"/>
            </g>
            <g fill="#f0c677">
              <path d="M20 85l6 6-6 6-6-6zM100 85l6 6-6 6-6-6zM180 85l6 6-6 6-6-6zM260 85l6 6-6 6-6-6zM340 85l6 6-6 6-6-6zM420 85l6 6-6 6-6-6zM500 85l6 6-6 6-6-6zM580 85l6 6-6 6-6-6z"/>
            </g>
            <g fill="#c85e55">
              <path d="M40 86l6 6-6 6-6-6zM120 86l6 6-6 6-6-6zM200 86l6 6-6 6-6-6zM280 86l6 6-6 6-6-6zM360 86l6 6-6 6-6-6zM440 86l6 6-6 6-6-6zM520 86l6 6-6 6-6-6z"/>
            </g>
            <rect x="8" y="101" width="584" height="8" fill="#d9c6a1"/>
            <g fill="#8eb5a6" stroke="#52786f" stroke-width="2">
              <path d="M40 114h40v28H40zM120 114h40v28h-40zM200 114h40v28h-40zM280 114h40v28h-40zM360 114h40v28h-40zM440 114h40v28h-40zM520 114h40v28h-40z"/>
            </g>
            <g fill="#c85e55">
              <path d="M60 116l6 6-6 6-6-6zM140 116l6 6-6 6-6-6zM220 116l6 6-6 6-6-6zM300 116l6 6-6 6-6-6zM380 116l6 6-6 6-6-6zM460 116l6 6-6 6-6-6zM540 116l6 6-6 6-6-6z"/>
            </g>
            <rect y="144" width="600" height="16" fill="#654638"/>
            <rect y="144" width="600" height="4" fill="#d5b382"/>
            <rect x="493" y="126" width="54" height="15" rx="4" fill="#414e4d"/>
            <path d="M499 125c-6-9 6-8 1-17M519 125c-6-9 6-8 1-17M539 125c-6-9 6-8 1-17" fill="none" stroke="#fff9ec" stroke-width="3"/>
          </svg>
          <img class="sdk-companion-character" src="./assets/kitchen-companion.png" alt="Pixel-art portrait of the smiling, silver-haired subject wearing glasses">
          <svg class="sdk-companion-blink" viewBox="0 0 768 768" aria-hidden="true">
            <path d="M224 374h12v-5h18v-4h46v4h17v5h10v18h-8v8h-18v4h-47v-4h-18v-5h-10zM435 374h12v-5h18v-4h46v4h17v5h10v18h-8v8h-18v4h-47v-4h-18v-5h-10z" fill="#f7b986"/>
            <path d="M232 390h14v-4h16v-4h20v-2h18v3h14v4h10v5h-12v-4h-15v-3h-14v3h-18v4h-17v4h-16zM443 390h14v-4h16v-4h20v-2h18v3h14v4h10v5h-12v-4h-15v-3h-14v3h-18v4h-17v4h-16z" fill="#71384a"/>
            <path d="M246 402h14v3h20v2h27v-3h13v4h-14v4h-44v-4h-16zM457 402h14v3h20v2h27v-3h13v4h-14v4h-44v-4h-16z" fill="#e69a79"/>
            <path d="M251 402h55v2h-55zM462 402h55v2h-55z" fill="#fbd0a7"/>
          </svg>
          <p class="sdk-companion-speech" aria-hidden="true">${t('companionIdle')}</p>
        </section>
        <div class="sdk-meta">
          <div class="sdk-levels" role="group" aria-label="${t('level')}">
            <button type="button" class="sdk-level" data-level="easy">${t('levelEasy')}</button>
            <button type="button" class="sdk-level" data-level="medium">${t('levelMedium')}</button>
            <button type="button" class="sdk-level" data-level="hard">${t('levelHard')}</button>
          </div>
          <div class="sdk-stats">
            <span class="sdk-stat-main"></span>
            <span class="sdk-stat-best"></span>
          </div>
        </div>
        <div class="sdk-board" role="group"></div>
        <p class="sdk-status visually-hidden" role="status"></p>
        <div class="sdk-pad" role="group" aria-label="Numbers"></div>
        <div class="sdk-tools">
          <button type="button" class="btn btn-sm" data-act="notes" aria-pressed="false">${t('notes')}</button>
          <button type="button" class="btn btn-sm" data-act="undo">${t('undo')}</button>
          <button type="button" class="btn btn-sm btn-erase" data-act="erase"><span>${t('erase')}</span></button>
          <button type="button" class="btn btn-sm" data-act="check">${t('check')}</button>
          <button type="button" class="btn btn-sm" data-act="guide" aria-pressed="false">${t('guide')}</button>
          <button type="button" class="btn btn-sm" data-act="new">${t('newGame')}</button>
        </div>
        <footer class="sdk-footer"><button type="button" class="btn btn-sm btn-ghost sdk-share-btn" data-act="share">${t('share')}</button> <span data-build-label>${t('build')}</span>: <span data-build-id>${BUILD_ID}</span></footer>
      </div>`;
    document.body.appendChild(dialog);
    board = dialog.querySelector('.sdk-board');
    companionEl = dialog.querySelector('.sdk-companion');
    companionSpeech = dialog.querySelector('.sdk-companion-speech');
    // Grow the speech text to the largest size that still fits the bubble.
    const fitSpeech = () => {
      const el = companionSpeech;
      if (!el || !el.clientWidth || !el.clientHeight) return;
      const cs = getComputedStyle(el);
      const availW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const range = document.createRange();
      range.selectNodeContents(el);
      const fits = (px) => {
        el.style.fontSize = px + 'px';
        const r = range.getBoundingClientRect();
        return r.height <= availH + 0.5 && r.width <= availW + 0.5;
      };
      let lo = 12, hi = 56;
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
      // Leave breathing room: 85% of the largest fit, never above 26px.
      el.style.fontSize = Math.min(lo * 0.85, 26) + 'px';
    };
    if (companionSpeech) {
      new MutationObserver(fitSpeech).observe(companionSpeech, { childList: true, characterData: true, subtree: true });
      if (typeof ResizeObserver === 'function') new ResizeObserver(fitSpeech).observe(companionSpeech);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSpeech);
    }
    pad = dialog.querySelector('.sdk-pad');
    metaEls = {
      group: dialog.querySelector('.sdk-levels'),
      levels: [...dialog.querySelectorAll('.sdk-level')],
      main: dialog.querySelector('.sdk-stat-main'),
      best: dialog.querySelector('.sdk-stat-best'),
    };
    statusEl = dialog.querySelector('.sdk-status');
    notesBtn = dialog.querySelector('[data-act="notes"]');
    newBtn = dialog.querySelector('[data-act="new"]');
    soundBtn = dialog.querySelector('[data-act="sound"]');
    guideBtn = dialog.querySelector('[data-act="guide"]');
    gameActionButtons = [...dialog.querySelectorAll(
      '[data-act="undo"], [data-act="erase"], [data-act="notes"], [data-act="check"], [data-act="guide"]'
    )];
    langSelect = dialog.querySelector('[data-act="language"]');
    buildLabel = dialog.querySelector('[data-build-label]');
    const eraseBtn = dialog.querySelector('[data-act="erase"]');
    if (STANDALONE) dialog.querySelector('[data-act="close"]').remove();
    langSelect.value = currentLang;
    langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
    setSound(soundOn);
    setLanguage(currentLang);
    eraseBtn.addEventListener('pointerdown', onPointerHold);
    eraseBtn.addEventListener('pointerup', onPointerHold);
    eraseBtn.addEventListener('pointercancel', onPointerHold);
    eraseBtn.addEventListener('pointerleave', onPointerHold);
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('keydown', onBoardKey);
    pad.addEventListener('pointerover', onNumberPadPointer);
    pad.addEventListener('pointerout', onNumberPadPointer);
    dialog.addEventListener('close', () => {
      window.removeEventListener('resize', sizeBoard);
      pauseClock();
      saveGame();
    });
    clockTimer = setInterval(renderMeta, 1000);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sizeBoard());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { pauseClock(); saveGame(); } else resumeClock();
    });
    window.addEventListener('blur', () => { pauseClock(); saveGame(); });
    window.addEventListener('focus', resumeClock);
    window.addEventListener('pagehide', () => { pauseClock(); saveGame(); });
    window.addEventListener('hashchange', onSharedHash);
  }

  function openSudoku() {
    if (!dialog) buildUi();
    // Standalone, nothing sits behind it, so it opens non-modal: Esc can't close it.
    if (STANDALONE) dialog.show();
    else dialog.showModal();
    window.addEventListener('resize', sizeBoard);
    if (soundOn) startAmbientLoop();
    if (!game) return start();
    sizeBoard();
    resumeClock();
    cells[selected]?.focus();
  }

  if (STANDALONE) {
    if ('serviceWorker' in navigator && isSecureContext &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.error('Sudoku offline support registration failed:', error);
      });
    }
    return openSudoku();
  }

  const trigger = document.getElementById('appBuild');
  if (!trigger) return;
  let taps = 0;
  let lastTap = 0;
  function forceReloadBuild() {
    const url = new URL(location.href);
    url.searchParams.set('buildReload', String(Date.now()));
    url.searchParams.set('build', BUILD_ID);
    location.assign(url.toString());
  }
  trigger.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap <= DOUBLE_TAP_MS) {
      taps += 1;
      if (taps === 2) {
        forceReloadBuild();
        return;
      }
    } else {
      taps = 1;
    }
    lastTap = now;
    if (taps < TAPS_TO_OPEN) return;
    taps = 0;
    openSudoku();
  });
})();
