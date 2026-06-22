#!/usr/bin/env python3
"""
Convert usermanual.md → a polished PDF for the end user.

Usage:
  python3 make_manual_pdf.py

If WeasyPrint or Markdown aren't installed, this script tries to install
them via pip on first run. After that, every run is fast.

Output: "Powerful Weapon - User Manual.pdf" in the same folder as this script.
"""

import os
import sys
import re
import subprocess
from datetime import date
from pathlib import Path


def _bootstrap_dyld_for_homebrew():
    """
    WeasyPrint loads native libraries (Pango, Cairo, GObject) via cffi/ctypes.
    On Apple Silicon Macs, Homebrew installs to /opt/homebrew/lib/, which is
    not on dyld's default search path. Set DYLD_FALLBACK_LIBRARY_PATH and
    re-exec ourselves so the loader picks it up at process start.
    """
    if sys.platform != "darwin":
        return
    brew_libs = ["/opt/homebrew/lib", "/usr/local/lib"]
    needed = [p for p in brew_libs if os.path.exists(p)]
    if not needed:
        return
    existing = os.environ.get("DYLD_FALLBACK_LIBRARY_PATH", "")
    if all(p in existing for p in needed):
        return
    new_path = ":".join(needed + ([existing] if existing else []))
    if os.environ.get("_POWERFUL_WEAPON_PDF_RELAUNCHED") == "1":
        return  # already retried once; don't loop
    os.environ["DYLD_FALLBACK_LIBRARY_PATH"] = new_path
    os.environ["_POWERFUL_WEAPON_PDF_RELAUNCHED"] = "1"
    os.execvpe(sys.executable, [sys.executable, *sys.argv], os.environ)


_bootstrap_dyld_for_homebrew()

HERE = Path(__file__).resolve().parent
SRC_MD = HERE / "usermanual.md"
OUT_PDF = HERE / "Powerful Weapon - User Manual.pdf"


def ensure_deps():
    """Install markdown + weasyprint if they aren't already available."""
    missing = []
    try:
        import markdown  # noqa: F401
    except ImportError:
        missing.append("markdown")
    try:
        import weasyprint  # noqa: F401
    except ImportError:
        missing.append("weasyprint")

    if not missing:
        return

    print(f"Installing required packages: {', '.join(missing)}")
    print("(One-time setup, may take 30-60 seconds.)\n")
    # Try --user first; if pip rejects (PEP 668 / externally-managed env),
    # fall back to --break-system-packages.
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--user", *missing]
        )
    except subprocess.CalledProcessError:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install",
             "--user", "--break-system-packages", *missing]
        )

    # After installing, the freshly-added packages aren't in sys.path yet.
    # Add the user site-packages dir and refresh import caches.
    import site
    import importlib
    user_site = site.getusersitepackages()
    if user_site not in sys.path:
        sys.path.insert(0, user_site)
    importlib.invalidate_caches()

    # Verify the imports actually work now.
    try:
        import markdown  # noqa: F401
        import weasyprint  # noqa: F401
    except ImportError as e:
        print(f"\n❌ Installation succeeded but the modules still can't be imported.")
        print(f"   Error: {e}")
        print(f"   User site: {user_site}")
        print(f"\n   Try re-running this script — sometimes a second run picks them up.")
        sys.exit(1)


