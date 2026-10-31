/* =====================================================================
   pages.js - one function per sidebar page. Each page calls the FastAPI
   backend, then draws KPIs, charts and tables from the JSON it receives.
   ===================================================================== */
const STATUS_COLORS = { delivered: "#16a34a", shipped: "#0ea5e9", approved: "#8b5cf6", invoiced: "#6366f1", processing: "#f59e0b", created: "#94a3b8", canceled: "#e11d48", unavailable: "#be123c" };
const SCORE_COLORS = ["#e11d48", "#f97316", "#f59e0b", "#84cc16", "#16a34a"];
const pageHead = (t, s, extra = "") => `<div class="page-head"><div><h1>${esc(t)}</h1><p>${esc(s)}</p></div>${extra}</div>`;
const canvasCard = (title, sub, id, cls = "") => card(title, sub, `<div class="chart-box ${cls}"><canvas id="${id}"></canvas></div>`);
const statusColors = (labels) => labels.map((s) => STATUS_COLORS[s] || "#94a3b8");

/* wrapper for pages that load everything with one API call */
async function simplePage(root, loader, draw) {
  root.innerHTML = loadingHTML();
  try { const d = await loader(); draw(d); }
  catch (e) { root.innerHTML = errorHTML(e.message); const b = $("[data-retry]", root); if (b) b.onclick = () => simplePage(root, loader, draw); }
}

/* ============================ DASHBOARD ============================ */
function pageDashboard(root) {
  root.innerHTML = pageHead("E-Commerce Dashboard", "Live overview calculated from the olist_ecommerce database") + skeletonDash();
  simplePage(root, () => api("/dashboard"), (d) => {
    const k = d.kpis;
    root.innerHTML = pageHead("E-Commerce Dashboard", "Live overview calculated from the olist_ecommerce database") + `
      <div class="grid g-kpi">
        ${kpi("Total Orders", fmt.int(k.total_orders), "orders", "indigo")}
        ${kpi("Total Customers", fmt.int(k.total_customers), "customers", "teal", "unique customers")}
        ${kpi("Total Sellers", fmt.int(k.total_sellers), "sellers", "amber")}
        ${kpi("Total Products", fmt.int(k.total_products), "products", "sky")}
        ${kpi("Total Revenue", fmt.moneyShort(k.total_revenue), "revenue", "green", fmt.money(k.total_revenue))}
        ${kpi("Avg Order Value", fmt.money(k.avg_order_value), "trend", "indigo")}
        ${kpi("Avg Review Score", k.avg_review_score == null ? "–" : fmt.dec(k.avg_review_score) + " / 5", "reviews", "amber")}
        ${kpi("Total Freight Cost", fmt.moneyShort(k.total_freight), "truck", "rose", fmt.money(k.total_freight))}
      </div>
      <div class="grid g-3-2">
        ${canvasCard("Sales Over Time", "Revenue by month (order purchase date)", "cSales")}
        ${canvasCard("Orders by Status", "Share of all orders", "cStatus")}
      </div>
      <div class="grid g-3-2">
        ${canvasCard("Revenue by Product Category", "Top 10 categories", "cCat")}
        ${canvasCard("Payment Type Distribution", "Number of payments", "cPay")}
      </div>
      <div class="grid g-2">
        ${canvasCard("Customer Reviews", "Number of reviews per score", "cReview", "short")}
        ${card("Top Products", "Highest revenue — click a row for details", `<div id="topProducts"></div>`)}
      </div>
      <div class="grid">${card("Top Sellers", "Highest revenue — click a row for details", `<div id="topSellers"></div>`)}</div>`;

    chart("sales", "cSales", "line", d.sales_over_time.map((r) => r.month), [{ label: "Revenue", data: d.sales_over_time.map((r) => num(r.revenue)) }], { money: true });
    chart("status", "cStatus", "doughnut", d.orders_by_status.map((r) => r.status), [{ data: d.orders_by_status.map((r) => r.count), colors: statusColors(d.orders_by_status.map((r) => r.status)) }]);
    chart("cat", "cCat", "bar", d.revenue_by_category.map((r) => r.category), [{ label: "Revenue", data: d.revenue_by_category.map((r) => num(r.revenue)) }], { horizontal: true, money: true });
    chart("pay", "cPay", "doughnut", d.payment_types.map((r) => r.payment_type), [{ data: d.payment_types.map((r) => r.count) }]);
    chart("review", "cReview", "bar", d.review_scores.map((r) => r.score + " ★"), [{ label: "Reviews", data: d.review_scores.map((r) => r.count), colors: SCORE_COLORS }]);

    $("#topProducts").innerHTML = tableHTML([
      { label: "Product", render: (r) => idLink("product", r.product_id) },
      { label: "Category", key: "category" },
      { label: "Units", num: true, render: (r) => fmt.int(r.units_sold) },
      { label: "Revenue", num: true, render: (r) => fmt.money(r.revenue) },
    ], d.top_products, {});
    $("#topSellers").innerHTML = tableHTML([
      { label: "Seller", render: (r) => idLink("seller", r.seller_id) },
      { label: "City", key: "seller_city" }, { label: "State", key: "seller_state" },
      { label: "Orders", num: true, render: (r) => fmt.int(r.orders) },
      { label: "Revenue", num: true, render: (r) => fmt.money(r.revenue) },
    ], d.top_sellers, {});
  });
}

