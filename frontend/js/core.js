/* =====================================================================
   core.js - small building blocks used by every page:
     api()          talk to the FastAPI backend
     fmt.*          number / date / money formatting
     badges, stars, kpi cards, tables, pagination
     chart()        Chart.js wrapper
     listPage()     a reusable "filters + sortable table + pagination" page
   Nothing here contains data - everything shown comes from the API.
   ===================================================================== */

/* ---------- tiny helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- icons (Feather-style SVG paths) ---------- */
const ICONS = {
  logo: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  orders: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  customers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  products: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  categories: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  sellers: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  payments: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  reviews: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  analytics: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  revenue: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24">${ICONS[name] || ""}</svg>`;

/* ---------- API ---------- */
async function api(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v !== null && v !== undefined) qs.append(k, v); });
  const url = "/api" + path + (qs.toString() ? "?" + qs : "");
  let res;
  try { res = await fetch(url); }
  catch { throw new Error("Cannot reach the server. Is `uvicorn` still running?"); }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

/* ---------- formatting ---------- */
const nf = new Intl.NumberFormat("en-US");
const nfCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const fmt = {
  int: (v) => (v === null || v === undefined ? "–" : nf.format(Math.round(Number(v)))),
  dec: (v, d = 2) => (v === null || v === undefined ? "–" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })),
  money: (v) => (v === null || v === undefined ? "–" : "R$ " + fmt.dec(v)),
  moneyShort: (v) => (v === null || v === undefined ? "–" : "R$ " + nfCompact.format(Number(v))),
  compact: (v) => nfCompact.format(Number(v)),
  pct: (v, d = 1) => (v === null || v === undefined ? "–" : Number(v).toFixed(d) + "%"),
  date: (v) => (v ? String(v).slice(0, 10) : "–"),
  datetime: (v) => (v ? String(v).replace("T", " ").slice(0, 16) : "–"),
  short: (id) => (id ? esc(String(id).slice(0, 8)) + "…" : "–"),
};

/* ---------- small UI pieces (return HTML strings) ---------- */
const STATUS_CLASS = {
  delivered: "b-green", shipped: "b-blue", approved: "b-violet", invoiced: "b-violet",
  processing: "b-amber", created: "b-grey", canceled: "b-red", unavailable: "b-red",
};
const statusBadge = (s) => `<span class="badge ${STATUS_CLASS[s] || "b-grey"}">${esc(s || "unknown")}</span>`;
const stars = (score) => {
  if (score === null || score === undefined) return '<span class="muted">–</span>';
  const full = Math.round(Number(score));
  return `<span class="stars" title="${Number(score).toFixed(2)} / 5">${"★".repeat(full)}<span class="off">${"★".repeat(5 - full)}</span></span>`;
};
const idLink = (kind, id) => `<a class="mono" data-open="${kind}" data-id="${esc(id)}" title="${esc(id)}">${fmt.short(id)}</a>`;

function kpi(label, value, ico, tone = "indigo", note = "") {
  return `<div class="card kpi"><div class="kpi-icon tone-${tone}">${icon(ico)}</div>
    <div><div class="label">${esc(label)}</div><div class="value">${value}</div>${note ? `<div class="note">${esc(note)}</div>` : ""}</div></div>`;
}
const card = (title, sub, inner, cls = "") =>
  `<div class="card card-pad ${cls}"><h3>${esc(title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}${inner}</div>`;

const loadingHTML = (msg = "Loading data from MySQL…") => `<div class="state"><div class="spinner"></div>${esc(msg)}</div>`;
const emptyHTML = (msg) => `<div class="state"><div class="big">🗂️</div>${esc(msg)}</div>`;
const errorHTML = (msg) => `<div class="state error"><div class="big">⚠️</div><strong>Something went wrong</strong><br>${esc(msg)}<br><br><button class="btn small" data-retry>Try again</button></div>`;
const skeletonDash = () => `<div class="grid g-kpi">${'<div class="skeleton sk-kpi"></div>'.repeat(4)}</div><div class="grid g-2"><div class="skeleton sk-chart"></div><div class="skeleton sk-chart"></div></div>`;

