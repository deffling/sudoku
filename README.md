# Sudoku

A Sudoku game that runs in the browser and works offline once it has loaded.

- Easy, Medium and Hard puzzles, each proven to have exactly one solution.
- Pencil notes, undo, check, and a guide that explains the next step.
- A timer, a mistake count and a best time for each difficulty, kept in this browser.
- Share a puzzle by link, by 81-digit code or by quick response code. A link can carry
  your time, so a friend sees a time to beat.
- English and Simplified Chinese.

Starting a new game, changing the difficulty or opening a shared link while a game is in
progress asks first.

## Keyboard

| Key | Action |
| --- | --- |
| 1 to 9 | Place that number (or a pencil note when Notes is on) |
| Arrow keys | Move the selected cell |
| Backspace or Delete | Erase the selected cell |
| N | Turn Notes on or off |
| C | Check the board |
| G | Turn Guide on or off |
| Ctrl+Z (Cmd+Z on a Mac) | Undo |

Letter and number keys work while a cell is focused. The arrow keys work anywhere in the
game window except in text boxes and dropdowns.

## Files

| File | What it is |
| --- | --- |
| `sudoku.html` | The page: markup shell that loads the files below |
| `sudoku.css` | All styles |
| `sudoku.js` | The game: board, controls, clock, sharing, sound |
| `logic.js` | Puzzle logic with no page code: generator, solver, share codes (also run by the tests in Node) |
| `vendor/qrcode.min.js` | Quick response code generator, [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT license (`vendor/LICENSE-qrcode-generator.txt`) |
| `sw.js` | Service worker: offline play and updates |
| `manifest.webmanifest`, `icons/`, `assets/` | Install details, icons and the banner image |
| `index.html` | Redirects to `sudoku.html` |
| `tools/build-pages.mjs` | Copies the site to `dist/` and stamps the build id |
| `tests/` | Logic tests and the layout check |

Edit the source files directly. There is nothing to build to try the game locally: open
`sudoku.html` in a browser, or serve the folder (for example
`python -m http.server`) and open `http://localhost:8000/sudoku.html`.

## Tests

Puzzle logic (needs Node.js 22):

```
node --test "tests/*.test.mjs"
```

Layout check. It opens the page at six window sizes in both languages and fails if the
header, banner, difficulty row, board, number pad and buttons stop lining up, if anything
overflows or is clipped, or if the page raises a script error:

```
pip install playwright
playwright install chromium
python tests/check_layout.py sudoku.html
```

To check the built site instead, build it first (`node tools/build-pages.mjs`) and pass
`dist/sudoku.html`.

The same checks run in GitHub Actions on every push and pull request, and a push to
`main` is deployed only if they pass.

## Install on a phone or computer

The game can be installed as a web app when it is served from a secure HTTPS
site (or `localhost` for development). Opening `sudoku.html` directly as a
local file does not support installation, offline caching or the quick response code.

- **Android / desktop Chromium:** open the game and choose **Install app** or
  **Add to Home screen** in the browser menu.
- **iPhone / iPad:** open the game in Safari, tap **Share**, then **Add to Home
  Screen**.

After the first online load, the game is cached for offline play. The network is tried
first, so updates arrive straight away; on a slow connection the cached copy is used after
three seconds. Saved games remain in the browser's local storage.

## Publish to GitHub Pages

Pushing to `main` runs the tests, builds the site and deploys it with the triggering
commit's short hash in the footer. The service worker cache is versioned with the full
commit hash, so each deployment installs the new files and removes older cached ones. In
the repository settings, set **Pages → Build and deployment → Source** to **GitHub
Actions**.
