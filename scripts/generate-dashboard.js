const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Configurações de caminhos relativos ao diretório "scripts"
const MD_PATH = path.resolve(__dirname, '../project/implementation-status.md');
const HTML_OUTPUT_PATH = path.resolve(__dirname, '../project/implementation-status.html');

function generateDashboard() {
  if (!fs.existsSync(MD_PATH)) {
    console.error(`Error: MD file not found at ${MD_PATH}`);
    process.exit(1);
  }

  const mdContent = fs.readFileSync(MD_PATH, 'utf-8');
  
  // Converte Markdown para HTML
  const htmlContent = marked.parse(mdContent);

  // Template HTML com estilo "Caniuse"
  const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dot-Agent Spec | Implementation Status</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --text-color: #e2e8f0;
      --card-bg: #1e293b;
      --border-color: #334155;
      
      --status-implemented: #10b981; /* Green */
      --status-partial: #f59e0b; /* Yellow */
      --status-missing: #ef4444; /* Red */
      --status-dep: #3b82f6; /* Blue */
      --status-frozen: #64748b; /* Gray */
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 2rem;
    }

    header {
      margin-bottom: 3rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }

    h1, h2, h3 {
      color: #f8fafc;
      margin-top: 2rem;
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
    }

    h2 {
      font-size: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 4px;
      margin-bottom: 2rem;
      overflow-x: auto;
      display: block;
    }

    th, td {
      padding: 12px 16px;
      border-radius: 6px;
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      min-width: 150px;
      vertical-align: top;
      font-size: 0.9rem;
    }

    th {
      font-weight: 600;
      background-color: #0f172a;
      border-color: #475569;
      position: sticky;
      top: 0;
    }

    td:first-child, th:first-child {
      font-weight: 600;
      background-color: #1e293b;
      position: sticky;
      left: 0;
      z-index: 10;
      box-shadow: 2px 0 5px rgba(0,0,0,0.2);
    }

    td:hover {
      filter: brightness(1.2);
      transform: scale(1.02);
      transition: all 0.2s ease;
      cursor: default;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      z-index: 20;
      position: relative;
    }

    blockquote {
      background: rgba(59, 130, 246, 0.1);
      border-left: 4px solid var(--status-dep);
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: 0 8px 8px 0;
    }

    .cell-implemented { background-color: rgba(16, 185, 129, 0.2); border-color: var(--status-implemented); color: #a7f3d0; }
    .cell-partial { background-color: rgba(245, 158, 11, 0.2); border-color: var(--status-partial); color: #fde68a; }
    .cell-missing { background-color: rgba(239, 68, 68, 0.2); border-color: var(--status-missing); color: #fecaca; }
    .cell-dep { background-color: rgba(59, 130, 246, 0.2); border-color: var(--status-dep); color: #bfdbfe; }
    .cell-frozen { background-color: rgba(100, 116, 139, 0.2); border-color: var(--status-frozen); color: #e2e8f0; }

    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      background: var(--card-bg);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    input[type="text"] {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
      color: white;
      width: 300px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Dot-Agent Implementation Status</h1>
    <p>Interactive architecture and feature support overview.</p>
  </header>

  <div class="controls">
    <input type="text" id="searchInput" placeholder="Filter features...">
  </div>

  <main id="content">
    ${htmlContent}
  </main>

  <script>
    document.querySelectorAll('td').forEach(td => {
      const text = td.textContent || '';
      if (text.includes('✅') || text.includes('☑️')) td.classList.add('cell-implemented');
      else if (text.includes('⚠️')) td.classList.add('cell-partial');
      else if (text.includes('❌')) td.classList.add('cell-missing');
      else if (text.includes('🔄') || text.includes('→')) td.classList.add('cell-dep');
      else if (text.includes('🧊')) td.classList.add('cell-frozen');
    });

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll('tbody tr').forEach(row => {
        if (row.querySelector('th')) return;
        const rowText = row.textContent.toLowerCase();
        row.style.display = rowText.includes(term) ? '' : 'none';
      });
    });
  </script>
</body>
</html>
  `;

  fs.writeFileSync(HTML_OUTPUT_PATH, finalHtml);
  console.log("✅ HTML dashboard generated successfully at: " + HTML_OUTPUT_PATH);
}

generateDashboard();
