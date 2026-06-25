const API = {
  async query(sql, opts = {}) {
    const res = await fetch('/api/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, ...opts })
    });
    return res.json();
  },
  async explain(sql) {
    const res = await fetch('/api/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    return res.json();
  },
  async schema() {
    const res = await fetch('/api/schema'); return res.json();
  },
  async status() {
    const res = await fetch('/api/status'); return res.json();
  },
  async history(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/history?${qs}`); return res.json();
  },
  async updateSecurity(config) {
    const res = await fetch('/api/security', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },
};

// State
let lastResult = null;
let historyPage = 1;

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'schema') loadSchema();
    if (tab.dataset.tab === 'history') loadHistory();
    if (tab.dataset.tab === 'status') loadStatus();
  });
});

// Run query
document.getElementById('btn-run').addEventListener('click', runQuery);
document.getElementById('sql-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runQuery();
});

async function runQuery() {
  const sql = document.getElementById('sql-input').value.trim();
  if (!sql) return;
  const btn = document.getElementById('btn-run');
  const status = document.getElementById('query-status');
  btn.disabled = true; btn.textContent = 'Running...'; status.textContent = '';
  try {
    const result = await API.query(sql, {
      readOnly: document.getElementById('chk-readonly').checked,
    });
    lastResult = result;
    displayResult(result);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Run Query';
  }
}

function displayResult(result) {
  const wrapper = document.getElementById('result-table-wrapper');
  const info = document.getElementById('result-info');
  const csvBtn = document.getElementById('btn-export-csv');
  const jsonBtn = document.getElementById('btn-export-json');
  const status = document.getElementById('query-status');

  document.getElementById('btn-export-csv-main').disabled = false;
  document.getElementById('btn-export-json-main').disabled = false;
  document.getElementById('btn-export-jsonl').disabled = false;
  csvBtn.disabled = false; jsonBtn.disabled = false;

  if (result.status === 'error') {
    wrapper.innerHTML = `<div class="placeholder" style="color:var(--red)">Error: ${result.error}</div>`;
    info.textContent = `Error (${result.duration.toFixed(1)}ms)`;
    status.className = 'query-status error';
    status.textContent = result.error;
    return;
  }

  status.className = 'query-status success';
  status.textContent = `${result.rowCount} rows in ${result.duration.toFixed(2)}ms`;
  if (result.warning) status.textContent += ` | ${result.warning}`;

  info.textContent = `${result.rowCount} rows | ${result.duration.toFixed(2)}ms | ${result.columns.length} columns`;
  if (result.affectedRows !== undefined) info.textContent += ` | Affected: ${result.affectedRows}`;

  if (result.rows.length === 0) {
    wrapper.innerHTML = '<div class="placeholder">Query executed successfully (0 rows returned)</div>';
    return;
  }

  let html = '<table><thead><tr>';
  for (const col of result.columns) html += `<th>${col}</th>`;
  html += '</tr></thead><tbody>';
  for (const row of result.rows) {
    html += '<tr>';
    for (const col of result.columns) {
      let val = row[col];
      if (val === null || val === undefined) val = '<span style="color:var(--text2)">NULL</span>';
      else if (typeof val === 'object') val = JSON.stringify(val);
      html += `<td title="${val}">${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  wrapper.innerHTML = html;
}

function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="placeholder">Loading...</div><div class="spinner"></div>';
}

function hideLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

function showError(msg) {
  const wrapper = document.getElementById('result-table-wrapper');
  wrapper.innerHTML = `<div class="placeholder" style="color:var(--red)">${msg}</div>`;
  document.getElementById('result-info').textContent = 'Error';
}

// Explain
document.getElementById('btn-explain').addEventListener('click', async () => {
  const sql = document.getElementById('sql-input').value.trim();
  if (!sql) return;
  const result = await API.explain(sql);
  displayResult(result);
});

// Format
document.getElementById('btn-format').addEventListener('click', () => {
  const sql = document.getElementById('sql-input').value.trim();
  if (!sql) return;
  fetch('/api/format', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  }).then(r => r.json()).then(r => {
    document.getElementById('sql-input').value = r.formatted;
  });
});

// Schema
async function loadSchema() {
  const container = document.getElementById('schema-content');
  const viewsSection = document.getElementById('schema-views-section');
  const viewsContent = document.getElementById('schema-views-content');
  const tableCount = document.getElementById('schema-table-count');
  showLoading('schema-loading');
  try {
    const schema = await API.schema();
    if (schema.error) { container.innerHTML = `<div class="placeholder">Error: ${schema.error}</div>`; return; }
    const tables = schema.tables || [];
    const views = schema.views || [];
    tableCount.textContent = `${tables.length} tables`;
    if (tables.length === 0) { container.innerHTML = '<div class="placeholder">No tables found</div>'; }
    else { container.innerHTML = tables.map(t => renderTableCard(t)).join(''); }
    if (views.length > 0) {
      viewsSection.style.display = 'block';
      viewsContent.innerHTML = views.map(v => renderViewCard(v)).join('');
    } else {
      viewsSection.style.display = 'none';
    }
  } catch (err) {
    container.innerHTML = `<div class="placeholder">Error: ${err.message}</div>`;
  } finally {
    hideLoading('schema-loading');
  }
}

