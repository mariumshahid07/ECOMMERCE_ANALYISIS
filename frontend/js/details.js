/* =====================================================================
   details.js - the slide-in "detail" panel for an order, customer,
   product or seller. Any element with  data-open="order|customer|
   product|seller"  data-id="..."  opens it (handled in app.js).
   Panels can open each other; the Back button walks the history.
   ===================================================================== */
const drawerStack = [];   // [{kind, id, title}]
const wrap = () => $("#drawerWrap");

const infoItem = (k, v) => `<div class="info"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
const mini = (k, v) => `<div class="mini"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
const section = (title, inner) => `<div class="card card-pad"><div class="section-title">${esc(title)}</div>${inner}</div>`;

function openDetail(kind, id, { push = true } = {}) {
  if (push) drawerStack.push({ kind, id });
  wrap().hidden = false;
  document.body.style.overflow = "hidden";
  $("#drawerBack").hidden = drawerStack.length < 2;
  renderDrawer();
}
function closeDetail() {
  drawerStack.length = 0;
  wrap().hidden = true;
  document.body.style.overflow = "";
  destroyCharts("drawer");
}
function backDetail() {
  drawerStack.pop();
  const top = drawerStack[drawerStack.length - 1];
  if (top) { $("#drawerBack").hidden = drawerStack.length < 2; renderDrawer(); } else closeDetail();
}

const DETAIL = { order: renderOrder, customer: renderCustomer, product: renderProduct, seller: renderSeller };
const TITLES = { order: "Order", customer: "Customer", product: "Product", seller: "Seller" };

async function renderDrawer() {
  const { kind, id } = drawerStack[drawerStack.length - 1];
  const body = $("#drawerBody");
  destroyCharts("drawer");
  $("#drawerTitle").textContent = `${TITLES[kind]} ${String(id).slice(0, 12)}…`;
  body.innerHTML = loadingHTML();
  body.scrollTop = 0;
  try {
    const d = await api(`/${kind}s/${encodeURIComponent(id)}`);
    if (drawerStack[drawerStack.length - 1]?.id !== id) return;   // user navigated away meanwhile
    body.innerHTML = DETAIL[kind](d);
    if (kind === "seller") drawSellerChart(d);
  } catch (e) {
    body.innerHTML = errorHTML(e.message);
    const retry = $("[data-retry]", body); if (retry) retry.onclick = renderDrawer;
  }
}

/* ---------- ORDER ---------- */
function renderOrder(d) {
  const o = d.order;
  let delivery = "";
  if (o.order_delivered_customer_date && o.order_estimated_delivery_date) {
    const late = o.order_delivered_customer_date > o.order_estimated_delivery_date;
    delivery = late ? '<span class="badge b-red">Delivered late</span>' : '<span class="badge b-green">Delivered on time</span>';
  }
  const items = tableHTML([
    { key: "order_item_id", label: "#" },
    { label: "Product", render: (r) => `${idLink("product", r.product_id)}<div class="muted">${esc(r.category || "–")}</div>` },
    { label: "Seller", render: (r) => `${idLink("seller", r.seller_id)}<div class="muted">${esc(r.seller_city || "")} ${esc(r.seller_state || "")}</div>` },
    { label: "Price", num: true, render: (r) => fmt.money(r.price) },
    { label: "Freight", num: true, render: (r) => fmt.money(r.freight_value) },
    { label: "Shipping limit", render: (r) => fmt.datetime(r.shipping_limit_date) },
  ], d.items, {}).replace("</tbody>",
    `<tr class="total-row"><td colspan="3">Total</td><td class="num">${fmt.money(d.totals.items_total)}</td><td class="num">${fmt.money(d.totals.freight_total)}</td><td></td></tr></tbody>`);
  const pays = tableHTML([
    { key: "payment_sequential", label: "#" },
    { label: "Type", render: (r) => `<span class="badge b-violet">${esc(r.payment_type)}</span>` },
    { label: "Installments", key: "payment_installments", num: true },
    { label: "Value", num: true, render: (r) => fmt.money(r.payment_value) },
  ], d.payments, {});
  const reviews = d.reviews.length ? d.reviews.map((r) => `<div class="review-box">${stars(r.review_score)}
      <div class="t">${esc(r.review_comment_title || "")}</div><div>${esc(r.review_comment_message || "") || '<span class="muted">No written comment.</span>'}</div>
      <div class="muted" style="font-size:12px;margin-top:4px">${fmt.datetime(r.review_creation_date)}</div></div>`).join("")
    : '<span class="muted">This order has no review.</span>';

  return `
    <div class="card card-pad" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="mono">${esc(o.order_id)}</span>${statusBadge(o.order_status)}${delivery}
      <span style="margin-left:auto" class="muted">Paid <strong style="color:var(--text)">${fmt.money(d.totals.paid_total)}</strong></span></div>
    ${section("Order information", `<div class="info-grid">
      ${infoItem("Status", statusBadge(o.order_status))}
      ${infoItem("Purchased", fmt.datetime(o.order_purchase_timestamp))}
      ${infoItem("Approved", fmt.datetime(o.order_approved_at))}
      ${infoItem("Handed to carrier", fmt.datetime(o.order_delivered_carrier_date))}
      ${infoItem("Delivered to customer", fmt.datetime(o.order_delivered_customer_date))}
      ${infoItem("Estimated delivery", fmt.datetime(o.order_estimated_delivery_date))}</div>`)}
    ${section("Customer", `<div class="info-grid">
      ${infoItem("Customer ID", `<a class="mono" data-open="customer" data-id="${esc(o.customer_id)}">${esc(o.customer_id)}</a>`)}
      ${infoItem("City", esc(o.customer_city || "–"))}${infoItem("State", esc(o.customer_state || "–"))}</div>`)}
    ${section(`Items (${d.items.length})`, d.items.length ? items : '<span class="muted">No items.</span>')}
    ${section("Payment", d.payments.length ? pays : '<span class="muted">No payment records.</span>')}
    ${section("Review", reviews)}`;
}

