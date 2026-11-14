"""Layout check for sudoku.html.

Opens the page in a headless browser at several window sizes and in both
languages, then fails if the layout regresses:

  1. The header, banner, difficulty row, board, number pad and button row must
     share the board's left edge and width (within 2 pixels).
  2. The board must be centred in the window.
  3. Nothing may overflow sideways, and the dialog must not need to scroll
     sideways. Windows 700 pixels tall or more must not scroll vertically.
  4. No button label or stats line may be clipped.
  5. The speech bubble text must fit inside the bubble.
  6. The page must raise no script errors.

Setup (once):
    pip install playwright
    playwright install chromium

Run:
    python check_layout.py sudoku.html

Exit code 0 means every check passed, 1 means at least one failed.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

SIZES = [(390, 844), (644, 780), (768, 1024), (1280, 900), (1366, 768), (1920, 1080)]
LANGUAGES = ["en", "zh"]
ALIGN_TOLERANCE = 2
CENTRE_TOLERANCE = 12  # allows for a scrollbar

MEASURE = """() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  };
  const dialog = document.querySelector('.sdk');
  const d = dialog.getBoundingClientRect();
  const clipped = [...dialog.querySelectorAll('button, .sdk-stat-main, .sdk-stat-best')]
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'none')
    .map((el) => (el.textContent || el.className).trim().slice(0, 30));
  const outside = [...dialog.querySelectorAll('button, .sdk-stats')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.left < d.left - 1 || r.right > d.right + 1);
    })
    .map((el) => (el.textContent || el.className).trim().slice(0, 30));
  const speech = document.querySelector('.sdk-companion-speech');
  return {
    head: rect('.sdk-head'),
    companion: rect('.sdk-companion'),
    meta: rect('.sdk-meta'),
    board: rect('.sdk-board'),
    pad: rect('.sdk-pad'),
    tools: rect('.sdk-tools'),
    cells: document.querySelectorAll('.sdk-cell').length,
    dialogScrollW: dialog.scrollWidth,
    dialogClientW: dialog.clientWidth,
    dialogScrollH: dialog.scrollHeight,
    dialogClientH: dialog.clientHeight,
    pageScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    speechOverflow: speech ? speech.scrollHeight > speech.clientHeight + 1 : false,
    clipped,
    outside,
  };
}"""


def check(page_url, width, height, lang):
    problems = []
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script(
            "localStorage.setItem('sudoku_lang', %s)" % json.dumps(lang)
        )
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(page_url)
        page.wait_for_selector(".sdk-cell")
        page.wait_for_timeout(1000)
        m = page.evaluate(MEASURE)
        browser.close()

    board = m["board"]
    if m["cells"] != 81:
        problems.append("expected 81 cells, found %d" % m["cells"])
    for name in ("head", "companion", "meta", "pad", "tools"):
        r = m[name]
        if r is None:
            problems.append("%s is missing" % name)
            continue
        if abs(r["left"] - board["left"]) > ALIGN_TOLERANCE:
            problems.append(
                "%s left edge is %.0f, board is %.0f" % (name, r["left"], board["left"])
            )
        if abs(r["width"] - board["width"]) > ALIGN_TOLERANCE:
            problems.append(
                "%s width is %.0f, board is %.0f" % (name, r["width"], board["width"])
            )
    board_centre = (board["left"] + board["right"]) / 2
    if abs(board_centre - m["innerW"] / 2) > CENTRE_TOLERANCE:
        problems.append(
            "board centre is %.0f, window centre is %.0f" % (board_centre, m["innerW"] / 2)
        )
    if m["dialogScrollW"] > m["dialogClientW"] + 1:
        problems.append("dialog scrolls sideways")
    if m["pageScrollW"] > m["innerW"] + 1:
        problems.append("page scrolls sideways")
    if height >= 700 and m["dialogScrollH"] > m["dialogClientH"] + 1:
        problems.append(
            "dialog scrolls vertically (%d content in %d)"
            % (m["dialogScrollH"], m["dialogClientH"])
        )
    if m["clipped"]:
        problems.append("clipped text: %s" % ", ".join(m["clipped"]))
    if m["outside"]:
        problems.append("outside the dialog: %s" % ", ".join(m["outside"]))
    if m["speechOverflow"]:
        problems.append("speech bubble text overflows the bubble")
    for e in errors:
        problems.append("script error: %s" % e)
    return problems


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    path = Path(sys.argv[1]).resolve()
    if not path.exists():
        print("File not found: %s" % path)
        return 2
    url = path.as_uri()
    failures = 0
    for lang in LANGUAGES:
        for width, height in SIZES:
            problems = check(url, width, height, lang)
            label = "%s %dx%d" % (lang, width, height)
            if problems:
                failures += 1
                print("FAIL %s" % label)
                for item in problems:
                    print("     - %s" % item)
            else:
                print("ok   %s" % label)
    print()
    print("%d of %d combinations failed" % (failures, len(LANGUAGES) * len(SIZES)))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