function renderViewCard(view) {
  const cols = (view.columns || []).map(c =>
    `<span class="col-name" style="display:inline-block;margin-right:12px;">${c.name} <span class="col-type">${c.type}</span></span>`
  ).join('');
  return `<div class="schema-table" style="opacity:0.8">
    <div class="schema-table-header">
      <h3>${view.name}</h3>
      <span class="badge">view</span>
      <span class="badge">${(view.columns || []).length} cols</span>
    </div>
    <div class="schema-table-body">
      <div style="font-size:12px;color:var(--text2);padding:8px 0;max-height:80px;overflow:hidden;">${escapeHtml(view.definition || '')}</div>
      ${cols ? `<h4>Columns</h4><div>${cols}</div>` : ''}
    </div>
  </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderTableCard(table) {
  const cols = (table.columns || []).map(c =>
    `<div class="col-item"><span class="col-name">${c.name}</span><span class="col-type">${c.type}</span>${c.primaryKey ? '<span class="col-meta">PK</span>' : ''}${!c.nullable ? '<span class="col-meta">NOT NULL</span>' : ''}${c.defaultValue !== undefined && c.defaultValue !== null ? `<span class="col-meta">DEFAULT ${c.defaultValue}</span>` : ''}</div>`
  ).join('');
  const indexes = (table.indexes || []).map(i =>
    `<div class="col-item"><span class="col-name">${i.name}</span><span class="col-type">${i.columns.join(', ')}</span><span class="col-meta">${i.type}</span></div>`
  ).join('');
  const fks = (table.foreignKeys || []).map(fk =>
    `<div class="col-item"><span class="col-name">${fk.column}</span><span class="col-type">→ ${fk.referencedTable}.${fk.referencedColumn}</span></div>`
  ).join('');
  return `<div class="schema-table">
    <div class="schema-table-header">
      <h3>${table.name}</h3>
      <span class="badge">${(table.columns || []).length} cols</span>
      <span class="badge">~${table.rowCount || 0} rows</span>
    </div>
    <div class="schema-table-body">
      <h4>Columns</h4>${cols || '<div style="color:var(--text2);font-size:12px;padding:4px 0">None</div>'}
      ${indexes ? `<h4>Indexes</h4>${indexes}` : ''}
      ${fks ? `<h4>Foreign Keys</h4>${fks}` : ''}
    </div>
  </div>`;
}

document.getElementById('btn-refresh-schema').addEventListener('click', loadSchema);

// History
async function loadHistory(page = 1) {
  historyPage = page;
  const search = document.getElementById('history-search').value;
  const status = document.getElementById('history-status').value;
  const params = { page, pageSize: 10 };
  if (search) params.search = search;
  if (status) params.dbstatus = status;
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="placeholder">Loading...</div>';
  try {
    const data = await API.history(params);
    const list = document.getElementById('history-list');
    if (data.error) { list.innerHTML = `<div class="placeholder">Error: ${data.error}</div>`; return; }
    if (!data.data || data.data.length === 0) {
      list.innerHTML = '<div class="placeholder">No queries yet</div>';
      document.getElementById('history-pagination').innerHTML = '';
      return;
    }
    list.innerHTML = data.data.map(e => `<div class="history-item" onclick="replayQuery('${e.query.replace(/'/g, "\\'")}')">
      <span class="h-status ${e.status}"></span>
      <span class="h-query">${e.query.substring(0, 100)}</span>
      <span class="h-meta">${e.duration.toFixed(1)}ms | ${e.rowCount} rows</span>
    </div>`).join('');
    renderPagination(data, page);
    // Stats
    const stats = await API.history({ page: 1, pageSize: 1 });
    document.getElementById('history-stats').innerHTML =
      `Total: <span>${stats.total}</span> | Page ${page}/${stats.totalPages || 1}`;
    await loadStatsSummary();
  } catch (err) {
    document.getElementById('history-list').innerHTML = `<div class="placeholder">Error: ${err.message}</div>`;
  }
}

async function loadStatsSummary() {
  try {
    const statusData = await API.status();
    const h = statusData.history || {};
    document.getElementById('stat-total').textContent = h.total || 0;
    document.getElementById('stat-ok').textContent = h.successful || 0;
    document.getElementById('stat-fail').textContent = h.failed || 0;
  } catch (err) {
    document.getElementById('history-stats').innerHTML = `<span style="color:var(--red)">Failed to load stats: ${err.message}</span>`;
  }
}

function renderPagination(data, current) {
  const container = document.getElementById('history-pagination');
  if (data.totalPages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= Math.min(data.totalPages, 20); i++) {
    html += `<button class="${i === current ? 'active' : ''}" onclick="loadHistory(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