/* ============================== ORDERS ============================== */
function pageOrders(root, q) {
  listPage(root, {
    title: "Orders", subtitle: "Search, filter and open any order to see its items, payment and review",
    endpoint: "/orders", sort: "order_purchase_timestamp", direction: "desc", empty: "No orders found.",
    filters: [
      { key: "order_id", type: "search", label: "Order ID", placeholder: "Search by order ID…" },
      { key: "customer_id", type: "search", label: "Customer ID", placeholder: "Search by customer ID…" },
      { key: "status", type: "select", label: "Status", all: "All statuses", options: (f) => (f.order_statuses || []).map((s) => ({ value: s, label: s })) },
      { key: "date_from", type: "date", label: "Purchased from" },
      { key: "date_to", type: "date", label: "Purchased to" },
    ],
    columns: [
      { key: "order_id", label: "Order ID", render: (r) => `<span class="mono">${fmt.short(r.order_id)}</span>` },
      { key: "customer_id", label: "Customer ID", render: (r) => `<span class="mono">${fmt.short(r.customer_id)}</span>` },
      { key: "order_status", label: "Status", render: (r) => statusBadge(r.order_status) },
      { key: "order_purchase_timestamp", label: "Purchased", render: (r) => fmt.date(r.order_purchase_timestamp) },
      { key: "order_approved_at", label: "Approved", render: (r) => fmt.date(r.order_approved_at) },
      { key: "order_delivered_customer_date", label: "Delivered", render: (r) => fmt.date(r.order_delivered_customer_date) },
      { key: "order_estimated_delivery_date", label: "Estimated", render: (r) => fmt.date(r.order_estimated_delivery_date) },
      { key: "order_value", label: "Order Value", num: true, render: (r) => fmt.money(r.order_value) },
    ],
    onRow: (r) => openDetail("order", r.order_id),
  }, q);
}