# Styling for the PDF. Brand palette matches the app (indigo/violet on white).
CSS = r"""
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @bottom-center {
    content: "Powerful Weapon · User Manual · Page " counter(page) " of " counter(pages);
    font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 9pt;
    color: #8b91b3;
  }
}

@page :first {
  margin: 0;
  @bottom-center { content: none; }
}

* { box-sizing: border-box; }

html, body {
  font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #1f2440;
  margin: 0;
  padding: 0;
}

/* ---------- Cover page ---------- */
.cover {
  page-break-after: always;
  background: linear-gradient(135deg, #4854c4 0%, #5b6ee1 50%, #7c8eea 100%);
  color: white;
  height: 297mm;
  width: 210mm;
  margin: 0;
  padding: 60mm 25mm 30mm 25mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.cover .badge {
  font-size: 11pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.85;
  margin-bottom: 8mm;
}
.cover h1 {
  font-size: 52pt;
  font-weight: 800;
  margin: 0 0 6mm 0;
  letter-spacing: -0.02em;
  line-height: 1.05;
  color: white;
}
.cover .subtitle {
  font-size: 16pt;
  font-weight: 400;
  opacity: 0.92;
  margin: 0 0 14mm 0;
  max-width: 130mm;
  line-height: 1.45;
}
.cover .footer {
  border-top: 1px solid rgba(255,255,255,0.35);
  padding-top: 6mm;
  font-size: 10pt;
  opacity: 0.85;
}
.cover .footer .row { display: flex; justify-content: space-between; }

/* ---------- Headings ---------- */
h1, h2, h3, h4 {
  font-weight: 700;
  color: #1f2440;
  page-break-after: avoid;
  break-after: avoid;
}
h1 { font-size: 22pt; margin: 12mm 0 5mm 0; color: #3a44a3; }
h2 {
  font-size: 16pt;
  margin: 9mm 0 3mm 0;
  padding-bottom: 1.5mm;
  border-bottom: 2px solid #e8edff;
  color: #4854c4;
  page-break-before: auto;
}
h3 {
  font-size: 13pt;
  margin: 6mm 0 2mm 0;
  color: #4854c4;
}
h4 {
  font-size: 11.5pt;
  margin: 5mm 0 1.5mm 0;
  color: #5b6ee1;
}

/* Section-start page break — every Part triggers a new page */
h2 + p { margin-top: 0; }
hr + h2 { margin-top: 0; }
h2.section-start { page-break-before: always; }

/* ---------- Paragraphs & lists ---------- */
p {
  margin: 0 0 3.5mm 0;
  orphans: 3;
  widows: 3;
}
ul, ol { margin: 0 0 4mm 0; padding-left: 6mm; }
li { margin-bottom: 1.2mm; }
li > p { margin-bottom: 1.2mm; }

strong { color: #1f2440; font-weight: 600; }
em { color: #4854c4; }

/* ---------- Inline code & code blocks ---------- */
code {
  font-family: "SF Mono", "Consolas", "Menlo", monospace;
  background: #eef1ff;
  color: #3a44a3;
  padding: 0.5mm 1.5mm;
  border-radius: 1mm;
  font-size: 9.5pt;
}
pre {
  background: #f5f7ff;
  border: 1px solid #e8edff;
  border-left: 3px solid #5b6ee1;
  border-radius: 1.5mm;
  padding: 3mm 4mm;
  font-size: 9.5pt;
  overflow-x: auto;
  page-break-inside: avoid;
  margin: 3mm 0 4mm 0;
}
pre code {
  background: transparent;
  padding: 0;
  color: #1f2440;
}

/* ---------- Tables ---------- */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 3mm 0 5mm 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
th {
  background: #eef1ff;
  color: #3a44a3;
  text-align: left;
  padding: 2.5mm 3mm;
  font-weight: 600;
  border-bottom: 2px solid #c5cdf5;
}
td {
  padding: 2mm 3mm;
  border-bottom: 1px solid #e8edff;
  vertical-align: top;
}
tr:nth-child(even) td { background: #fafbff; }

/* ---------- Blockquotes → callouts ---------- */
blockquote {
  margin: 3mm 0 4mm 0;
  padding: 3mm 4mm 3mm 5mm;
  border-left: 4px solid #5b6ee1;
  background: #f5f7ff;
  border-radius: 0 1.5mm 1.5mm 0;
  color: #2a305a;
  page-break-inside: avoid;
}
blockquote p { margin-bottom: 1.5mm; }
blockquote p:last-child { margin-bottom: 0; }

/* Tip / warning variants (driven by emoji in the first paragraph) */
blockquote.tip { border-left-color: #16a34a; background: #f0fdf4; }
blockquote.tip strong { color: #166534; }
blockquote.warning { border-left-color: #f59e0b; background: #fffbeb; }
blockquote.warning strong { color: #92400e; }

/* ---------- Horizontal rule ---------- */
hr {
  border: 0;
  border-top: 1px solid #d8def0;
  margin: 8mm 0;
}

/* ---------- Table of contents ---------- */
.toc {
  page-break-after: always;
  padding: 0;
}
.toc h1 { margin-top: 4mm; }
.toc ol { list-style: none; padding-left: 0; }
.toc li {
  display: flex;
  justify-content: space-between;
  padding: 1.5mm 0;
  border-bottom: 1px dotted #d8def0;
  font-size: 11pt;
}
.toc li.h2 { font-weight: 600; margin-top: 3mm; }
.toc li.h3 { padding-left: 6mm; font-size: 10pt; color: #5a6080; }

/* Section icon decorations */
h2 .emoji, h3 .emoji { margin-right: 1mm; }

/* Avoid splitting a paragraph immediately before/after a heading */
h1, h2, h3, h4 { page-break-after: avoid; }
table, pre, blockquote { page-break-inside: avoid; }
"""