function replayQuery(sql) {
  document.querySelector('[data-tab="query"]').click();
  document.getElementById('sql-input').value = sql;
  runQuery();
}

document.getElementById('history-search').addEventListener('input', () => loadHistory(1));
document.getElementById('history-status').addEventListener('change', () => loadHistory(1));
document.getElementById('btn-clear-history').addEventListener('click', async () => {
  await fetch('/api/history', { method: 'DELETE' });
  loadHistory(1);
});

// Export
document.getElementById('btn-export-csv').addEventListener('click', () => doExport('csv'));
document.getElementById('btn-export-json').addEventListener('click', () => doExport('json'));
document.getElementById('btn-export-csv-main').addEventListener('click', () => doExport('csv'));
document.getElementById('btn-export-json-main').addEventListener('click', () => doExport('json'));
document.getElementById('btn-export-jsonl').addEventListener('click', () => doExport('jsonl'));

async function doExport(format) {
  if (!lastResult) return;
  let content, ext, mime;
  switch (format) {
    case 'csv':
      content = await fetch('/api/export/csv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: lastResult })
      }).then(r => r.text());
      ext = 'csv'; mime = 'text/csv';
      break;
    case 'json':
      content = await fetch('/api/export/json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: lastResult })
      }).then(r => r.text());
      ext = 'json'; mime = 'application/json';
      break;
    case 'jsonl':
      content = await fetch('/api/export/jsonl', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: lastResult })
      }).then(r => r.text());
      ext = 'jsonl'; mime = 'application/jsonl';
      break;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `export.${ext}`; a.click();
  URL.revokeObjectURL(url);
  document.getElementById('export-content').textContent = content.substring(0, 2000);
}

document.getElementById('btn-export-all').addEventListener('click', async () => {
  const schema = await API.schema();
  if (!schema.tables) return;
  let allCsv = '';
  for (const t of schema.tables) {
    const r = await API.query(`SELECT * FROM "${t.name}"`);
    if (r.status === 'success') {
      const csv = await fetch('/api/export/csv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: r })
      }).then(r2 => r2.text());
      allCsv += `\n=== ${t.name} ===\n${csv}\n`;
    }
  }
  const blob = new Blob([allCsv], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'all-tables.txt'; a.click();
  URL.revokeObjectURL(url);
  document.getElementById('export-content').textContent = allCsv.substring(0, 2000);
});

// Security
document.getElementById('btn-update-security').addEventListener('click', async () => {
  const config = {
    readOnly: document.getElementById('sec-readonly').checked,
    requireWhere: document.getElementById('sec-require-where').checked,
    bannedStatements: document.getElementById('sec-banned').value.split(',').map(s => s.trim()).filter(Boolean),
    maxRows: parseInt(document.getElementById('sec-max-rows').value) || 1000,
    queryTimeout: parseInt(document.getElementById('sec-timeout').value) || 30000,
    maxQueryLength: parseInt(document.getElementById('sec-max-length').value) || 10000,
  };
  const btn = document.getElementById('btn-update-security');
  const status = document.getElementById('security-status');
  btn.disabled = true; status.textContent = 'Updating...';
  try {
    await API.updateSecurity(config);
    status.className = 'query-status success';
    status.textContent = 'Security updated successfully';
  } catch (err) {
    status.className = 'query-status error';
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// Status
async function loadStatus() {
  try {
    document.getElementById('stat-connection').textContent = 'Loading...';
    document.getElementById('databases-list').innerHTML = '<li>Loading...</li>';
    const s = await API.status();
    document.getElementById('stat-connection').textContent = s.connected ? 'Connected' : 'Disconnected';
    document.getElementById('stat-connection').className = 'stat-value ' + (s.connected ? 'connected' : 'error');
    document.getElementById('stat-driver').textContent = s.driver || '-';
    document.getElementById('stat-version').textContent = s.version || '-';
    document.getElementById('stat-db-version').textContent = s.databaseVersion || '-';
    document.getElementById('stat-total').textContent = s.history?.total || 0;
    document.getElementById('stat-ok').textContent = s.history?.successful || 0;
    document.getElementById('stat-ok').className = 'stat-value success';
    document.getElementById('stat-fail').textContent = s.history?.failed || 0;
    document.getElementById('stat-fail').className = 'stat-value error';
    document.getElementById('stat-avg').textContent = s.history?.avgDuration ? s.history.avgDuration.toFixed(2) + 'ms' : '0ms';

    if (s.databases && s.databases.length) {
      document.getElementById('databases-list').innerHTML = s.databases.map(d => `<li>${d}</li>`).join('');
    }
  } catch (err) {
    console.error('Status error:', err);
  }
}

document.getElementById('btn-refresh-status').addEventListener('click', loadStatus);

// Load config
async function loadConfig() {
  try {
    const cfg = await (await fetch('/api/config')).json();
    document.getElementById('config-content').textContent = JSON.stringify(cfg, null, 2);
  } catch {}
}

// Init
loadStatus();
loadConfig();