/* ---------- CUSTOMER ---------- */
function renderCustomer(d) {
  const c = d.customer, s = d.stats;
  const orders = tableHTML([
    { label: "Order", render: (r) => idLink("order", r.order_id) },
    { label: "Status", render: (r) => statusBadge(r.order_status) },
    { label: "Purchased", render: (r) => fmt.date(r.order_purchase_timestamp) },
    { label: "Value", num: true, render: (r) => fmt.money(r.order_value) },
  ], d.orders, {});
  const reviews = d.reviews.length ? d.reviews.map((r) => `<div class="review-box">${stars(r.review_score)}
      <span class="muted" style="margin-left:8px">${fmt.date(r.review_creation_date)} · order ${idLink("order", r.order_id)}</span>
      <div class="t">${esc(r.review_comment_title || "")}</div><div>${esc(r.review_comment_message || "")}</div></div>`).join("")
    : '<span class="muted">No reviews written.</span>';
  return `
    ${section("Customer information", `<div class="info-grid">
      ${infoItem("Customer ID", `<span class="mono">${esc(c.customer_id)}</span>`)}
      ${infoItem("Unique customer ID", `<span class="mono">${esc(c.customer_unique_id)}</span>`)}
      ${infoItem("City", esc(c.customer_city || "–"))}${infoItem("State", esc(c.customer_state || "–"))}
      ${infoItem("ZIP prefix", esc(c.customer_zip_code_prefix || "–"))}</div>`)}
    <div class="g-mini">${mini("Total orders", fmt.int(s.total_orders))}${mini("Total spending", fmt.money(s.total_spent))}
      ${mini("Avg order value", fmt.money(s.avg_order_value))}${mini("Reviews", fmt.int(s.reviews_count))}</div>
    <div class="muted" style="font-size:12.5px">Order history covers every order made under this person's unique customer ID.</div>
    ${section("Order history", d.orders.length ? orders : '<span class="muted">No orders.</span>')}
    ${section("Review history", reviews)}`;
}

