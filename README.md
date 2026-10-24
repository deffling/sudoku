# Sudoku

## Install on a phone or computer

The game can be installed as a web app when it is served from a secure HTTPS
site (or `localhost` for development). Opening `sudoku.html` directly as a
local file does not support installation or offline caching.

- **Android / desktop Chromium:** open the game and choose **Install app** or
  **Add to Home screen** in the browser menu.
- **iPhone / iPad:** open the game in Safari, tap **Share**, then **Add to Home
  Screen**.

After the first online load, the game shell is cached for offline play. Saved
games remain in the browser's local storage.

## Publish to GitHub Pages

Pushing to `main` builds and deploys the site with the triggering commit's
short hash in the footer. The service-worker cache is versioned with the full
commit hash, so each deployment installs the new app shell and removes older
cached shells. In the repository settings, set **Pages → Build and deployment
→ Source** to **GitHub Actions**.
