module.exports = {
  stylesheet: [],
  css: `
    @page {
      size: A4;
      margin: 2cm 2.2cm;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.65;
      color: #1a1a2e;
    }

    /* ── Cover Title ── */
    h1 {
      font-size: 34pt;
      font-weight: 800;
      color: #0f0f23;
      text-align: center;
      margin-top: 2.5cm;
      margin-bottom: 0.2cm;
      letter-spacing: -0.5pt;
      page-break-after: avoid;
    }

    h1 + h3 {
      text-align: center;
      font-size: 14pt;
      font-weight: 400;
      color: #4a4a6a;
      margin-top: 0;
      margin-bottom: 0.5cm;
      border: none;
      letter-spacing: 1pt;
    }

    h1 + h3 + p {
      text-align: center;
      font-size: 9pt;
      color: #777;
      margin-bottom: 2cm;
    }

    /* ── Section Headers ── */
    h2 {
      font-size: 17pt;
      font-weight: 700;
      color: #fff;
      background: #1a1a2e;
      padding: 10pt 16pt;
      margin-top: 1.2cm;
      margin-bottom: 0.5cm;
      border-radius: 5pt;
      page-break-after: avoid;
      letter-spacing: 0.3pt;
    }

    h3 {
      font-size: 12.5pt;
      font-weight: 700;
      color: #16213e;
      border-bottom: 2.5pt solid #e94560;
      padding-bottom: 4pt;
      margin-top: 0.7cm;
      margin-bottom: 0.35cm;
      page-break-after: avoid;
    }

    h4 {
      font-size: 11pt;
      font-weight: 700;
      color: #2d2d5e;
      margin-top: 0.4cm;
      margin-bottom: 0.15cm;
      page-break-after: avoid;
    }

    /* ── Text ── */
    p {
      margin-bottom: 0.3cm;
      text-align: justify;
      orphans: 3;
      widows: 3;
    }

    strong {
      color: #16213e;
    }

    /* ── Blockquotes ── */
    blockquote {
      border-left: 4pt solid #e94560;
      background-color: #fdf2f4;
      padding: 10pt 14pt;
      margin: 0.4cm 0;
      border-radius: 0 5pt 5pt 0;
    }

    blockquote p {
      margin: 0;
      font-style: italic;
      font-size: 12pt;
      color: #333;
      text-align: center;
    }

    /* ── Lists ── */
    ul, ol {
      margin: 0.2cm 0 0.4cm 0;
      padding-left: 1.2cm;
    }

    li {
      margin-bottom: 2pt;
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
      margin: 0.4cm 0;
      font-size: 9.5pt;
      page-break-inside: auto;
    }

    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }

    th {
      background-color: #1a1a2e;
      color: #fff;
      font-weight: 600;
      text-align: left;
      padding: 7pt 9pt;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }

    td {
      padding: 6pt 9pt;
      border-bottom: 1pt solid #e0e0ea;
      color: #333;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #f8f8fc;
    }

    /* ── Code Blocks ── */
    code {
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      background-color: #f0f0f6;
      padding: 1pt 4pt;
      border-radius: 3pt;
      font-size: 9pt;
      color: #e94560;
    }

    pre {
      background-color: #1a1a2e;
      color: #e0e0f0;
      padding: 12pt 16pt;
      border-radius: 5pt;
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 8.5pt;
      line-height: 1.5;
      margin: 0.4cm 0;
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
      border-top: 2pt solid #e0e0ea;
      margin: 0.8cm 0;
    }

    /* ── Print ── */
    h2, h3, h4 { page-break-after: avoid; }
    table, pre, blockquote { page-break-inside: avoid; }
  `,
  body_class: [],
  marked_options: {},
  pdf_options: {
    format: 'A4',
    margin: {
      top: '2cm',
      bottom: '2cm',
      left: '2.2cm',
      right: '2.2cm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8pt;color:#999;width:100%;text-align:center;font-family:Helvetica,Arial,sans-serif;padding:0 2.2cm;">LOBBI — Product Bible  |  Confidential</div>',
    footerTemplate: '<div style="font-size:9pt;color:#666;width:100%;text-align:center;font-family:Helvetica,Arial,sans-serif;padding:0 2.2cm;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  },
  launch_options: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};