/* ============================= CUSTOMERS ============================= */
function pageCustomers(root, q) {
  listPage(root, {
    title: "Customers", subtitle: "Click a customer to see their order and review history",
    endpoint: "/customers", sort: "customer_id", direction: "asc", empty: "No customers found.",
    filters: [
      { key: "search", type: "search", label: "Search", placeholder: "Customer ID or unique customer ID…" },
      { key: "state", type: "select", label: "State", all: "All states", options: (f) => (f.customer_states || []).map((s) => ({ value: s, label: s })),
        onChange: async (value, state, toolbar) => {          // city list depends on the chosen state
          state.city = "";
          const cities = await api("/cities", { state: value });
          $("#f_city", toolbar).innerHTML = '<option value="">All cities</option>' + cities.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
        } },
      { key: "city", type: "select", label: "City", all: "All cities", options: () => [],
        afterBuild: async (state, toolbar) => {               // fill the City list (limited to the chosen state, if any)
          const cities = await api("/cities", { state: state.state }).catch(() => []);
          $("#f_city", toolbar).innerHTML = '<option value="">All cities</option>' + cities.map((c) => `<option value="${esc(c)}" ${c === state.city ? "selected" : ""}>${esc(c)}</option>`).join("");
        } },
    ],
    columns: [
      { key: "customer_id", label: "Customer ID", render: (r) => `<span class="mono">${fmt.short(r.customer_id)}</span>` },
      { key: "customer_unique_id", label: "Unique Customer ID", render: (r) => `<span class="mono">${fmt.short(r.customer_unique_id)}</span>` },
      { key: "customer_city", label: "City" },
      { key: "customer_state", label: "State" },
      { key: "num_orders", label: "Orders", num: true, render: (r) => fmt.int(r.num_orders) },
      { key: "total_spent", label: "Total Spent", num: true, render: (r) => fmt.money(r.total_spent) },
    ],
    onRow: (r) => openDetail("customer", r.customer_id),
  }, q);
}

/* ============================== PRODUCTS ============================== */
function pageProducts(root, q) {
  listPage(root, {
    title: "Products", subtitle: "Product catalogue with physical attributes — open a product to see its sales",
    endpoint: "/products", sort: "product_id", direction: "asc", empty: "No products found.",
    filters: [
      { key: "search", type: "search", label: "Search", placeholder: "Product ID or category…" },
      { key: "category", type: "select", label: "Category", all: "All categories", options: (f) => (f.categories || []).map((c) => ({ value: c.name, label: c.label })) },
    ],
    columns: [
      { key: "product_id", label: "Product ID", render: (r) => `<span class="mono">${fmt.short(r.product_id)}</span>` },
      { key: "category", label: "Category", render: (r) => esc(r.category || "–") },
      { key: "product_name_length", label: "Name Len", num: true, render: (r) => fmt.int(r.product_name_length) },
      { key: "product_description_length", label: "Desc Len", num: true, render: (r) => fmt.int(r.product_description_length) },
      { key: "product_photos_qty", label: "Photos", num: true, render: (r) => fmt.int(r.product_photos_qty) },
      { key: "product_weight_g", label: "Weight (g)", num: true, render: (r) => fmt.int(r.product_weight_g) },
      { key: "product_length_cm", label: "Length (cm)", num: true, render: (r) => fmt.int(r.product_length_cm) },
      { key: "product_height_cm", label: "Height (cm)", num: true, render: (r) => fmt.int(r.product_height_cm) },
      { key: "product_width_cm", label: "Width (cm)", num: true, render: (r) => fmt.int(r.product_width_cm) },
    ],
    onRow: (r) => openDetail("product", r.product_id),
  }, q);
}