/* ---------- PRODUCT ---------- */
function renderProduct(d) {
  const p = d.product, s = d.sales;
  const sellers = tableHTML([
    { label: "Seller", render: (r) => idLink("seller", r.seller_id) },
    { label: "Location", render: (r) => `${esc(r.seller_city || "")} ${esc(r.seller_state || "")}` },
    { label: "Units", num: true, render: (r) => fmt.int(r.units_sold) },
    { label: "Revenue", num: true, render: (r) => fmt.money(r.revenue) },
  ], d.sellers, {});
  return `
    ${section("Product information", `<div class="info-grid">
      ${infoItem("Product ID", `<span class="mono">${esc(p.product_id)}</span>`)}
      ${infoItem("Category (Portuguese)", esc(p.product_category_name || "–"))}
      ${infoItem("Category (English)", esc(p.product_category_name_english || "–"))}
      ${infoItem("Name length", fmt.int(p.product_name_length))}
      ${infoItem("Description length", fmt.int(p.product_description_length))}
      ${infoItem("Photos", fmt.int(p.product_photos_qty))}
      ${infoItem("Weight", p.product_weight_g == null ? "–" : fmt.int(p.product_weight_g) + " g")}
      ${infoItem("Length", p.product_length_cm == null ? "–" : p.product_length_cm + " cm")}
      ${infoItem("Height", p.product_height_cm == null ? "–" : p.product_height_cm + " cm")}
      ${infoItem("Width", p.product_width_cm == null ? "–" : p.product_width_cm + " cm")}</div>`)}
    <div class="g-mini">${mini("Units sold", fmt.int(s.units_sold))}${mini("Revenue", fmt.money(s.revenue))}
      ${mini("Avg selling price", fmt.money(s.avg_selling_price))}${mini("Total freight", fmt.money(s.total_freight))}${mini("Orders", fmt.int(s.orders))}</div>
    ${section("Sold by", d.sellers.length ? sellers : '<span class="muted">This product has not been sold yet.</span>')}`;
}

/* ---------- SELLER ---------- */
function renderSeller(d) {
  const s = d.seller, st = d.stats;
  const products = tableHTML([
    { label: "Product", render: (r) => idLink("product", r.product_id) },
    { label: "Category", key: "category" },
    { label: "Units", num: true, render: (r) => fmt.int(r.units_sold) },
    { label: "Revenue", num: true, render: (r) => fmt.money(r.revenue) },
  ], d.products, {});
  const orders = tableHTML([
    { label: "Order", render: (r) => idLink("order", r.order_id) },
    { label: "Status", render: (r) => statusBadge(r.order_status) },
    { label: "Purchased", render: (r) => fmt.date(r.order_purchase_timestamp) },
    { label: "Items", num: true, render: (r) => fmt.int(r.items) },
    { label: "Seller revenue", num: true, render: (r) => fmt.money(r.seller_revenue) },
  ], d.orders, {});
  return `
    ${section("Seller information", `<div class="info-grid">
      ${infoItem("Seller ID", `<span class="mono">${esc(s.seller_id)}</span>`)}
      ${infoItem("City", esc(s.seller_city || "–"))}${infoItem("State", esc(s.seller_state || "–"))}
      ${infoItem("ZIP prefix", esc(s.seller_zip_code_prefix || "–"))}</div>`)}
    <div class="g-mini">${mini("Revenue", fmt.money(st.revenue))}${mini("Orders", fmt.int(st.total_orders))}
      ${mini("Products sold", fmt.int(st.products_sold))}${mini("Items sold", fmt.int(st.items_sold))}
      ${mini("Avg order value", fmt.money(st.avg_order_value))}${mini("Avg review", st.avg_review_score == null ? "–" : stars(st.avg_review_score) + " " + fmt.dec(st.avg_review_score))}
      ${mini("On-time delivery", fmt.pct(st.on_time_rate))}${mini("Avg delivery time", st.avg_delivery_days == null ? "–" : fmt.dec(st.avg_delivery_days, 1) + " days")}
      ${mini("Freight", fmt.money(st.freight))}</div>
    ${section("Revenue by month", '<div class="chart-box short"><canvas id="sellerChart"></canvas></div>')}
    ${section("Top products sold", d.products.length ? products : '<span class="muted">No sales yet.</span>')}
    ${section("Recent orders", d.orders.length ? orders : '<span class="muted">No orders yet.</span>')}`;
}
function drawSellerChart(d) {
  if (!d.monthly_revenue.length) { const c = $("#sellerChart"); if (c) c.parentElement.innerHTML = emptyHTML("No monthly data."); return; }
  chart("drawer-seller", "sellerChart", "line", d.monthly_revenue.map((m) => m.month), [{ label: "Revenue", data: d.monthly_revenue.map((m) => num(m.revenue)) }], { money: true });
}
