"""Gate for pushes that touch desk/. Run from the site repo root: python3 tools/check_desk.py

Fails (exit 1) if the desk would break or would publish something it must not:
  1. the root index.html no longer has the cards and "What I got wrong" items the desk parses;
  2. the lab's pick or evidence JSON lost a field the desk reads, or a chart carries real prices;
  3. a desk file shows recommendation wording (SITE_SPEC "Desk", DD4, and the SEBI rules);
  4. the order-block zone is drawn without its caption;
  5. a relative link or #anchor in desk/index.html points nowhere;
  6. desk/ grows past 1 MB.
Standard library only. Needs network for the lab JSON; no network is a failure, not a pass.
"""
import json, re, sys, urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESK = ROOT / "desk"
LAB = "Achintya1311/stockstalker-lab"
RAW = f"https://raw.githubusercontent.com/{LAB}/main/"
ZONE_CAPTION = "Not a level to act on"
# "buy-and-hold" is a research benchmark, not a call, so it is allowed.
BANNED = re.compile(r"\b(?:buy(?!-and-hold)|sell(?:ing)?|opportunit\w*|upside|stop[- ]?loss|entry price|price target|target price)\b|₹", re.I)


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links = set(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        for k in ("href", "src"):
            if a.get(k):
                self.links.append(a[k])


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "check_desk"}), timeout=20) as r:
        return json.load(r)


def banned_hits(text):
    # strip JS member access like e.target and SVG attrs like stop-color before scanning
    return BANNED.findall(re.sub(r"\.\w+|stop-color|stop-opacity", " ", text))


def check_root_contract(errors):
    html = (ROOT / "index.html").read_text()
    sec = re.search(r'id="findings".*?</section>', html, re.S)
    cards = re.findall(r'<article class="card.*?</article>', sec.group(0), re.S) if sec else []
    if not cards:
        errors.append("root index.html: no #findings .card for the desk to read")
    for i, c in enumerate(cards):
        if "<h3" not in c or 'class="stat"' not in c or "<span" not in c:
            errors.append(f"root index.html: finding card {i + 1} lacks h3 / .stat / span the desk parses")
    wrong = re.search(r'id="wrong".*?class="log".*?</(?:ol|ul)>', html, re.S)
    if not wrong or "<li" not in wrong.group(0):
        errors.append('root index.html: no #wrong .log li for "What I got wrong"')


def check_lab(errors):
    ev = get(RAW + "reports/evidence_train.json")
    for k in ("day/bullish", "day/bearish", "week/bullish", "week/bearish"):
        if "experiments" not in ev.get(k, {}):
            errors.append(f"lab evidence_train.json: {k}.experiments missing")
    for h in ("day", "week"):
        d = None
        for base in ("live", "reports/live_dryrun"):
            try:
                names = sorted(f["name"] for f in get(f"https://api.github.com/repos/{LAB}/contents/{base}/{h}") if f["name"].endswith(".json"))
            except Exception:
                continue
            if names:
                d = get(f"{RAW}{base}/{h}/{names[-1]}")
                break
        if d is None:
            errors.append(f"lab: no {h} picks file in live/ or reports/live_dryrun/")
            continue
        for k in ("session", "tables", "disclaimer"):
            if k not in d:
                errors.append(f"lab {h} picks: field '{k}' missing")
        for side in ("bullish", "bearish"):
            for p in d.get("tables", {}).get(side, []):
                if "symbol" not in p:
                    errors.append(f"lab {h} {side}: pick without symbol")
                c = p.get("chart") or {}
                vals = [v for bar in c.get("bars", []) for v in bar] + [c["zone"][k] for k in ("low", "high")] if c.get("zone") else [v for bar in c.get("bars", []) for v in bar]
                if any(not 0 <= v <= 100 for v in vals):
                    errors.append(f"lab {h} {side} {p.get('symbol')}: chart values outside 0-100, i.e. real prices")
                if banned_hits(p.get("reasoning", "")):
                    errors.append(f"lab {h} {side} {p.get('symbol')}: banned wording in reasoning")


def check_desk_files(errors):
    total = 0
    for f in sorted(DESK.rglob("*")):
        if not f.is_file():
            continue
        total += f.stat().st_size
        if f.suffix in (".html", ".js", ".css"):
            for n, line in enumerate(f.read_text().splitlines(), 1):
                for hit in banned_hits(line):
                    errors.append(f"{f.relative_to(ROOT)}:{n}: banned wording '{hit}'")
    import shutil, subprocess
    if shutil.which("node"):
        for f in sorted(DESK.glob("*.js")):
            if subprocess.run(["node", "--check", str(f)], capture_output=True).returncode:
                errors.append(f"{f.relative_to(ROOT)}: JavaScript syntax error")
        import tempfile, os
        for f in sorted(DESK.glob("*.html")):
            for k, m in enumerate(re.finditer(r"<script>(.*?)</script>", f.read_text(), re.S), 1):
                with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as t:
                    t.write(m.group(1))
                bad = subprocess.run(["node", "--check", t.name], capture_output=True).returncode
                os.unlink(t.name)
                if bad:
                    errors.append(f"{f.relative_to(ROOT)}: inline script {k} has a JavaScript syntax error")
    if total > 1_000_000:
        errors.append(f"desk/ is {total} bytes, over 1 MB")
    page = (DESK / "index.html").read_text()
    if 'class="skip"' not in page:
        errors.append("desk/index.html: no skip link")
    if re.search(r'<a class="nav"(?![^>]*aria-label)', page):
        errors.append("desk/index.html: nav link without aria-label")
    if "zone" in page and ZONE_CAPTION not in page:
        errors.append(f"desk/index.html draws the order-block zone without the caption '{ZONE_CAPTION}'")
    t = Tags()
    t.feed(page)
    for link in t.links:
        if link.startswith(("http", "mailto:", "data:", "${", "javascript:")) or "${" in link:
            continue
        if link.startswith("#"):
            if link[1:] and link[1:] not in t.ids:
                errors.append(f"desk/index.html: anchor {link} has no matching id")
            continue
        if not (DESK / link.split("#")[0].split("?")[0]).resolve().exists():
            errors.append(f"desk/index.html: link {link} points to a missing file")


def selftest():
    assert banned_hits("Buy the dip") and banned_hits("upside of 20%") and banned_hits("₹500")
    assert not banned_hits("beat buy-and-hold after costs")
    assert not banned_hits("e.target.closest('x')") and not banned_hits('<stop stop-color="red">')


def main():
    selftest()
    errors = []
    check_root_contract(errors)
    check_desk_files(errors)
    try:
        check_lab(errors)
    except Exception as e:  # no network or the lab moved: cannot verify, so do not pass
        errors.append(f"lab JSON could not be checked: {e}")
    for e in errors:
        print("FAIL", e)
    print("check_desk:", "FAIL" if errors else "PASS", f"({len(errors)} problems)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