/* ============================= CATEGORIES ============================= */
function pageCategories(root) {
  let search = "", sort = "revenue", dir = "desc", rows = [];
  root.innerHTML = pageHead("Categories", "Category performance — products, orders and revenue") + `
    <div class="card toolbar"><div class="field grow"><label>Search</label><input id="catSearch" placeholder="Portuguese or English category name…"></div></div>
    <div class="grid">${canvasCard("Revenue by Category", "Top 15 categories by revenue", "cCats", "tall")}</div>
    <div class="card"><div id="catTable"></div></div>`;
  const cols = [
    { key: "category_pt", label: "Category (Portuguese)", render: (r) => esc(r.category_pt || "(no category)") },
    { key: "category_en", label: "Category (English)", render: (r) => esc(r.category_en || "–") },
    { key: "num_products", label: "Products", num: true, render: (r) => fmt.int(r.num_products) },
    { key: "num_orders", label: "Orders", num: true, render: (r) => fmt.int(r.num_orders) },
    { key: "revenue", label: "Total Revenue", num: true, render: (r) => fmt.money(r.revenue) },
  ];
  const draw = () => {
    const sorted = [...rows].sort((a, b) => {
      const x = a[sort], y = b[sort];
      const c = typeof x === "number" || typeof y === "number" ? num(x) - num(y) : String(x ?? "").localeCompare(String(y ?? ""));
      return dir === "asc" ? c : -c;
    });
    $("#catTable").innerHTML = sorted.length ? tableHTML(cols, sorted, { sort, dir }) : emptyHTML("No categories found.");
  };
  const load = async () => {
    $("#catTable").innerHTML = loadingHTML();
    try {
      rows = (await api("/categories", { search })).map((r) => ({ ...r, num_products: num(r.num_products), num_orders: num(r.num_orders), revenue: num(r.revenue) }));
      draw();
      const top = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 15);
      chart("cats", "cCats", "bar", top.map((r) => r.category_en || r.category_pt || "(none)"), [{ label: "Revenue", data: top.map((r) => r.revenue) }], { horizontal: true, money: true });
    } catch (e) { $("#catTable").innerHTML = errorHTML(e.message); }
  };
  $("#catSearch").addEventListener("input", debounce((e) => { search = e.target.value.trim(); load(); }));
  $("#catTable").addEventListener("click", (e) => {
    if (e.target.closest("[data-retry]")) return load();
    const th = e.target.closest("th[data-sort]"); if (!th) return;
    if (sort === th.dataset.sort) dir = dir === "asc" ? "desc" : "asc"; else { sort = th.dataset.sort; dir = "desc"; }
    draw();
  });
  load();
}

/* ============================== SELLERS ============================== */
function pageSellers(root, q) {
  listPage(root, {
    title: "Sellers", subtitle: "Seller performance — click a seller for full details",
    endpoint: "/sellers", sort: "revenue", direction: "desc", empty: "No sellers found.",
    filters: [
      { key: "search", type: "search", label: "Search", placeholder: "Seller ID or city…" },
      { key: "state", type: "select", label: "State", all: "All states", options: (f) => (f.seller_states || []).map((s) => ({ value: s, label: s })) },
    ],
    columns: [
      { key: "seller_id", label: "Seller ID", render: (r) => `<span class="mono">${fmt.short(r.seller_id)}</span>` },
      { key: "seller_city", label: "City" },
      { key: "seller_state", label: "State" },
      { key: "products_sold", label: "Products Sold", num: true, render: (r) => fmt.int(r.products_sold) },
      { key: "total_orders", label: "Orders", num: true, render: (r) => fmt.int(r.total_orders) },
      { key: "revenue", label: "Revenue", num: true, render: (r) => fmt.money(r.revenue) },
      { key: "avg_review_score", label: "Avg Review", render: (r) => r.avg_review_score == null ? "–" : `${stars(r.avg_review_score)} <span class="muted">${fmt.dec(r.avg_review_score)}</span>` },
    ],
    onRow: (r) => openDetail("seller", r.seller_id),
  }, q);
}