def render_cover() -> str:
    today = date.today().strftime("%B %Y")
    return f"""
<section class="cover">
  <div>
    <div class="badge">USER MANUAL</div>
    <h1>Powerful<br/>Weapon</h1>
    <p class="subtitle">
      A weekly Tamil Bible study companion — pick verses, send them
      to your WhatsApp group, and grade voice-note recitations.
    </p>
  </div>
  <div class="footer">
    <div class="row">
      <span><strong>Version</strong> &nbsp; 0.1.0</span>
      <span><strong>For</strong> &nbsp; Mac &amp; Windows</span>
    </div>
    <div class="row" style="margin-top:3mm;">
      <span>{today}</span>
      <span>Built by Andrew Johnson</span>
    </div>
  </div>
</section>
"""


def build_toc(html: str) -> str:
    """Pull h1/h2/h3 headings out of the rendered HTML and build a TOC."""
    pattern = re.compile(r"<h([23])>(.*?)</h\1>", re.IGNORECASE | re.DOTALL)
    items = []
    for level, text in pattern.findall(html):
        clean = re.sub(r"<[^>]+>", "", text).strip()
        if not clean:
            continue
        items.append((int(level), clean))

    rows = ["<ol>"]
    for level, text in items:
        cls = f"h{level}"
        rows.append(f'<li class="{cls}"><span>{text}</span></li>')
    rows.append("</ol>")
    inner = "\n".join(rows)
    return f'<section class="toc"><h1>Table of contents</h1>{inner}</section>'


def style_callouts(html: str) -> str:
    """Tag blockquotes with classes so emoji-prefixed ones get coloured."""
    def replace(match: re.Match) -> str:
        body = match.group(1)
        cls = ""
        if "💡" in body[:60] or "Tip" in body[:30]:
            cls = ' class="tip"'
        elif "⚠️" in body[:60] or "Warning" in body[:30]:
            cls = ' class="warning"'
        return f"<blockquote{cls}>{body}</blockquote>"

    return re.sub(r"<blockquote>(.*?)</blockquote>", replace, html, flags=re.DOTALL)


def render_markdown(md_text: str) -> str:
    import markdown
    return markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "sane_lists", "smarty"],
    )


def build_html(md_text: str) -> str:
    body_html = render_markdown(md_text)
    body_html = style_callouts(body_html)

    # First <h1> is the title — drop it since we have a cover page.
    body_html = re.sub(r"<h1>.*?</h1>", "", body_html, count=1, flags=re.DOTALL)
    # First <h2> is "User Manual" — also drop, redundant.
    body_html = re.sub(r"<h2>\s*User Manual\s*</h2>", "", body_html, count=1, flags=re.IGNORECASE)

    toc_html = build_toc(body_html)
    cover_html = render_cover()

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Powerful Weapon — User Manual</title>
  <style>{CSS}</style>
</head>
<body>
{cover_html}
{toc_html}
<main>
{body_html}
</main>
</body>
</html>
"""


def main():
    if not SRC_MD.exists():
        print(f"❌ Source not found: {SRC_MD}")
        sys.exit(1)

    ensure_deps()

    print(f"📖  Reading {SRC_MD.name} ...")
    md_text = SRC_MD.read_text(encoding="utf-8")

    print("🎨  Rendering HTML with brand styling ...")
    html = build_html(md_text)

    debug_html = HERE / "_manual_debug.html"
    debug_html.write_text(html, encoding="utf-8")

    print("🖨️   Generating PDF (this can take ~10 seconds) ...")
    from weasyprint import HTML
    HTML(string=html, base_url=str(HERE)).write_pdf(str(OUT_PDF))

    debug_html.unlink(missing_ok=True)

    size_kb = OUT_PDF.stat().st_size / 1024
    print(f"\n✅  Done.")
    print(f"    Output: {OUT_PDF}")
    print(f"    Size:   {size_kb:.1f} KB")
    print(f"\n📤  Send this PDF to your friend along with the installer.")


if __name__ == "__main__":
    main()