/* generic table. cols: [{key,label,sort,num,wrap,render(row)}] */
function tableHTML(cols, rows, { sort, dir, clickable = false } = {}) {
  const head = cols.map((c) => {
    const key = c.sort || c.key;
    const sortable = c.sortable !== false && sort !== undefined;
    const arrow = sortable && sort === key ? `<span class="arrow">${dir === "asc" ? "▲" : "▼"}</span>` : "";
    return `<th class="${sortable ? "sortable" : ""} ${c.num ? "num" : ""}" ${sortable ? `data-sort="${key}"` : ""}>${esc(c.label)}${arrow}</th>`;
  }).join("");
  const body = rows.map((r, i) => `<tr ${clickable ? `class="clickable" data-row="${i}"` : ""}>` +
    cols.map((c) => `<td class="${c.num ? "num" : ""} ${c.wrap ? "wrap" : ""}">${c.render ? c.render(r) : esc(r[c.key] ?? "–")}</td>`).join("") + "</tr>").join("");
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function pagerHTML(d) {
  const { page, pages, total, limit } = d;
  const from = total ? (page - 1) * limit + 1 : 0, to = Math.min(page * limit, total);
  const nums = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
  return `<div class="pager"><span class="muted">Showing ${fmt.int(from)}–${fmt.int(to)} of ${fmt.int(total)}</span>
    <div class="pages">
      <button data-page="1" ${page === 1 ? "disabled" : ""}>«</button>
      <button data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>‹</button>
      ${nums.map((p) => `<button data-page="${p}" class="${p === page ? "current" : ""}">${p}</button>`).join("")}
      <button data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>›</button>
      <button data-page="${pages}" ${page >= pages ? "disabled" : ""}>»</button>
    </div>
    <label class="muted">Rows <select data-limit>${[10, 20, 50, 100].map((n) => `<option ${n === limit ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>`;
}

/* ---------- charts (Chart.js) ---------- */
const PALETTE = ["#4f46e5", "#0d9488", "#f59e0b", "#e11d48", "#0ea5e9", "#8b5cf6", "#16a34a", "#f97316", "#64748b", "#ec4899"];
const charts = {};
function destroyCharts(prefix = "") {
  Object.keys(charts).forEach((k) => { if (k.startsWith(prefix)) { charts[k].destroy(); delete charts[k]; } });
}
function chart(key, canvasId, type, labels, datasets, opts = {}) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  if (charts[key]) charts[key].destroy();
  const text = cssVar("--text-2"), grid = cssVar("--border");
  const circular = type === "doughnut" || type === "pie";
  const money = opts.money;
  const tickFmt = money ? (v) => fmt.moneyShort(v) : (v) => fmt.compact(v);
  const options = {
    responsive: true, maintainAspectRatio: false,
    indexAxis: opts.horizontal ? "y" : "x",
    interaction: { mode: circular ? "nearest" : "index", intersect: false },
    plugins: {
      legend: { display: circular || datasets.length > 1, position: circular ? "right" : "top", labels: { color: text, usePointStyle: true, boxWidth: 8 } },
      tooltip: { callbacks: { label: (c) => {
        const v = circular ? c.parsed : (opts.horizontal ? c.parsed.x : c.parsed.y);
        const ds = c.dataset;
        const f = ds.fmt === "money" || (money && ds.fmt === undefined) ? fmt.money : ds.fmt === "pct" ? fmt.pct : ds.fmt === "dec" ? fmt.dec : fmt.int;
        return `${ds.label ? ds.label + ": " : (circular ? c.label + ": " : "")}${f(v)}`;
      } } },
    },
    scales: circular ? {} : {
      x: { grid: { display: !!opts.horizontal, color: grid }, ticks: { color: text, maxRotation: 0, autoSkip: true, ...(opts.horizontal ? { callback: tickFmt } : {}) }, stacked: !!opts.stacked },
      y: { grid: { color: grid }, ticks: { color: text, ...(opts.horizontal ? {} : { callback: tickFmt }) }, beginAtZero: true, stacked: !!opts.stacked },
      ...(opts.y2 ? { y2: { position: "right", grid: { display: false }, ticks: { color: text, callback: (v) => fmt.moneyShort(v) }, beginAtZero: true } } : {}),
    },
    cutout: type === "doughnut" ? "62%" : undefined,
    ...(opts.extra || {}),
  };
  const ds = datasets.map((d, i) => {
    const color = d.color || PALETTE[i % PALETTE.length];
    if (circular) return { ...d, backgroundColor: d.colors || PALETTE, borderColor: cssVar("--surface"), borderWidth: 2 };
    if (type === "line") return { borderColor: color, backgroundColor: color + "22", fill: datasets.length === 1, tension: 0.35, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2.5, ...d };
    return { backgroundColor: d.colors || color, borderRadius: 5, maxBarThickness: 38, ...d };
  });
  charts[key] = new Chart(el, { type, data: { labels, datasets: ds }, options });
  return charts[key];
}

/* ---------- cached dropdown values (/api/filters) ---------- */
let _filters = null;
async function getFilters() { if (!_filters) _filters = await api("/filters"); return _filters; }

/* =====================================================================
   listPage(): the reusable page used by Orders, Customers, Products,
   Sellers and Reviews:  [filters toolbar] + [extra area] + [table] + [pager]
   ===================================================================== */
function listPage(root, cfg, initial = {}) {
  const state = { page: 1, limit: 20, sort: cfg.sort, direction: cfg.direction || "desc" };
  (cfg.filters || []).forEach((f) => { state[f.key] = initial[f.key] ?? ""; });
  let rows = [], seq = 0;

  root.innerHTML = `
    <div class="page-head"><div><h1>${esc(cfg.title)}</h1><p>${esc(cfg.subtitle || "")}</p></div></div>
    <div class="card toolbar" id="toolbar"></div>
    <div id="extra"></div>
    <div class="card"><div id="tbl"></div></div>`;
  const tbl = $("#tbl", root), toolbar = $("#toolbar", root);

  async function buildToolbar() {
    const f = await getFilters().catch(() => ({}));
    toolbar.innerHTML = cfg.filters.map((flt) => {
      const id = "f_" + flt.key;
      if (flt.type === "search")
        return `<div class="field grow"><label for="${id}">${esc(flt.label)}</label><input id="${id}" data-key="${flt.key}" placeholder="${esc(flt.placeholder || "")}" value="${esc(state[flt.key])}"></div>`;
      if (flt.type === "date")
        return `<div class="field"><label for="${id}">${esc(flt.label)}</label><input type="date" id="${id}" data-key="${flt.key}" value="${esc(state[flt.key])}"></div>`;
      const opts = flt.options ? flt.options(f) : [];
      return `<div class="field"><label for="${id}">${esc(flt.label)}</label><select id="${id}" data-key="${flt.key}">
        <option value="">${esc(flt.all || "All")}</option>${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(state[flt.key]) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>`;
    }).join("") + `<button class="btn" id="resetBtn">Reset</button>`;
    for (const flt of cfg.filters) if (flt.afterBuild) await flt.afterBuild(state, toolbar);   // e.g. fill the City list
  }

  async function load() {
    const mine = ++seq;
    tbl.innerHTML = loadingHTML();
    try {
      const params = { ...state };
      const raw = await api(cfg.endpoint, params);
      if (mine !== seq) return;
      const d = cfg.pick ? cfg.pick(raw) : raw;
      rows = d.items;
      if (cfg.onData) cfg.onData(raw, $("#extra", root));
      tbl.innerHTML = rows.length
        ? tableHTML(cfg.columns, rows, { sort: state.sort, dir: state.direction, clickable: !!cfg.onRow }) + pagerHTML(d)
        : emptyHTML(cfg.empty || "No records found.");
    } catch (e) {
      if (mine !== seq) return;
      tbl.innerHTML = errorHTML(e.message);
    }
  }

  /* events (event delegation: one listener per area) */
  toolbar.addEventListener("input", debounce((e) => {
    if (e.target.matches('input:not([type="date"])')) { state[e.target.dataset.key] = e.target.value.trim(); state.page = 1; load(); }
  }, 350));
  toolbar.addEventListener("change", async (e) => {
    const key = e.target.dataset.key; if (!key) return;
    if (e.target.matches("select, input[type=date]")) {
      state[key] = e.target.value; state.page = 1;
      const flt = cfg.filters.find((x) => x.key === key);
      if (flt && flt.onChange) await flt.onChange(e.target.value, state, toolbar);
      load();
    }
  });
  toolbar.addEventListener("click", async (e) => {
    if (e.target.id !== "resetBtn") return;
    cfg.filters.forEach((f) => { state[f.key] = ""; });
    Object.assign(state, { page: 1, limit: 20, sort: cfg.sort, direction: cfg.direction || "desc" });
    await buildToolbar(); load();
  });
  tbl.addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) return load();
    const th = e.target.closest("th[data-sort]");
    if (th) {
      const key = th.dataset.sort;
      if (state.sort === key) state.direction = state.direction === "asc" ? "desc" : "asc";
      else { state.sort = key; state.direction = "asc"; }
      state.page = 1; return load();
    }
    const pg = e.target.closest("button[data-page]");
    if (pg && !pg.disabled) { state.page = Number(pg.dataset.page); return load(); }
    if (e.target.closest("a[data-open]")) return; // handled globally
    const tr = e.target.closest("tr[data-row]");
    if (tr && cfg.onRow) cfg.onRow(rows[Number(tr.dataset.row)]);
  });
  tbl.addEventListener("change", (e) => { if (e.target.matches("[data-limit]")) { state.limit = Number(e.target.value); state.page = 1; load(); } });

  buildToolbar().then(load);
}