/* ============================== PAYMENTS ============================== */
function pagePayments(root) {
  const f = { date_from: "", date_to: "", payment_type: "" };
  root.innerHTML = pageHead("Payments", "Payment value, methods and instalments") + `
    <div class="card toolbar">
      <div class="field"><label>Purchased from</label><input type="date" id="pFrom"></div>
      <div class="field"><label>Purchased to</label><input type="date" id="pTo"></div>
      <div class="field"><label>Payment type</label><select id="pType"><option value="">All types</option></select></div>
      <button class="btn" id="pReset">Reset</button></div>
    <div id="payBody"></div>`;
  getFilters().then((o) => { $("#pType").innerHTML += (o.payment_types || []).map((t) => `<option>${esc(t)}</option>`).join(""); }).catch(() => {});
  const load = () => simplePageInto($("#payBody"), () => api("/payments", f), (d) => {
    const s = d.summary;
    $("#payBody").innerHTML = `
      <div class="grid g-kpi">
        ${kpi("Total Payment Value", fmt.moneyShort(s.total_value), "revenue", "green", fmt.money(s.total_value))}
        ${kpi("Average Payment Value", fmt.money(s.avg_value), "trend", "indigo")}
        ${kpi("Number of Payments", fmt.int(s.num_payments), "payments", "sky")}
        ${kpi("Average Installments", fmt.dec(s.avg_installments), "repeat", "amber")}
      </div>
      <div class="grid g-2">
        ${canvasCard("Payment Type", "Total value by payment method", "cType")}
        ${canvasCard("Installment Distribution", "Number of payments by installments", "cInst")}
      </div>
      <div class="grid">${canvasCard("Payment Value Over Time", "Total payment value per month", "cOver")}</div>`;
    chart("ptype", "cType", "doughnut", d.by_type.map((r) => r.payment_type), [{ data: d.by_type.map((r) => num(r.value)), fmt: "money" }]);
    chart("inst", "cInst", "bar", d.installments.map((r) => r.installments + "x"), [{ label: "Payments", data: d.installments.map((r) => r.count) }]);
    chart("over", "cOver", "line", d.over_time.map((r) => r.month), [{ label: "Payment value", data: d.over_time.map((r) => num(r.value)) }], { money: true });
  });
  root.addEventListener("change", (e) => {
    const map = { pFrom: "date_from", pTo: "date_to", pType: "payment_type" };
    if (map[e.target.id]) { f[map[e.target.id]] = e.target.value; load(); }
  });
  $("#pReset").onclick = () => { $("#pFrom").value = $("#pTo").value = $("#pType").value = ""; Object.keys(f).forEach((k) => (f[k] = "")); load(); };
  load();
}
async function simplePageInto(target, loader, draw) {
  target.innerHTML = loadingHTML();
  try { draw(await loader()); }
  catch (e) { target.innerHTML = errorHTML(e.message); const b = $("[data-retry]", target); if (b) b.onclick = () => simplePageInto(target, loader, draw); }
}

/* ============================== REVIEWS ============================== */
function pageReviews(root, q) {
  listPage(root, {
    title: "Reviews", subtitle: "Customer satisfaction — score distribution and written feedback",
    endpoint: "/reviews", sort: "review_creation_date", direction: "desc", empty: "No reviews found.",
    pick: (d) => d.table,
    filters: [
      { key: "order_id", type: "search", label: "Order ID", placeholder: "Search by order ID…" },
      { key: "score", type: "select", label: "Score", all: "All scores", options: () => [5, 4, 3, 2, 1].map((s) => ({ value: s, label: "★".repeat(s) + ` (${s})` })) },
      { key: "date_from", type: "date", label: "Created from" },
      { key: "date_to", type: "date", label: "Created to" },
    ],
    onData: (d, extra) => {
      const s = d.summary;
      extra.innerHTML = `
        <div class="grid g-5" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
          ${kpi("Total Reviews", fmt.int(s.total_reviews), "reviews", "indigo")}
          ${kpi("Average Score", s.avg_score == null ? "–" : fmt.dec(s.avg_score) + " / 5", "trend", "amber", "")}
          ${[5, 4, 3, 2, 1].map((n) => kpi(`${n}-Star Reviews`, fmt.int(s.by_score[n]), "reviews", n >= 4 ? "green" : n === 3 ? "amber" : "rose")).join("")}
        </div>
        <div class="grid">${canvasCard("Review Score Distribution", "Respects the order and date filters", "cDist", "short")}</div>`;
      chart("dist", "cDist", "bar", d.distribution.map((r) => r.score + " ★"), [{ label: "Reviews", data: d.distribution.map((r) => r.count), colors: SCORE_COLORS }]);
    },
    columns: [
      { key: "review_id", label: "Review ID", render: (r) => `<span class="mono">${fmt.short(r.review_id)}</span>` },
      { key: "order_id", label: "Order ID", render: (r) => idLink("order", r.order_id) },
      { key: "review_score", label: "Score", render: (r) => stars(r.review_score) },
      { label: "Title", sortable: false, wrap: true, render: (r) => esc(r.review_comment_title || "–") },
      { label: "Comment", sortable: false, wrap: true, render: (r) => esc(r.review_comment_message || "–") },
      { key: "review_creation_date", label: "Created", render: (r) => fmt.date(r.review_creation_date) },
      { key: "review_answer_timestamp", label: "Answered", render: (r) => fmt.date(r.review_answer_timestamp) },
    ],
  }, q);
}

