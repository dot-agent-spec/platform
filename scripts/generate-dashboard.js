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

  // Template HTML com estilo dot-agent.ai
  const finalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>.agent Spec | Implementation Status</title>
  
  <!-- Fonts do dot-agent.ai -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --font-display: 'Instrument Serif', Georgia, serif;
      --font-body: 'Inter', -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', monospace;

      --bg-primary: #0B0F19;
      --bg-secondary: #111827;
      --text-primary: #E8E6E3;
      --text-secondary: #9CA3AF;
      --text-dim: #6B7280;
      --border-subtle: rgba(255,255,255,0.04);
      --border-hover: rgba(255,255,255,0.15);
      
      /* Cores Oficiais da Marca */
      --color-green: #5BE87C;   /* Implemented ✅ */
      --color-yellow: #E8B44D;  /* Partial ⚠️ */
      --color-red: #E84545;     /* Missing ❌ */
      --color-cyan: #4DC8E8;    /* Dep/Ref 🔄 → */
      --color-frozen: #93c5fd;  /* Frozen 🧊 (Icy Blue) */
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-body);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 0;
      overflow-x: hidden;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #1F2937; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #374151; }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 60px 32px;
    }

    header {
      text-align: center;
    }

    .brand-label {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-cyan);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 16px;
      display: block;
    }

    h1 {
      font-family: var(--font-display);
      font-size: clamp(36px, 5vw, 56px);
      font-weight: 400;
      color: var(--text-primary);
      line-height: 1.12;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-family: var(--font-body);
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 800px; /* Aumentado para não criar viúva */
      margin: 0 auto;
    }

    .spectrum-divider {
      height: 1px;
      width: 100%;
      opacity: 0.4;
      background: linear-gradient(90deg, transparent 0%, #E84545 12%, #E8783F 25%, #E8B44D 40%, #5BE87C 55%, #4DC8E8 72%, #4D7CE8 88%, transparent 100%);
      margin: 40px 0;
    }

    /* Timeline */
    .timeline-container {
      margin: 48px auto 0;
      max-width: 80%; /* Timeline mais compacta 80% do width */
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      width: 100%;
    }
    
    .timeline-node {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 60px;
      flex-shrink: 0;
    }
    
    .timeline-node .circle {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bg-primary);
      border: 2px solid var(--text-dim);
      margin-bottom: 16px;
      transition: all 0.3s;
    }
    
    .timeline-node.done .circle {
      border-color: var(--color-green);
      background: var(--color-green);
      box-shadow: 0 0 10px rgba(91, 232, 124, 0.4);
    }
    
    .timeline-node.active .circle {
      border-color: var(--color-cyan);
      background: var(--color-cyan);
      box-shadow: 0 0 12px rgba(77, 200, 232, 0.6);
    }
    
    .timeline-node .label {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }
    
    .timeline-node.active .label, .timeline-node.done .label {
      color: var(--text-primary);
    }

    .timeline-segment {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 0 8px;
    }

    .segment-line {
      width: 100%;
      height: 2px;
      background: var(--border-subtle);
      margin-top: 7px; /* align center of 16px circle */
      margin-bottom: 15px; /* space between line and badge */
    }
    
    .segment-line.active {
      background: linear-gradient(90deg, var(--color-green), var(--color-cyan));
    }
    
    .segment-badge {
      background: var(--bg-secondary);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    
    .segment-badge.attention {
      color: var(--color-yellow);
      border-color: rgba(232, 180, 77, 0.3);
      background: rgba(232, 180, 77, 0.05);
    }

    /* Controls & Metrics */
    .dashboard-header {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      background: var(--bg-secondary);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
    }

    .metrics {
      display: flex;
      gap: 24px;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
    }

    .metric-value {
      font-family: var(--font-mono);
      font-size: 24px;
      color: var(--text-primary);
    }

    .metric-label {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-btn {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-secondary);
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border-subtle);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.02em;
    }

    .filter-btn:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    .filter-btn.active {
      background: rgba(77, 200, 232, 0.1);
      border-color: rgba(77, 200, 232, 0.4);
      color: var(--text-primary);
    }

    input[type="text"] {
      font-family: var(--font-body);
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: rgba(0,0,0,0.2);
      color: var(--text-primary);
      width: 250px;
      font-size: 14px;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: var(--color-cyan);
    }

    /* Tabs UI */
    .tabs-container {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--bg-primary); /* Fundo primário para não ver nada atrás */
      display: flex;
      gap: 12px;
      margin: 40px 0 24px;
      padding: 16px 0 12px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      padding: 8px 16px;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: var(--text-primary);
      background: rgba(255,255,255,0.02);
    }

    .tab-btn.active {
      color: var(--color-cyan);
      background: rgba(77, 200, 232, 0.1);
      box-shadow: inset 0 0 0 1px rgba(77, 200, 232, 0.2);
    }

    /* Typography inside content */
    main h1 {
      display: none; /* Hide markdown H1 as we have a custom header */
    }

    main h2 {
      position: sticky;
      top: 64px; /* Abaixo das Tabs */
      z-index: 90;
      background: var(--bg-primary); /* Para a tabela não vazar por trás */
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin: 48px 0 24px;
      padding: 16px 0;
    }

    main h2::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      height: 1px;
      width: 100%;
      opacity: 0.4;
      background: linear-gradient(90deg, transparent 0%, #E84545 12%, #E8783F 25%, #E8B44D 40%, #5BE87C 55%, #4DC8E8 72%, #4D7CE8 88%, transparent 100%);
    }

    main h3 {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 32px 0 16px;
    }

    .intro-text {
      font-size: 15px;
      color: var(--text-secondary);
      margin-bottom: 24px;
      max-width: 800px;
      line-height: 1.6;
    }

    .legend-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 16px 24px;
      margin-bottom: 16px;
      font-size: 13px;
      color: var(--text-dim);
      line-height: 2;
    }

    .legend-title {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-cyan);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      display: block;
      margin-bottom: 8px;
    }
    
    .legend-box code {
      background: rgba(0,0,0,0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-mono);
      color: var(--color-cyan);
      font-size: 11px;
    }

    main p {
      margin-bottom: 16px;
      color: var(--text-secondary);
    }

    blockquote {
      background: rgba(77, 200, 232, 0.05);
      border-left: 2px solid var(--color-cyan);
      padding: 16px 20px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
      color: var(--text-secondary);
      font-size: 15px;
    }

    hr {
      border: none;
      height: 0;
      margin: 40px 0;
    }

    /* Table Styles */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      margin-bottom: 40px;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
    }

    main table {
      display: table;
      table-layout: auto;
      width: 100%;
      min-width: 800px;
      border-collapse: collapse;
      text-align: left;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th, td {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-subtle);
      border-right: 1px solid var(--border-subtle);
      font-size: 14px;
      vertical-align: top;
    }

    th {
      position: sticky;
      top: 0;
      font-family: var(--font-mono);
      font-weight: 500;
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: var(--bg-secondary);
      white-space: nowrap;
      z-index: 80;
    }

    /* Células de Status */
    td {
      transition: all 0.2s ease;
    }

    .cell-implemented { background-color: rgba(91, 232, 124, 0.08); color: #86efac; }
    .cell-partial { background-color: rgba(232, 180, 77, 0.08); color: #fde047; }
    .cell-missing { background-color: rgba(232, 69, 69, 0.08); color: #fca5a5; }
    .cell-dep { background-color: rgba(77, 200, 232, 0.08); color: #7dd3fc; }
    
    /* Azul claro frosty para frozen columns */
    .cell-frozen { background-color: rgba(147, 197, 253, 0.08); color: var(--color-frozen); }

    /* Elegant dash for empty cells */
    .empty-dash {
      color: rgba(77, 200, 232, 0.4); /* Azul sutil/cyan */
      font-weight: 400;
      user-select: none;
    }

    /* Hover "Glow" effect imitando PillarCard */
    td:hover {
      background-color: rgba(255,255,255,0.05);
      position: relative;
      z-index: 10;
    }
    
    .cell-implemented:hover { box-shadow: inset 0 0 12px rgba(91, 232, 124, 0.2); border-color: var(--color-green); }
    .cell-partial:hover { box-shadow: inset 0 0 12px rgba(232, 180, 77, 0.2); border-color: var(--color-yellow); }
    .cell-missing:hover { box-shadow: inset 0 0 12px rgba(232, 69, 69, 0.2); border-color: var(--color-red); }
    .cell-dep:hover { box-shadow: inset 0 0 12px rgba(77, 200, 232, 0.2); border-color: var(--color-cyan); }
    .cell-frozen:hover { box-shadow: inset 0 0 12px rgba(147, 197, 253, 0.2); border-color: var(--color-frozen); }
    
    img { max-width: 100%; }

  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="brand-label">ENGINE STATUS</span>
      <h1>.agent Implementation Matrix</h1>
      <p class="subtitle">Interactive architecture and feature support overview across all packages.</p>
      
      <div class="timeline-container">
        <div class="timeline-node done">
          <div class="circle"></div>
          <div class="label">Start</div>
        </div>
        
        <div class="timeline-segment">
          <div class="segment-line active" id="line-v01"></div>
          <div class="segment-badge attention" id="badge-v01"><span id="v01-left">0</span> features left</div>
        </div>
        
        <div class="timeline-node active" id="node-v01">
          <div class="circle"></div>
          <div class="label">v0.1</div>
        </div>
        
        <div class="timeline-segment">
          <div class="segment-line" id="line-v02"></div>
          <div class="segment-badge" id="badge-v02"><span id="v02-left">0</span> features left</div>
        </div>
        
        <div class="timeline-node" id="node-v02">
          <div class="circle"></div>
          <div class="label">v0.2</div>
        </div>
        
        <div class="timeline-segment">
          <div class="segment-line"></div>
          <div class="segment-badge">TBD</div>
        </div>
        
        <div class="timeline-node">
          <div class="circle"></div>
          <div class="label">v1.0</div>
        </div>
      </div>
    </header>

    <div class="spectrum-divider"></div>

    <div class="dashboard-header">
      <div class="metrics">
        <div class="metric-item">
          <span class="metric-value" id="count-total">0</span>
          <span class="metric-label">Total Features</span>
        </div>
        <div class="metric-item">
          <span class="metric-value" id="count-implemented" style="color: var(--color-green);">0</span>
          <span class="metric-label">Implemented ✅</span>
        </div>
        <div class="metric-item">
          <span class="metric-value" id="count-missing" style="color: var(--color-red);">0</span>
          <span class="metric-label">Missing ❌</span>
        </div>
      </div>

      <div class="filters">
        <input type="text" id="searchInput" placeholder="Search features or nodes...">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="v0.1">v0.1 (1️⃣)</button>
        <button class="filter-btn" data-filter="v0.2">v0.2 (2️⃣)</button>
        <button class="filter-btn" data-filter="missing">Missing (❌)</button>
      </div>
    </div>

    <main id="content">
      ${htmlContent}
    </main>
  </div>

  <script>
    // -1. Wrap tables for full width and responsive scrolling
    document.querySelectorAll('main > table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    // 0. Partition Markdown content into Tabs
    const mainContent = document.getElementById('content');
    const childNodes = Array.from(mainContent.childNodes);
    
    const panePackages = document.createElement('div');
    panePackages.id = 'pane-packages';
    panePackages.className = 'tab-pane';
    panePackages.style.display = 'block';
    
    const paneDsl = document.createElement('div');
    paneDsl.id = 'pane-dsl';
    paneDsl.className = 'tab-pane';
    paneDsl.style.display = 'none';

    let currentPane = null; // null means preamble
    const preambleNodes = [];
    
    childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2') {
        const title = node.textContent.toLowerCase();
        if (title.includes('dsl') && !title.includes('package')) {
          currentPane = paneDsl;
        } else {
          currentPane = panePackages;
        }
      }
      
      if (currentPane) {
        currentPane.appendChild(node);
      } else {
        preambleNodes.push(node);
      }
    });

    // Style the preamble nodes
    preambleNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'P') {
        const text = node.textContent;
        // Remove second legend block and redundant intro text
        if (text.includes('1️⃣') || text.includes('Caniuse-style')) {
          node.style.display = 'none';
        } else if (text.includes('Legend:')) {
          node.classList.add('legend-box');
          node.innerHTML = node.innerHTML.replace('Legend:', '<strong class="legend-title">LEGEND</strong>');
        } else {
          node.classList.add('intro-text');
        }
      }
    });

    // Create Tabs Container right above the panes
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs-container';
    tabsContainer.innerHTML = \`
      <button class="tab-btn active" data-target="pane-packages">📦 Packages Layer</button>
      <button class="tab-btn" data-target="pane-dsl">📝 DSL Specification</button>
    \`;

    mainContent.appendChild(tabsContainer);
    mainContent.appendChild(panePackages);
    mainContent.appendChild(paneDsl);

    // Tab Event Listeners
    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        panePackages.style.display = 'none';
        paneDsl.style.display = 'none';
        
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'block';
      });
    });


    // 1. Classify cells and calculate metrics
    document.querySelectorAll('td').forEach(td => {
      const text = td.textContent.trim();
      
      // Padroniza celulas vazias ou com '---'
      if (text === '' || text === '-' || text === '--' || text === '---') {
        td.innerHTML = '<span class="empty-dash">&mdash;</span>';
        td.style.textAlign = 'center';
      } else {
        // Classifica cores principais
        if (text.includes('✅') || text.includes('☑️')) {
          td.classList.add('cell-implemented');
        } else if (text.includes('⚠️')) {
          td.classList.add('cell-partial');
        } else if (text.includes('❌')) {
          td.classList.add('cell-missing');
        } else if (text.includes('🔄') || text.includes('→')) {
          td.classList.add('cell-dep');
        } else if (text.includes('🧊')) {
          td.classList.add('cell-frozen'); // Célula específica com ícone
        }
      }
    });

    // 1.5 Colore colunas baseadas na tabela Package Freeze Status
    const frozenPackages = new Set();
    const allTables = document.querySelectorAll('table');
    let freezeTable = null;
    
    // Encontra a tabela de freeze status
    allTables.forEach(t => {
      if (t.textContent.includes('🧊 Frozen') || t.textContent.includes('🔥 Active')) {
        freezeTable = t;
      }
    });

    if (freezeTable) {
      const headers = Array.from(freezeTable.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
      const statusRow = freezeTable.querySelector('tbody tr');
      if (statusRow) {
        const cells = Array.from(statusRow.children);
        cells.forEach((cell, i) => {
          if (cell.textContent.includes('🧊')) {
            const headerText = headers[i];
            if (headerText) {
              const pkgName = headerText.split(' ')[0]; // pega o nome base (ex: tree-sitter)
              if (pkgName) frozenPackages.add(pkgName);
            }
          }
        });
      }
    }

    // Aplica o azul nas colunas dos pacotes congelados em todas as tabelas
    allTables.forEach(table => {
      let frozenCols = new Set();
      
      // Verifica quais colunas DESTA tabela pertencem a um pacote frozen
      table.querySelectorAll('th').forEach((th, i) => {
        const thText = th.textContent.toLowerCase();
        frozenPackages.forEach(pkg => {
          if (thText.includes(pkg)) frozenCols.add(i);
        });
      });
      
      // Aplica frozen em toda a coluna
      table.querySelectorAll('tr').forEach(row => {
        Array.from(row.children).forEach((cell, i) => {
          if (frozenCols.has(i)) {
            // A regra do !important: só não aplica se a celula tiver um semáforo de prioridade
            if (!cell.classList.contains('cell-implemented') && 
                !cell.classList.contains('cell-partial') && 
                !cell.classList.contains('cell-missing') &&
                !cell.classList.contains('cell-dep')) {
              cell.classList.add('cell-frozen');
            }
          }
        });
      });
    });

    // Update metrics by counting rows
    const tbodyRows = document.querySelectorAll('tbody tr');
    let rowTotal = 0, rowOk = 0, rowMissing = 0;
    let v01Missing = 0, v02Missing = 0;
    
    tbodyRows.forEach(row => {
        if(!row.querySelector('td')) return; // skip headers if any
        rowTotal++;
        const text = row.textContent;
        // Se a linha tem um X ou Aviso (se considerarmos missing), contamos
        if(text.includes('❌') || text.includes('⚠️')) {
          if (text.includes('❌')) rowMissing++; // metric global
          if (text.includes('1️⃣')) v01Missing++;
          if (text.includes('2️⃣')) v02Missing++;
        }
        // Se não tem X nem Aviso e tem check, consideramos ok
        else if(text.includes('✅') || text.includes('☑️')) rowOk++;
    });

    document.getElementById('count-total').textContent = rowTotal;
    document.getElementById('count-implemented').textContent = rowOk;
    document.getElementById('count-missing').textContent = rowMissing;
    
    // Update timeline
    document.getElementById('v01-left').textContent = v01Missing;
    document.getElementById('v02-left').textContent = v02Missing;
    
    // Dynamic styles for timeline if finished
    if (v01Missing === 0) {
      document.getElementById('badge-v01').classList.remove('attention');
      document.getElementById('badge-v01').textContent = "DONE";
      document.getElementById('badge-v01').style.color = "var(--color-green)";
      document.getElementById('badge-v01').style.borderColor = "rgba(91, 232, 124, 0.3)";
      document.getElementById('badge-v01').style.background = "rgba(91, 232, 124, 0.05)";
      document.getElementById('node-v01').classList.add('done');
      document.getElementById('node-v01').classList.remove('active');
      document.getElementById('line-v01').style.background = "var(--color-green)";
      
      document.getElementById('line-v02').classList.add('active');
      document.getElementById('badge-v02').classList.add('attention');
      document.getElementById('node-v02').classList.add('active');
    }

    // 2. Search & Filter Logic
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    let currentFilter = 'all';

    function applyFilters() {
      const term = searchInput.value.toLowerCase();
      
      // Pass 1: Ocultar/Mostrar Linhas (tr)
      document.querySelectorAll('tbody tr').forEach(row => {
        if (row.querySelector('th')) return; // ignore sub-headers inside tbody
        
        const rowText = row.textContent.toLowerCase();
        let matchesSearch = rowText.includes(term);
        let matchesFilter = true;

        if (currentFilter === 'v0.1') {
          matchesFilter = rowText.includes('1️⃣');
        } else if (currentFilter === 'v0.2') {
          matchesFilter = rowText.includes('2️⃣');
        } else if (currentFilter === 'missing') {
          matchesFilter = rowText.includes('❌') || rowText.includes('⚠️');
        }

        row.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
      });

      // Pass 2: Ocultar Tabelas e Títulos de Seções Vazias
      [panePackages, paneDsl].forEach(pane => {
        let currentH2 = null;
        let sectionNodes = [];
        let hasVisibleRowsInSection = false;

        const nodes = Array.from(pane.children);
        
        nodes.forEach((node, index) => {
          if (node.tagName === 'H2') {
            // Commit a seção anterior e decide se vai escondê-la
            if (currentH2) {
              const displayStyle = hasVisibleRowsInSection ? '' : 'none';
              currentH2.style.display = displayStyle;
              sectionNodes.forEach(n => n.style.display = displayStyle);
            }
            // Inicia nova seção
            currentH2 = node;
            sectionNodes = [];
            hasVisibleRowsInSection = false;
          } else {
            if (currentH2) {
              sectionNodes.push(node);
              // Verifica se a tabela tem algo visível
              if (node.classList && node.classList.contains('table-wrapper')) {
                const tableNode = node.querySelector('table');
                const visibleRows = Array.from(tableNode.querySelectorAll('tbody tr')).filter(r => r.style.display !== 'none');
                if (visibleRows.length === 0) {
                  node.style.display = 'none'; // Esconde o wrapper inteiro
                } else {
                  node.style.display = ''; // Mostra o wrapper
                  hasVisibleRowsInSection = true;
                }
              }
            }
          }
          
          // Trata o final da lista (última seção)
          if (index === nodes.length - 1 && currentH2) {
            const displayStyle = hasVisibleRowsInSection ? '' : 'none';
            currentH2.style.display = displayStyle;
            sectionNodes.forEach(n => n.style.display = displayStyle);
          }
        });
      });
    }

    searchInput.addEventListener('input', applyFilters);

    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        applyFilters();
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
