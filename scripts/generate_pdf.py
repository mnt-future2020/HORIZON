#!/usr/bin/env python3
"""
Generate a professionally styled PDF from LOBBI-Product-Bible.md
Uses markdown + weasyprint for high-quality PDF output
"""

import markdown
from weasyprint import HTML
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

MD_FILE = os.path.join(PROJECT_ROOT, "LOBBI-Product-Bible.md")
OUTPUT_PDF = os.path.join(PROJECT_ROOT, "LOBBI-Product-Bible.pdf")

# Read markdown
with open(MD_FILE, "r", encoding="utf-8") as f:
    md_content = f.read()

# Convert markdown to HTML
md_extensions = ["tables", "fenced_code", "codehilite", "toc", "nl2br"]
html_body = markdown.markdown(md_content, extensions=md_extensions)

# Professional CSS styling
css = """
@page {
    size: A4;
    margin: 2cm 2.5cm;
    @top-center {
        content: "LOBBI — Product Bible";
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 8pt;
        color: #888;
        padding-bottom: 0.5cm;
    }
    @bottom-center {
        content: counter(page);
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 9pt;
        color: #666;
    }
    @bottom-right {
        content: "Confidential";
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 7pt;
        color: #aaa;
    }
}

@page :first {
    @top-center { content: none; }
    @bottom-right { content: none; }
}

* {
    box-sizing: border-box;
}

body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a2e;
    max-width: 100%;
}

/* ── Cover / Title ── */
h1 {
    font-size: 32pt;
    font-weight: 800;
    color: #0f0f23;
    text-align: center;
    margin-top: 3cm;
    margin-bottom: 0.3cm;
    padding-bottom: 0.5cm;
    letter-spacing: -0.5pt;
    page-break-after: avoid;
}

h1 + h3 {
    text-align: center;
    font-size: 13pt;
    font-weight: 400;
    color: #4a4a6a;
    margin-top: 0;
    margin-bottom: 0.5cm;
    letter-spacing: 0.5pt;
}

h1 + h3 + p {
    text-align: center;
    font-size: 9pt;
    color: #777;
    margin-bottom: 2cm;
}

/* ── Section Headers ── */
h2 {
    font-size: 18pt;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    background-color: #1a1a2e;
    padding: 12pt 18pt;
    margin-top: 1.5cm;
    margin-bottom: 0.6cm;
    border-radius: 6pt;
    page-break-after: avoid;
    letter-spacing: 0.3pt;
}

h3 {
    font-size: 13pt;
    font-weight: 700;
    color: #16213e;
    border-bottom: 2.5pt solid #e94560;
    padding-bottom: 5pt;
    margin-top: 0.8cm;
    margin-bottom: 0.4cm;
    page-break-after: avoid;
}

h4 {
    font-size: 11.5pt;
    font-weight: 700;
    color: #2d2d5e;
    margin-top: 0.5cm;
    margin-bottom: 0.2cm;
    page-break-after: avoid;
}

/* ── Paragraphs & Text ── */
p {
    margin-bottom: 0.4cm;
    text-align: justify;
    orphans: 3;
    widows: 3;
}

strong {
    color: #16213e;
    font-weight: 700;
}

/* ── Blockquotes (for the one-line pitch, etc.) ── */
blockquote {
    border-left: 4pt solid #e94560;
    background-color: #fdf2f4;
    padding: 12pt 16pt;
    margin: 0.5cm 0;
    border-radius: 0 6pt 6pt 0;
    font-style: italic;
    font-size: 12pt;
    color: #333;
}

blockquote p {
    margin: 0;
    text-align: left;
}

/* ── Lists ── */
ul, ol {
    margin: 0.3cm 0 0.5cm 0.6cm;
    padding-left: 0.4cm;
}

li {
    margin-bottom: 3pt;
    line-height: 1.55;
}

li ul, li ol {
    margin-top: 2pt;
    margin-bottom: 2pt;
}

/* ── Tables ── */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5cm 0;
    font-size: 9.5pt;
    page-break-inside: auto;
}

thead {
    display: table-header-group;
}

tr {
    page-break-inside: avoid;
}

th {
    background-color: #1a1a2e;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 8pt 10pt;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
}

td {
    padding: 7pt 10pt;
    border-bottom: 1pt solid #e8e8ee;
    color: #333;
    vertical-align: top;
}

tr:nth-child(even) td {
    background-color: #f8f8fc;
}

tr:hover td {
    background-color: #f0f0f8;
}

/* ── Code Blocks (for flow diagrams, architecture) ── */
code {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    background-color: #f4f4f8;
    padding: 1pt 4pt;
    border-radius: 3pt;
    font-size: 9pt;
    color: #e94560;
}

pre {
    background-color: #1a1a2e;
    color: #e8e8f0;
    padding: 14pt 18pt;
    border-radius: 6pt;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 8.5pt;
    line-height: 1.5;
    overflow-x: auto;
    margin: 0.5cm 0;
    page-break-inside: avoid;
    white-space: pre-wrap;
    word-wrap: break-word;
}

pre code {
    background: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
}

/* ── Horizontal Rules ── */
hr {
    border: none;
    border-top: 2pt solid #e8e8ee;
    margin: 1cm 0;
}

/* ── Table of Contents styling ── */
h2 + ol, h2 + ul {
    columns: 2;
    column-gap: 1cm;
}

/* ── Checkbox lists (operations checklist) ── */
li input[type="checkbox"] {
    margin-right: 6pt;
}

/* ── Print optimizations ── */
h2 {
    page-break-before: auto;
}

h2, h3, h4 {
    page-break-after: avoid;
}

table, pre, blockquote {
    page-break-inside: avoid;
}

img {
    max-width: 100%;
}
"""

# Build full HTML document
full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>LOBBI - Product Bible</title>
    <style>{css}</style>
</head>
<body>
{html_body}
</body>
</html>"""

# Generate PDF
print("Generating PDF...")
html_doc = HTML(string=full_html, base_url=PROJECT_ROOT)
html_doc.write_pdf(OUTPUT_PDF)

file_size = os.path.getsize(OUTPUT_PDF)
print(f"PDF generated: {OUTPUT_PDF}")
print(f"File size: {file_size / 1024:.0f} KB")
