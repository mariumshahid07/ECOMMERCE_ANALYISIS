/* =====================================================================
   app.js - starts the app: sidebar, hash router, theme, global events.
   URLs look like  #/orders  or  #/orders?order_id=abc
   ===================================================================== */
const ROUTES = {
  dashboard: ["Dashboard", pageDashboard],
  orders: ["Orders", pageOrders],
  customers: ["Customers", pageCustomers],
  products: ["Products", pageProducts],
  categories: ["Categories", pageCategories],
  sellers: ["Sellers", pageSellers],
  payments: ["Payments", pagePayments],
  reviews: ["Reviews", pageReviews],
  analytics: ["Analytics", pageAnalytics],
};

function buildShell() {
  $("#brandMark").innerHTML = `<svg class="i" viewBox="0 0 24 24">${ICONS.logo}</svg>`;
  $("#nav").innerHTML = Object.entries(ROUTES).map(([k, [label]]) => `<a href="#/${k}" data-route="${k}">${icon(k)}<span>${label}</span></a>`).join("");
  $("#menuBtn").innerHTML = icon("menu");
  $("#gsIcon").innerHTML = icon("search");
  $("#drawerClose").innerHTML = icon("x");
  setThemeIcon();
}

function parseHash() {
  const [path, qs = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { route: ROUTES[path] ? path : "dashboard", query };
}

function navigate() {
  const { route, query } = parseHash();
  closeDetail();
  destroyCharts();
  document.body.classList.remove("menu-open");
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  document.title = `${ROUTES[route][0]} · Olist Analytics`;
  // a fresh container for every page, so old event listeners disappear with the old one
  const fresh = document.createElement("main");
  fresh.id = "view"; fresh.className = "view";
  $("#view").replaceWith(fresh);
  ROUTES[route][1](fresh, query);
  window.scrollTo(0, 0);
}

/* ---------- theme ---------- */
function setThemeIcon() { $("#themeBtn").innerHTML = icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon"); }
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch { /* storage may be blocked */ }
  setThemeIcon();
}

/* ---------- database status pill ---------- */
async function checkDb() {
  const pill = $("#dbStatus");
  try {
    const h = await api("/health");
    pill.className = "pill ok"; pill.lastElementChild.textContent = `Database connected · ${fmt.int(h.orders)} orders`;
  } catch (e) {
    pill.className = "pill bad"; pill.lastElementChild.textContent = "Database offline";
    pill.title = e.message;
  }
}

/* ---------- global events ---------- */
document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]");
  if (open) { e.preventDefault(); openDetail(open.dataset.open, open.dataset.id); }
});
$("#drawerClose").onclick = closeDetail;
$("#drawerBackdrop").onclick = closeDetail;
$("#drawerBack").onclick = backDetail;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !wrap().hidden) closeDetail(); });
$("#menuBtn").onclick = () => document.body.classList.toggle("menu-open");
$("#scrim").onclick = () => document.body.classList.remove("menu-open");
$("#themeBtn").onclick = () => { applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); navigate(); };
$("#globalSearch").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#globalSearchInput").value.trim();
  if (v) location.hash = `#/orders?order_id=${encodeURIComponent(v)}`;
});
window.addEventListener("hashchange", navigate);

/* ---------- start ---------- */
(function init() {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch { /* ignore */ }
  document.documentElement.dataset.theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  buildShell();
  checkDb();
  navigate();
})();