/* ============================== ANALYTICS ============================== */
const ANALYTICS_TABS = [["sales", "Sales"], ["orders", "Orders"], ["customers", "Customers"], ["sellers", "Sellers"], ["products", "Products"]];
function pageAnalytics(root, q) {
  const st = { tab: ANALYTICS_TABS.some((t) => t[0] === q.tab) ? q.tab : "sales", date_from: "", date_to: "" };
  root.innerHTML = pageHead("Analytics", "Deep-dive reports — choose a topic and an optional date range") + `
    <div class="tabs" id="aTabs">${ANALYTICS_TABS.map(([k, l]) => `<button class="tab" data-tab="${k}">${l}</button>`).join("")}</div>
    <div class="card toolbar">
      <div class="field"><label>Purchased from</label><input type="date" id="aFrom"></div>
      <div class="field"><label>Purchased to</label><input type="date" id="aTo"></div>
      <button class="btn" id="aReset">Reset</button></div>
    <div id="aBody"></div>`;
  const load = () => {
    $$(".tab", root).forEach((b) => b.classList.toggle("active", b.dataset.tab === st.tab));
    destroyCharts("a-");
    simplePageInto($("#aBody"), () => api("/analytics/" + st.tab, { date_from: st.date_from, date_to: st.date_to }), (d) => ANALYTICS_DRAW[st.tab](d, $("#aBody")));
  };
  $("#aTabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) { st.tab = b.dataset.tab; load(); } };
  root.addEventListener("change", (e) => {
    if (e.target.id === "aFrom") { st.date_from = e.target.value; load(); }
    if (e.target.id === "aTo") { st.date_to = e.target.value; load(); }
  });
  $("#aReset").onclick = () => { $("#aFrom").value = $("#aTo").value = ""; st.date_from = st.date_to = ""; load(); };
  load();
}

const emptyIf = (arr, body) => (arr && arr.length ? body : emptyHTML("No data for this period."));
const sellerLabel = (r) => `${String(r.seller_id).slice(0, 6)}… ${r.seller_city || ""}`;
const prodLabel = (r) => `${String(r.product_id).slice(0, 6)}… ${r.category || ""}`;

const ANALYTICS_DRAW = {
  sales(d, el) {
    const o = d.overall;
    el.innerHTML = `
      <div class="grid g-kpi" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        ${kpi("Revenue", fmt.moneyShort(o.revenue), "revenue", "green", fmt.money(o.revenue))}
        ${kpi("Orders with items", fmt.int(o.orders), "orders", "indigo")}
        ${kpi("Average Order Value", fmt.money(o.avg_order_value), "trend", "amber")}
      </div>
      <div class="grid g-2">${canvasCard("Revenue by Month", "Revenue (bars) and average order value (line)", "aMonthly")}${canvasCard("Sales Trend", "Month-over-month revenue growth", "aGrowth")}</div>
      <div class="grid g-2">${canvasCard("Revenue by Category", "Top 15", "aCat", "tall")}${canvasCard("Revenue by Customer State", "All states", "aState", "tall")}</div>`;
    if (!d.monthly.length) { el.innerHTML += emptyHTML("No sales in this period."); return; }
    const m = d.monthly;
    chart("a-monthly", "aMonthly", "bar", m.map((r) => r.month), [
      { label: "Revenue", data: m.map((r) => num(r.revenue)), type: "bar", yAxisID: "y" },
      { label: "Avg order value", data: m.map((r) => num(r.avg_order_value)), type: "line", borderColor: "#f59e0b", backgroundColor: "#f59e0b", yAxisID: "y2", tension: .35, pointRadius: 2 },
    ], { money: true, y2: true });
    chart("a-growth", "aGrowth", "bar", m.map((r) => r.month), [{ label: "MoM growth", fmt: "pct", data: m.map((r) => r.growth_pct == null ? 0 : r.growth_pct), colors: m.map((r) => (r.growth_pct ?? 0) >= 0 ? "#16a34a" : "#e11d48") }], { extra: { scales: { y: { ticks: { callback: (v) => v + "%" }, grid: { color: cssVar("--border") } }, x: { ticks: { color: cssVar("--text-2"), maxRotation: 0 }, grid: { display: false } } } } });
    chart("a-cat", "aCat", "bar", d.by_category.map((r) => r.category), [{ label: "Revenue", data: d.by_category.map((r) => num(r.revenue)) }], { horizontal: true, money: true });
    chart("a-state", "aState", "bar", d.by_state.map((r) => r.state), [{ label: "Revenue", data: d.by_state.map((r) => num(r.revenue)), color: "#0d9488" }], { money: true });
  },

  orders(d, el) {
    const dl = d.delivery;
    el.innerHTML = `
      <div class="grid g-kpi">
        ${kpi("Delivered Orders", fmt.int(dl.delivered_orders), "orders", "indigo")}
        ${kpi("On-time Delivery", fmt.pct(dl.on_time_rate), "clock", "green", `${fmt.int(dl.late)} delivered late`)}
        ${kpi("Avg Actual Delivery", dl.avg_actual_days == null ? "–" : fmt.dec(dl.avg_actual_days, 1) + " days", "truck", "sky")}
        ${kpi("Avg Estimated Delivery", dl.avg_estimated_days == null ? "–" : fmt.dec(dl.avg_estimated_days, 1) + " days", "clock", "amber")}
      </div>
      <div class="grid g-3-2">${canvasCard("Orders by Month", "Number of orders placed", "aOrdersM")}${canvasCard("Orders by Status", "", "aStatus")}</div>
      <div class="grid g-2">${canvasCard("Estimated vs Actual Delivery", "Average days from purchase, by purchase month", "aEst")}${canvasCard("Delivery Performance", "Delivered orders: on time vs late", "aPerf")}</div>`;
    chart("a-om", "aOrdersM", "line", d.monthly.map((r) => r.month), [{ label: "Orders", data: d.monthly.map((r) => r.orders) }]);
    chart("a-st", "aStatus", "doughnut", d.by_status.map((r) => r.status), [{ data: d.by_status.map((r) => r.count), colors: statusColors(d.by_status.map((r) => r.status)) }]);
    chart("a-est", "aEst", "line", d.estimated_vs_actual.map((r) => r.month), [
      { label: "Actual days", fmt: "dec", data: d.estimated_vs_actual.map((r) => num(r.actual_days)), color: "#4f46e5" },
      { label: "Estimated days", fmt: "dec", data: d.estimated_vs_actual.map((r) => num(r.estimated_days)), color: "#f59e0b", fill: false },
    ]);
    chart("a-perf", "aPerf", "doughnut", ["On time", "Late"], [{ data: [num(dl.on_time), num(dl.late)], colors: ["#16a34a", "#e11d48"] }]);
  },

  customers(d, el) {
    const r = d.repeat;
    el.innerHTML = `
      <div class="grid g-kpi">
        ${kpi("Unique Customers", fmt.int(r.total_customers), "customers", "indigo")}
        ${kpi("Repeat Customers", fmt.int(r.repeat_customers), "repeat", "green", "placed 2+ orders")}
        ${kpi("One-time Customers", fmt.int(r.one_time_customers), "customers", "amber")}
        ${kpi("Repeat Rate", fmt.pct(r.repeat_rate), "trend", "teal")}
      </div>
      <div class="grid g-2">${canvasCard("Customers by State", "", "aCState", "tall")}${canvasCard("Customers by City", "Top 15 cities", "aCCity", "tall")}</div>
      <div class="grid g-3-2">${card("Top Customers by Spending", "Per unique customer (items + freight)", `<div id="topCust"></div>`)}${canvasCard("Repeat vs One-time", "", "aRepeat")}</div>`;
    chart("a-cs", "aCState", "bar", d.by_state.map((x) => x.state), [{ label: "Customers", data: d.by_state.map((x) => x.customers), color: "#0d9488" }]);
    chart("a-cc", "aCCity", "bar", d.by_city.map((x) => `${x.city} (${x.state})`), [{ label: "Customers", data: d.by_city.map((x) => x.customers) }], { horizontal: true });
    chart("a-rp", "aRepeat", "doughnut", ["Repeat", "One-time"], [{ data: [num(r.repeat_customers), num(r.one_time_customers)], colors: ["#16a34a", "#94a3b8"] }]);
    $("#topCust").innerHTML = emptyIf(d.top_customers, tableHTML([
      { label: "Unique customer", render: (x) => `<span class="mono">${fmt.short(x.customer_unique_id)}</span>` },
      { label: "City", render: (x) => esc(`${x.city || ""} ${x.state || ""}`) },
      { label: "Orders", num: true, render: (x) => fmt.int(x.orders) },
      { label: "Total spent", num: true, render: (x) => fmt.money(x.total_spent) },
    ], d.top_customers, {}));
  },

  sellers(d, el) {
    el.innerHTML = `
      <div class="grid g-2">${canvasCard("Top Sellers by Revenue", "Top 10", "aSRev", "tall")}${canvasCard("Top Sellers by Orders", "Top 10", "aSOrd", "tall")}</div>
      <div class="grid g-3-2">${card("Seller Ranking", "Click a row for seller details", `<div id="sellerRank"></div>`)}${canvasCard("Revenue by Seller State", "", "aSState")}</div>`;
    chart("a-sr", "aSRev", "bar", d.top_revenue.map(sellerLabel), [{ label: "Revenue", data: d.top_revenue.map((x) => num(x.revenue)) }], { horizontal: true, money: true });
    chart("a-so", "aSOrd", "bar", d.top_orders.map(sellerLabel), [{ label: "Orders", data: d.top_orders.map((x) => x.orders), color: "#0d9488" }], { horizontal: true });
    chart("a-ss", "aSState", "doughnut", d.by_state.map((x) => x.state), [{ data: d.by_state.map((x) => num(x.revenue)), fmt: "money" }]);
    $("#sellerRank").innerHTML = emptyIf(d.top_revenue, tableHTML([
      { label: "Seller", render: (x) => idLink("seller", x.seller_id) },
      { label: "Location", render: (x) => esc(`${x.seller_city || ""} ${x.seller_state || ""}`) },
      { label: "Orders", num: true, render: (x) => fmt.int(x.orders) },
      { label: "Revenue", num: true, render: (x) => fmt.money(x.revenue) },
    ], d.top_revenue, {}));
  },

  products(d, el) {
    el.innerHTML = `
      <div class="grid g-2">${canvasCard("Best-Selling Products", "By units sold", "aBest", "tall")}${canvasCard("Highest-Revenue Products", "By revenue", "aTopRev", "tall")}</div>
      <div class="grid">${card("Category Performance", "Top 15 categories", `<div id="catPerf"></div>`)}</div>`;
    chart("a-bs", "aBest", "bar", d.best_selling.map(prodLabel), [{ label: "Units sold", data: d.best_selling.map((x) => x.units_sold), color: "#0d9488" }], { horizontal: true });
    chart("a-tr", "aTopRev", "bar", d.top_revenue.map(prodLabel), [{ label: "Revenue", data: d.top_revenue.map((x) => num(x.revenue)) }], { horizontal: true, money: true });
    $("#catPerf").innerHTML = emptyIf(d.category_performance, tableHTML([
      { key: "category", label: "Category" },
      { label: "Units sold", num: true, render: (x) => fmt.int(x.units_sold) },
      { label: "Orders", num: true, render: (x) => fmt.int(x.orders) },
      { label: "Avg price", num: true, render: (x) => fmt.money(x.avg_price) },
      { label: "Revenue", num: true, render: (x) => fmt.money(x.revenue) },
    ], d.category_performance, {}));
  },
};
