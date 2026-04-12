// ==========================================
// XELA TORTILLERÍA — SISTEMA INTERNO
// ==========================================

// ---- Contraseña ----
const PASSWORDS = { control: 'xela2024', equipo: 'xelaempleado' };
let currentRole = null;

// ---- Productos del catálogo ----
const PRODUCTS = [
  { id: 'maiz',    name: 'Tortilla de Maíz',         price: 15, unit: 'docena', emoji: '🌽' },
  { id: 'moringa', name: 'Tortilla de Moringa',       price: 30, unit: 'docena', emoji: '🌿' },
  { id: 'nopal',   name: 'Tortilla de Nopal',         price: 25, unit: 'docena', emoji: '🌵' },
  { id: 'pasilla', name: 'Tortilla de Chile Pasilla', price: 25, unit: 'docena', emoji: '🌶️' },
];

// ---- Almacenamiento ----
function getData(key, def) {
  try { return JSON.parse(localStorage.getItem('xela_' + key)) || def; }
  catch { return def; }
}
function setData(key, val) {
  localStorage.setItem('xela_' + key, JSON.stringify(val));
}

// ---- Inicializar datos de muestra si están vacíos ----
function initSampleData() {
  if (getData('initialized', false)) return;

  // Inventario inicial
  const inventory = [
    { id: 'masa_maiz',    name: 'Masa de maíz',        qty: 25,  unit: 'docena', threshold: 10, cost: 12 },
    { id: 'moringa_polvo', name: 'Moringa en polvo',   qty: 3.5, unit: 'docena', threshold: 2,  cost: 180 },
    { id: 'nopal_fresco',  name: 'Nopal fresco',       qty: 8,   unit: 'docena', threshold: 5,  cost: 15 },
    { id: 'chile_pasilla', name: 'Chile pasilla seco', qty: 1.5, unit: 'docena', threshold: 2,  cost: 80 },
    { id: 'cal',           name: 'Cal',                qty: 10,  unit: 'docena', threshold: 3,  cost: 5 },
    { id: 'gas',           name: 'Gas LP',             qty: 1,   unit: 'docena', threshold: 1,  cost: 300 },
  ];
  setData('inventory', inventory);

  // Transacciones de muestra (últimos 7 días)
  const today = new Date();
  const transactions = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    transactions.push(
      { id: uid(), date: ds, type: 'ingreso', desc: 'Ventas del día', amount: Math.floor(300 + Math.random() * 400) },
      { id: uid(), date: ds, type: 'gasto',   desc: 'Compra de masa', amount: Math.floor(80 + Math.random() * 60) }
    );
    if (i % 3 === 0) transactions.push({ id: uid(), date: ds, type: 'gasto', desc: 'Sueldo repartidor', amount: 200 });
  }
  setData('transactions', transactions);

  // Ventas de muestra
  const sales = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    PRODUCTS.forEach(p => {
      const qty = parseFloat((1 + Math.random() * 4).toFixed(0));
      sales.push({ id: uid(), date: ds, time: '09:30', productId: p.id, productName: p.name, qty, price: p.price, total: qty * p.price, payment: 'efectivo' });
    });
  }
  setData('sales', sales);

  // Clientes de muestra
  const clients = [
    { id: uid(), name: 'María González', phone: '4431234567', address: 'Calle Morelos 45, Col. Centro', lat: 19.4336, lng: -100.3562, notes: 'Le gusta la moringa' },
    { id: uid(), name: 'Juan Pérez',      phone: '4437654321', address: 'Av. Revolución 12, Col. Las Flores', lat: 19.4310, lng: -100.3590, notes: '' },
    { id: uid(), name: 'Rosa Martínez',   phone: '4439876543', address: 'Privada Hidalgo 8, Col. Lomas', lat: 19.4355, lng: -100.3540, notes: 'Pide solo nopal' },
  ];
  setData('clients', clients);

  // Pedidos de muestra
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tmStr = tomorrow.toISOString().split('T')[0];
  const orders = [
    { id: uid(), clientId: clients[0].id, clientName: clients[0].name, clientAddress: clients[0].address,
      items: [
        { productId: 'moringa', productName: 'Tortilla de Moringa', qty: 2, price: 30, total: 60 },
        { productId: 'maiz', productName: 'Tortilla de Maíz', qty: 1, price: 15, total: 15 },
      ], total: 75, date: tmStr, status: 'pendiente', notes: '' },
    { id: uid(), clientId: clients[1].id, clientName: clients[1].name, clientAddress: clients[1].address,
      items: [
        { productId: 'maiz', productName: 'Tortilla de Maíz', qty: 3, price: 15, total: 45 },
      ], total: 45, date: tmStr, status: 'pendiente', notes: '' },
    { id: uid(), clientId: clients[2].id, clientName: clients[2].name, clientAddress: clients[2].address,
      items: [
        { productId: 'nopal', productName: 'Tortilla de Nopal', qty: 1, price: 25, total: 25 },
        { productId: 'pasilla', productName: 'Tortilla de Chile Pasilla', qty: 2, price: 25, total: 50 },
      ], total: 75, date: tmStr, status: 'pendiente', notes: '' },
  ];
  setData('orders', orders);

  setData('initialized', true);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ---- Formato dinero ----
function fmt(n) { return '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ---- Fecha hoy ----
function today() { return new Date().toISOString().split('T')[0]; }

// ---- Toast ----
function toast(msg, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'error' : type === 'warning' ? 'warning' : '');
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  t.textContent = `${icons[type] || '✅'} ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

// ==========================================
// LOGIN
// ==========================================

// Role selector UI
document.querySelectorAll('.role-option input[name="loginRole"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.role-option').forEach(opt => opt.classList.remove('selected'));
    radio.closest('.role-option').classList.add('selected');
  });
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const pw = document.getElementById('loginPassword').value;
  const role = document.querySelector('input[name="loginRole"]:checked').value;
  const err = document.getElementById('loginError');
  if (pw === PASSWORDS[role]) {
    currentRole = role;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    initSampleData();
    applyRoleAccess(role);
    initDashboard();
  } else {
    err.style.display = 'block';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  }
});

// ==========================================
// ROLE ACCESS CONTROL
// ==========================================
const ROLE_MODULES = {
  control: ['resumen', 'pos', 'contador', 'inventario', 'crm', 'reportes'],
  equipo: ['pos', 'crm']
};

function applyRoleAccess(role) {
  const allowed = ROLE_MODULES[role] || [];
  document.querySelectorAll('.nav-item').forEach(item => {
    const mod = item.dataset.module;
    if (allowed.includes(mod)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
  // Switch to the first allowed module
  const defaultMod = allowed[0] || 'pos';
  switchModule(defaultMod);
}

// ==========================================
// DASHBOARD INIT
// ==========================================
function initDashboard() {
  // Fecha en topbar
  const d = new Date();
  document.getElementById('topbarDate').textContent =
    d.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const mod = item.dataset.module;
      switchModule(mod);
    });
  });

  // Sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) {
      currentRole = null;
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('loginPassword').value = '';
      document.getElementById('loginError').style.display = 'none';
    }
  });

  // Init modules
  initResumen();
  initPOS();
  initContador();
  initInventario();
  initCRM();
  initReportes();

  // Check low stock badge
  updateLowStockBadge();
}

function switchModule(mod) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('mod-' + mod).classList.add('active');
  document.querySelector(`.nav-item[data-module="${mod}"]`).classList.add('active');
  const titles = { resumen: 'Resumen', pos: 'Punto de Venta', contador: 'Contador Diario', inventario: 'Inventario', crm: 'CRM + Entregas', reportes: 'Reportes' };
  document.getElementById('topbarTitle').textContent = titles[mod] || mod;
  document.getElementById('sidebar').classList.remove('open');
  if (mod === 'resumen') renderResumen();
  if (mod === 'pos') renderPOS();
  if (mod === 'contador') renderContador();
  if (mod === 'inventario') renderInventario();
  if (mod === 'crm') renderCRM();
}

// ==========================================
// MÓDULO: RESUMEN
// ==========================================
function initResumen() { renderResumen(); }

function renderResumen() {
  const todayStr = today();
  const sales = getData('sales', []);
  const transactions = getData('transactions', []);

  const todaySales = sales.filter(s => s.date === todayStr);
  const todayTx = transactions.filter(t => t.date === todayStr);

  const ingresos = todaySales.reduce((a, s) => a + s.total, 0) +
                   todayTx.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const gastos = todayTx.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);

  // Effective cash = all-time ingresos - all-time gastos
  const allIngresos = sales.reduce((a, s) => a + s.total, 0) +
                      transactions.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const allGastos = transactions.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);
  const caja = allIngresos - allGastos;

  const utilidad = ingresos - gastos;

  // Break-even (simple: gastos fijos / margen)
  const avgPrice = PRODUCTS.reduce((a, p) => a + p.price, 0) / PRODUCTS.length;
  const avgCost = avgPrice * 0.45; // assume 45% COGS
  const margin = avgPrice - avgCost;
  const breakEven = gastos > 0 && margin > 0 ? (gastos / margin).toFixed(1) : '0';

  document.getElementById('sum-ingresos').textContent = fmt(ingresos);
  document.getElementById('sum-gastos').textContent = fmt(gastos);
  document.getElementById('sum-caja').textContent = fmt(caja);
  document.getElementById('sum-utilidad').textContent = fmt(utilidad);
  document.getElementById('sum-equilibrio').textContent = breakEven + ' docenas';

  // Top product this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSales = sales.filter(s => new Date(s.date) >= weekAgo);
  const byProduct = {};
  weekSales.forEach(s => { byProduct[s.productName] = (byProduct[s.productName] || 0) + s.qty; });
  const topProd = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('sum-top-product').textContent = topProd ? topProd[0].replace('Tortilla de ', '') : '—';

  // Recent sales
  const recentSales = [...todaySales].reverse().slice(0, 6);
  const rsl = document.getElementById('recentSalesList');
  if (recentSales.length === 0) {
    rsl.innerHTML = '<p class="empty-msg">Sin ventas hoy</p>';
  } else {
    rsl.innerHTML = recentSales.map(s =>
      `<div class="recent-item">
        <span class="ri-label">${s.emoji || ''} ${s.productName.replace('Tortilla de ', '')} — ${s.qty} docenas</span>
        <span class="ri-value green">${fmt(s.total)}</span>
      </div>`
    ).join('');
  }

  // Recent transactions
  const recentTx = [...transactions].reverse().slice(0, 6);
  const rtl = document.getElementById('recentTransList');
  if (recentTx.length === 0) {
    rtl.innerHTML = '<p class="empty-msg">Sin movimientos</p>';
  } else {
    rtl.innerHTML = recentTx.map(t =>
      `<div class="recent-item">
        <span class="ri-label">${t.type === 'ingreso' ? '💵' : '🧾'} ${t.desc}</span>
        <span class="ri-value ${t.type === 'ingreso' ? 'green' : 'red'}">${t.type === 'gasto' ? '-' : '+'}${fmt(t.amount)}</span>
      </div>`
    ).join('');
  }
}

// ==========================================
// MÓDULO: PUNTO DE VENTA
// ==========================================
let currentOrder = [];
let paymentMethod = 'efectivo';

function initPOS() {
  renderProductButtons();
  renderOrderItems();
  renderSalesToday();

  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paymentMethod = btn.dataset.method;
      document.getElementById('cashPaySection').style.display = paymentMethod === 'efectivo' ? 'block' : 'none';
    });
  });

  document.getElementById('cashReceived').addEventListener('input', updateChange);

  document.getElementById('confirmSaleBtn').addEventListener('click', confirmSale);
  document.getElementById('clearOrderBtn').addEventListener('click', () => {
    currentOrder = [];
    renderOrderItems();
  });
}

function renderPOS() {
  renderProductButtons();
  renderSalesToday();
}

function renderProductButtons() {
  const inventory = getData('inventory', []);
  const html = PRODUCTS.map(p => {
    const invItem = inventory.find(i => i.id.includes(p.id.split('_')[0]));
    const stockInfo = invItem ? `${invItem.qty} ${invItem.unit} disponibles` : '';
    return `<button class="product-btn" onclick="addToOrder('${p.id}')">
      <span class="pb-name">${p.emoji} ${p.name.replace('Tortilla de ', '')}</span>
      <span class="pb-price">${fmt(p.price)} / docena</span>
      ${stockInfo ? `<span class="pb-qty">📦 ${stockInfo}</span>` : ''}
    </button>`;
  }).join('');
  document.getElementById('productButtons').innerHTML = html;
}

function addToOrder(productId) {
  const prod = PRODUCTS.find(p => p.id === productId);
  if (!prod) return;
  const existing = currentOrder.find(o => o.productId === productId);
  if (existing) {
    existing.qty = existing.qty + 1;
    existing.total = existing.qty * existing.price;
  } else {
    currentOrder.push({ productId, productName: prod.name, emoji: prod.emoji, qty: 1, price: prod.price, total: prod.price * 1 });
  }
  renderOrderItems();
}

function renderOrderItems() {
  const container = document.getElementById('orderItems');
  if (currentOrder.length === 0) {
    container.innerHTML = '<p class="empty-msg">Agrega productos para comenzar</p>';
    document.getElementById('orderSubtotal').textContent = '$0.00';
    document.getElementById('changeDisplay').textContent = '$0.00';
    return;
  }
  container.innerHTML = currentOrder.map((item, idx) =>
    `<div class="order-item">
      <span>${item.emoji} ${item.productName.replace('Tortilla de ', '')}</span>
      <div class="oi-controls">
        <button class="oi-btn" onclick="changeQty(${idx}, -1)">−</button>
        <span class="oi-qty">${item.qty} docenas</span>
        <button class="oi-btn" onclick="changeQty(${idx}, 1)">+</button>
        <span style="min-width:60px;text-align:right;font-weight:600;">${fmt(item.total)}</span>
        <button class="oi-btn" style="color:var(--sys-red)" onclick="removeItem(${idx})">✕</button>
      </div>
    </div>`
  ).join('');
  const subtotal = currentOrder.reduce((a, o) => a + o.total, 0);
  document.getElementById('orderSubtotal').textContent = fmt(subtotal);
  updateChange();
}

function changeQty(idx, delta) {
  currentOrder[idx].qty = Math.max(1, currentOrder[idx].qty + delta);
  currentOrder[idx].total = currentOrder[idx].qty * currentOrder[idx].price;
  renderOrderItems();
}

function removeItem(idx) {
  currentOrder.splice(idx, 1);
  renderOrderItems();
}

function updateChange() {
  const subtotal = currentOrder.reduce((a, o) => a + o.total, 0);
  const received = parseFloat(document.getElementById('cashReceived').value) || 0;
  const change = received - subtotal;
  document.getElementById('changeDisplay').textContent = fmt(Math.max(0, change));
  document.getElementById('changeDisplay').style.color = change < 0 ? 'var(--sys-red)' : 'var(--sys-green)';
}

function confirmSale() {
  if (currentOrder.length === 0) { toast('Agrega al menos un producto', 'warning'); return; }
  const subtotal = currentOrder.reduce((a, o) => a + o.total, 0);
  if (paymentMethod === 'efectivo') {
    const received = parseFloat(document.getElementById('cashReceived').value) || 0;
    if (received < subtotal) { toast('El monto recibido es insuficiente', 'error'); return; }
  }
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);
  const sales = getData('sales', []);
  currentOrder.forEach(item => {
    sales.push({ id: uid(), date: today(), time: timeStr, productId: item.productId, productName: item.productName, emoji: item.emoji, qty: item.qty, price: item.price, total: item.total, payment: paymentMethod });
  });
  setData('sales', sales);
  toast(`Venta registrada: ${fmt(subtotal)} ✅`);
  currentOrder = [];
  document.getElementById('cashReceived').value = '';
  renderOrderItems();
  renderSalesToday();
  updateLowStockBadge();
}

function renderSalesToday() {
  const sales = getData('sales', []).filter(s => s.date === today());
  const body = document.getElementById('salesTodayBody');
  if (sales.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="empty-msg">Sin ventas hoy</td></tr>';
    document.getElementById('salesTodayTotal').textContent = 'Total: $0';
    return;
  }
  const sorted = [...sales].reverse();
  body.innerHTML = sorted.map(s =>
    `<tr>
      <td>${s.time}</td>
      <td>${s.emoji || ''} ${s.productName.replace('Tortilla de ', '')}</td>
      <td>${s.qty} docenas</td>
      <td>${fmt(s.price)}/docena</td>
      <td><strong>${fmt(s.total)}</strong></td>
      <td>${s.payment === 'efectivo' ? '💵' : '📲'} ${s.payment}</td>
    </tr>`
  ).join('');
  const total = sales.reduce((a, s) => a + s.total, 0);
  document.getElementById('salesTodayTotal').textContent = 'Total: ' + fmt(total);
}

// ==========================================
// MÓDULO: CONTADOR DIARIO
// ==========================================
function initContador() {
  const txDate = document.getElementById('txDate');
  txDate.value = today();
  document.getElementById('txFilterDate').value = today();

  document.getElementById('transactionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const type = document.getElementById('txType').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const desc = document.getElementById('txDesc').value.trim();
    const date = document.getElementById('txDate').value;
    if (!amount || !desc) { toast('Completa todos los campos', 'warning'); return; }

    const transactions = getData('transactions', []);
    transactions.push({ id: uid(), date, type, desc, amount });
    setData('transactions', transactions);
    this.reset();
    txDate.value = today();
    toast(`${type === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado: ${fmt(amount)}`);
    renderContador();
    updateLowStockBadge();
  });

  document.getElementById('txFilterDate').addEventListener('change', renderTransactionTable);
  document.getElementById('txFilterType').addEventListener('change', renderTransactionTable);
  renderContador();
}

function renderContador() {
  const transactions = getData('transactions', []);
  const sales = getData('sales', []);

  // Today's totals
  const todayStr = today();
  const todayTx = transactions.filter(t => t.date === todayStr);
  const todaySales = sales.filter(s => s.date === todayStr);

  const todayIncome = todaySales.reduce((a, s) => a + s.total, 0) +
                      todayTx.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const todayExpense = todayTx.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);

  // All-time caja
  const allIncome = sales.reduce((a, s) => a + s.total, 0) +
                    transactions.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const allExpense = transactions.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);

  document.getElementById('cntTotalIncome').textContent = fmt(todayIncome);
  document.getElementById('cntTotalExpense').textContent = fmt(todayExpense);
  document.getElementById('cntCash').textContent = fmt(allIncome - allExpense);
  const profit = todayIncome - todayExpense;
  document.getElementById('cntProfit').textContent = fmt(profit);
  document.getElementById('cntProfit').style.color = profit >= 0 ? 'var(--sys-green)' : 'var(--sys-red)';

  // Break-even
  const avgPrice = PRODUCTS.reduce((a, p) => a + p.price, 0) / PRODUCTS.length;
  const margin = avgPrice * 0.55; // 55% gross margin
  const be = todayExpense > 0 && margin > 0 ? (todayExpense / margin).toFixed(1) : '0';
  const todaySalesDocenas = todaySales.reduce((a, s) => a + s.qty, 0);
  document.getElementById('cntBreakeven').textContent = be + ' docenas';
  const diff = todaySalesDocenas - parseFloat(be);
  if (parseFloat(be) === 0) {
    document.getElementById('cntBreakevenHint').textContent = 'Sin gastos registrados hoy';
  } else if (diff >= 0) {
    document.getElementById('cntBreakevenHint').textContent = `✅ Superado por ${diff.toFixed(1)} docenas (${fmt(diff * avgPrice)})`;
  } else {
    document.getElementById('cntBreakevenHint').textContent = `⚠️ Faltan ${Math.abs(diff).toFixed(1)} docenas para cubrir gastos`;
  }

  renderTransactionTable();
}

function renderTransactionTable() {
  const transactions = getData('transactions', []);
  const filterDate = document.getElementById('txFilterDate').value;
  const filterType = document.getElementById('txFilterType').value;
  let filtered = transactions;
  if (filterDate) filtered = filtered.filter(t => t.date === filterDate);
  if (filterType) filtered = filtered.filter(t => t.type === filterType);
  filtered = [...filtered].reverse();

  const body = document.getElementById('txTableBody');
  if (filtered.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="empty-msg">Sin movimientos para los filtros seleccionados</td></tr>';
    return;
  }
  body.innerHTML = filtered.map(t =>
    `<tr>
      <td>${t.date}</td>
      <td><span class="${t.type === 'ingreso' ? 'badge-income' : 'badge-expense'}">${t.type === 'ingreso' ? '💵 Ingreso' : '🧾 Gasto'}</span></td>
      <td>${t.desc}</td>
      <td style="font-weight:700;color:${t.type === 'ingreso' ? 'var(--sys-green)' : 'var(--sys-red)'}">
        ${t.type === 'gasto' ? '-' : '+'}${fmt(t.amount)}
      </td>
      <td><button class="btn-danger-sys" onclick="deleteTransaction('${t.id}')">🗑️</button></td>
    </tr>`
  ).join('');
}

function deleteTransaction(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  const transactions = getData('transactions', []).filter(t => t.id !== id);
  setData('transactions', transactions);
  toast('Movimiento eliminado', 'warning');
  renderContador();
}

// ==========================================
// MÓDULO: INVENTARIO
// ==========================================
function initInventario() {
  document.getElementById('inventoryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('invName').value.trim();
    const qty = parseFloat(document.getElementById('invQty').value);
    const unit = document.getElementById('invUnit').value;
    const threshold = parseFloat(document.getElementById('invThreshold').value);
    const cost = parseFloat(document.getElementById('invCost').value) || 0;
    if (!name || isNaN(qty) || isNaN(threshold)) { toast('Completa todos los campos requeridos', 'warning'); return; }

    const inventory = getData('inventory', []);
    const existingIdx = inventory.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
      inventory[existingIdx] = { ...inventory[existingIdx], qty, unit, threshold, cost };
      toast('Material actualizado ✅');
    } else {
      inventory.push({ id: uid(), name, qty, unit, threshold, cost });
      toast('Material registrado ✅');
    }
    setData('inventory', inventory);
    this.reset();
    renderInventario();
    updateLowStockBadge();
  });
  renderInventario();
}

function renderInventario() {
  const inventory = getData('inventory', []);
  const container = document.getElementById('inventoryList');
  if (inventory.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay materiales registrados</p>';
    return;
  }
  container.innerHTML = inventory.map(item => {
    const pct = item.threshold > 0 ? Math.min(100, (item.qty / (item.threshold * 3)) * 100) : 100;
    let statusClass = 'ok', statusText = '✅ Normal', cardClass = '';
    if (item.qty === 0) { statusClass = 'out'; statusText = '🚨 Agotado'; cardClass = 'out'; }
    else if (item.qty <= item.threshold) { statusClass = 'low'; statusText = '⚠️ Stock bajo'; cardClass = 'low'; }
    const barColor = statusClass === 'ok' ? 'var(--sys-green)' : statusClass === 'low' ? 'var(--sys-yellow)' : 'var(--sys-red)';
    return `<div class="inv-card ${cardClass}">
      <div class="inv-card-info">
        <div class="inv-card-name">${item.name}</div>
        <div class="inv-card-qty">${item.qty} ${item.unit} — Mínimo: ${item.threshold} ${item.unit} ${item.cost ? `— $${item.cost}/u` : ''}</div>
        <div class="inv-progress"><div class="inv-progress-bar" style="width:${pct}%;background:${barColor}"></div></div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="inv-card-status inv-status-${statusClass}">${statusText}</div>
        <div class="inv-card-actions" style="margin-top:0.4rem;">
          <input class="inv-edit-input" type="number" value="${item.qty}" min="0" step="0.1" id="inv-qty-${item.id}" />
          <button class="btn-secondary-sys" onclick="updateInvQty('${item.id}')">💾</button>
          <button class="btn-danger-sys" onclick="deleteInvItem('${item.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateInvQty(id) {
  const newQty = parseFloat(document.getElementById('inv-qty-' + id).value);
  if (isNaN(newQty) || newQty < 0) { toast('Cantidad inválida', 'error'); return; }
  const inventory = getData('inventory', []);
  const idx = inventory.findIndex(i => i.id === id);
  if (idx >= 0) { inventory[idx].qty = newQty; setData('inventory', inventory); }
  toast('Stock actualizado ✅');
  renderInventario();
  updateLowStockBadge();
}

function deleteInvItem(id) {
  if (!confirm('¿Eliminar este material?')) return;
  const inventory = getData('inventory', []).filter(i => i.id !== id);
  setData('inventory', inventory);
  toast('Material eliminado', 'warning');
  renderInventario();
  updateLowStockBadge();
}

function updateLowStockBadge() {
  const inventory = getData('inventory', []);
  const lowCount = inventory.filter(i => i.qty <= i.threshold).length;
  const badge = document.getElementById('lowStockBadge');
  if (badge) {
    badge.style.display = lowCount > 0 ? 'inline-flex' : 'none';
    badge.textContent = `⚠️ ${lowCount} material${lowCount > 1 ? 'es' : ''} bajo`;
  }
}

// ==========================================
// MÓDULO: CRM + ENTREGAS
// ==========================================
let deliveryMap = null;
let deliveryMarkers = [];

function initCRM() {
  // CRM Tabs
  document.querySelectorAll('.crm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.crm-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.crm-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('crm-' + tab.dataset.crm).classList.add('active');
      if (tab.dataset.crm === 'ruta') initMap();
    });
  });

  // Client form
  document.getElementById('clientForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('cliName').value.trim();
    if (!name) { toast('Ingresa el nombre del cliente', 'warning'); return; }
    const clients = getData('clients', []);
    clients.push({
      id: uid(),
      name,
      phone: document.getElementById('cliPhone').value.trim(),
      address: document.getElementById('cliAddress').value.trim(),
      lat: parseFloat(document.getElementById('cliLat').value) || null,
      lng: parseFloat(document.getElementById('cliLng').value) || null,
      notes: document.getElementById('cliNotes').value.trim(),
    });
    setData('clients', clients);
    this.reset();
    toast(`Cliente "${name}" registrado ✅`);
    renderCRM();
  });

  // Client search
  document.getElementById('cliSearch').addEventListener('input', renderClientList);

  // Phone search for customer
  let orderSelectedClient = null;
  const phoneInput = document.getElementById('orderPhone');
  const phoneResult = document.getElementById('phoneSearchResult');
  const newClientFields = document.getElementById('newClientFields');

  phoneInput.addEventListener('input', function() {
    const phone = this.value.replace(/\D/g, '');
    if (phone.length < 3) {
      phoneResult.style.display = 'none';
      newClientFields.style.display = 'none';
      orderSelectedClient = null;
      return;
    }
    const clients = getData('clients', []);
    const found = clients.find(c => (c.phone || '').replace(/\D/g, '').includes(phone));
    if (found) {
      orderSelectedClient = found;
      phoneResult.style.display = 'block';
      phoneResult.className = 'phone-search-result found';
      phoneResult.innerHTML = `<span class="phone-found-icon">✅</span> <strong>${found.name}</strong>${found.address ? ` — 📍 ${found.address}` : ''}`;
      newClientFields.style.display = 'none';
    } else {
      orderSelectedClient = null;
      phoneResult.style.display = 'block';
      phoneResult.className = 'phone-search-result not-found';
      phoneResult.innerHTML = '🆕 Cliente nuevo — completa los datos:';
      newClientFields.style.display = 'block';
    }
  });

  // Add product line button
  document.getElementById('addProductLineBtn').addEventListener('click', addProductLine);
  addProductLine(); // Start with one product line

  // Order form submit with multi-product support
  document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const phone = document.getElementById('orderPhone').value.trim();
    const date = document.getElementById('orderDate').value;
    if (!phone) { toast('Ingresa un teléfono', 'warning'); return; }
    if (!date) { toast('Selecciona fecha de entrega', 'warning'); return; }

    // Collect product lines
    const lines = document.querySelectorAll('.product-line');
    const items = [];
    for (const line of lines) {
      const productId = line.querySelector('.pl-product').value;
      const qty = parseFloat(line.querySelector('.pl-qty').value);
      if (!productId || !qty || qty < 1) continue;
      const product = PRODUCTS.find(p => p.id === productId);
      items.push({
        productId,
        productName: product?.name || '',
        qty,
        price: product?.price || 0,
        total: qty * (product?.price || 0),
      });
    }
    if (items.length === 0) { toast('Agrega al menos un producto', 'warning'); return; }

    // Resolve or create client
    let client = orderSelectedClient;
    if (!client) {
      const name = document.getElementById('orderClientName').value.trim();
      const address = document.getElementById('orderClientAddress').value.trim();
      if (!name) { toast('Ingresa el nombre del cliente nuevo', 'warning'); return; }
      client = { id: uid(), name, phone, address, lat: null, lng: null, notes: '' };
      const clients = getData('clients', []);
      clients.push(client);
      setData('clients', clients);
      toast(`Cliente "${name}" registrado automáticamente ✅`);
    }

    const orderTotal = items.reduce((a, i) => a + i.total, 0);
    const orders = getData('orders', []);
    orders.push({
      id: uid(), clientId: client.id, clientName: client.name, clientAddress: client.address || '',
      items, total: orderTotal, date, status: 'pendiente',
      notes: document.getElementById('orderNotes').value.trim(),
    });
    setData('orders', orders);
    this.reset();
    orderSelectedClient = null;
    phoneResult.style.display = 'none';
    newClientFields.style.display = 'none';
    document.getElementById('orderProductLines').innerHTML = '';
    addProductLine();
    updateOrderRunningTotal();
    toast('Pedido registrado ✅');
    renderCRM();
  });

  // Map date + route button
  document.getElementById('mapDateFilter').value = today();
  document.getElementById('loadRouteBtn').addEventListener('click', loadRoute);

  renderCRM();
}

function renderCRM() {
  renderClientList();
  renderOrderList();
}

function renderClientList() {
  const clients = getData('clients', []);
  const orders = getData('orders', []);
  const q = document.getElementById('cliSearch').value.toLowerCase();
  const filtered = q ? clients.filter(c => c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)) : clients;
  const container = document.getElementById('clientList');
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin clientes registrados</p>';
    return;
  }
  container.innerHTML = filtered.map(c => {
    const clientOrders = orders.filter(o => o.clientId === c.id);
    const totalPurchases = clientOrders.reduce((a, o) => a + o.total, 0);
    return `<div class="client-card">
      <div class="client-card-header">
        <div>
          <div class="client-name">👤 ${c.name}</div>
          ${c.phone ? `<div class="client-detail">📱 ${c.phone}</div>` : ''}
          ${c.address ? `<div class="client-detail">📍 ${c.address}</div>` : ''}
          <div class="client-detail">🛒 ${clientOrders.length} pedido(s) — Total: ${fmt(totalPurchases)}</div>
          ${c.notes ? `<div class="client-notes">"${c.notes}"</div>` : ''}
        </div>
        <div class="client-card-actions">
          ${c.phone ? `<a href="https://wa.me/52${c.phone.replace(/\D/g,'')}" target="_blank" class="btn-secondary-sys">💬</a>` : ''}
          <button class="btn-danger-sys" onclick="deleteClient('${c.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function deleteClient(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  const clients = getData('clients', []).filter(c => c.id !== id);
  setData('clients', clients);
  toast('Cliente eliminado', 'warning');
  renderCRM();
}

function renderOrderList() {
  const orders = getData('orders', []).filter(o => o.status !== 'entregado');
  const container = document.getElementById('orderList');
  if (orders.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin pedidos activos</p>';
    return;
  }
  container.innerHTML = [...orders].reverse().map(o => {
    // Support both legacy single-product orders and new multi-product orders
    const items = o.items || [{ productName: o.productName, qty: o.qty, total: o.total }];
    const orderTotal = o.total || items.reduce((a, i) => a + (i.total || 0), 0);
    const productsHtml = items.map(i =>
      `<div class="order-product-item">📦 ${(i.productName || '').replace('Tortilla de ','')} — ${i.qty} doc. — ${fmt(i.total)}</div>`
    ).join('');
    return `<div class="order-card-new">
      <div class="order-card-top">
        <button class="order-delete-icon" onclick="deleteOrder('${o.id}')" title="Eliminar pedido">🗑️</button>
      </div>
      <div class="order-card-body">
        <div class="order-client-name">👤 ${o.clientName}</div>
        ${o.clientAddress ? `<div class="order-detail">📍 ${o.clientAddress}</div>` : ''}
        <div class="order-detail">📅 Entrega: ${o.date}</div>
        <div class="order-products-list">${productsHtml}</div>
        <div class="order-total-line">Total: ${fmt(orderTotal)}</div>
        ${o.notes ? `<div class="order-detail order-notes-text">"${o.notes}"</div>` : ''}
      </div>
      ${o.status === 'pendiente'
        ? `<button class="btn-entregado" onclick="markDelivered('${o.id}')">✅ Entregado</button>`
        : `<div class="order-badge-done-full">✅ Entregado</div>`
      }
    </div>`;
  }).join('');
}

// ---- Multi-product line helpers ----
function addProductLine() {
  const container = document.getElementById('orderProductLines');
  const line = document.createElement('div');
  line.className = 'product-line';
  line.innerHTML = `
    <select class="pl-product" required>
      <option value="">— Producto —</option>
      ${PRODUCTS.map(p => `<option value="${p.id}">${p.emoji} ${p.name.replace('Tortilla de ','')}</option>`).join('')}
    </select>
    <input type="number" class="pl-qty" placeholder="Docenas" min="1" step="1" value="1" required />
    <span class="pl-line-total">$0.00</span>
    <button type="button" class="pl-remove" title="Quitar">✕</button>
  `;
  container.appendChild(line);

  line.querySelector('.pl-product').addEventListener('change', updateOrderRunningTotal);
  line.querySelector('.pl-qty').addEventListener('input', updateOrderRunningTotal);
  line.querySelector('.pl-remove').addEventListener('click', function() {
    if (container.querySelectorAll('.product-line').length > 1) {
      line.remove();
      updateOrderRunningTotal();
    } else {
      toast('Debe haber al menos un producto', 'warning');
    }
  });
  updateOrderRunningTotal();
}

function updateOrderRunningTotal() {
  let total = 0;
  document.querySelectorAll('.product-line').forEach(line => {
    const productId = line.querySelector('.pl-product').value;
    const qty = parseFloat(line.querySelector('.pl-qty').value) || 0;
    const product = PRODUCTS.find(p => p.id === productId);
    const lineTotal = qty * (product?.price || 0);
    line.querySelector('.pl-line-total').textContent = productId ? fmt(lineTotal) : '$0.00';
    total += lineTotal;
  });
  document.getElementById('orderRunningTotal').textContent = fmt(total);
}

function markDelivered(id) {
  const orders = getData('orders', []);
  const idx = orders.findIndex(o => o.id === id);
  if (idx >= 0) { orders[idx].status = 'entregado'; setData('orders', orders); }
  toast('Entrega marcada como completada ✅');
  renderCRM();
  if (deliveryMap) loadRoute();
}

function deleteOrder(id) {
  if (!confirm('¿Eliminar este pedido?')) return;
  const orders = getData('orders', []).filter(o => o.id !== id);
  setData('orders', orders);
  toast('Pedido eliminado', 'warning');
  renderCRM();
}

function initMap() {
  if (deliveryMap) { loadRoute(); return; }
  deliveryMap = L.map('deliveryMap').setView([19.432, -100.356], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(deliveryMap);

  // Click para obtener coordenadas
  deliveryMap.on('click', function(e) {
    toast(`Coords: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)} (copiadas al portapapeles)`, 'success');
    navigator.clipboard?.writeText(`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
  });

  loadRoute();
}

function loadRoute() {
  if (!deliveryMap) return;
  const date = document.getElementById('mapDateFilter').value;
  const orders = getData('orders', []).filter(o => o.date === date);
  const clients = getData('clients', []);

  // Clear old markers
  deliveryMarkers.forEach(m => deliveryMap.removeLayer(m));
  deliveryMarkers = [];

  // HQ marker
  const hqIcon = L.divIcon({ html: '🌽', className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
  const hqMarker = L.marker([19.4326, -100.3572], { icon: hqIcon }).addTo(deliveryMap);
  hqMarker.bindPopup('<strong>Xela Tortillería</strong><br/>Punto de origen');
  deliveryMarkers.push(hqMarker);

  const stops = [];
  orders.forEach((order, i) => {
    const client = clients.find(c => c.id === order.clientId);
    if (client && client.lat && client.lng) {
      const icon = L.divIcon({
        html: `<div style="background:${order.status==='entregado'?'#38A169':'#DD6B20'};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${i+1}</div>`,
        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const marker = L.marker([client.lat, client.lng], { icon }).addTo(deliveryMap);
      marker.bindPopup(`<strong>${i+1}. ${client.name}</strong><br/>${(order.items || [{productName: order.productName, qty: order.qty}]).map(it => `${(it.productName||'').replace('Tortilla de ','')}: ${it.qty} doc.`).join('<br/>')}<br/>📍 ${client.address || ''}<br/><span style="color:${order.status==='entregado'?'green':'orange'}">${order.status}</span>`);
      deliveryMarkers.push(marker);
      stops.push({ order, client, num: i + 1 });
    }
  });

  // Draw route line
  if (stops.length > 0) {
    const latlngs = [[19.4326, -100.3572], ...stops.map(s => [s.client.lat, s.client.lng])];
    const line = L.polyline(latlngs, { color: '#2D6A0F', weight: 3, dashArray: '6, 8', opacity: 0.7 }).addTo(deliveryMap);
    deliveryMarkers.push(line);
    deliveryMap.fitBounds(line.getBounds().pad(0.1));
  }

  // Route stops list
  const routeStops = document.getElementById('routeStops');
  if (stops.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-msg';
    p.textContent = `Sin entregas para ${date || 'la fecha seleccionada'}`;
    routeStops.innerHTML = '';
    routeStops.appendChild(p);
  } else {
    routeStops.innerHTML = stops.map(s =>
      `<div class="route-stop ${s.order.status === 'entregado' ? 'done' : ''}">
        <div class="stop-num">${s.num}</div>
        <div class="stop-info">
          <div class="stop-name">${s.client.name}</div>
          <div class="stop-addr">${s.client.address || ''} — ${(s.order.items || [{productName: s.order.productName, qty: s.order.qty}]).map(it => `${(it.productName||'').replace('Tortilla de ','')} ${it.qty} doc.`).join(', ')}</div>
        </div>
        ${s.order.status !== 'entregado'
          ? `<button class="stop-complete-btn" onclick="markDelivered('${s.order.id}')">✅ Listo</button>`
          : `<span class="stop-done-label">✅ Entregado</span>`
        }
      </div>`
    ).join('');
  }
}

// ==========================================
// MÓDULO: REPORTES
// ==========================================
function initReportes() {
  // Set default week to current week
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  document.getElementById('reportWeek').value = `${year}-W${String(week).padStart(2,'0')}`;

  document.getElementById('generateReportBtn').addEventListener('click', generateReport);

  // Auto-generate on Mondays
  if (now.getDay() === 1) {
    setTimeout(generateReport, 500);
  }
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDates(weekStr) {
  // weekStr = "2024-W15"
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekPart);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return { startDate, endDate };
}

function generateReport() {
  const weekStr = document.getElementById('reportWeek').value;
  if (!weekStr) { toast('Selecciona una semana', 'warning'); return; }

  const { startDate, endDate } = getWeekDates(weekStr);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const sales = getData('sales', []).filter(s => s.date >= startStr && s.date <= endStr);
  const transactions = getData('transactions', []).filter(t => t.date >= startStr && t.date <= endStr);

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const totalIncome = totalSales + transactions.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  // Show report
  document.getElementById('reportPlaceholder').style.display = 'none';
  document.getElementById('reportContent').style.display = 'block';

  // Header
  document.getElementById('reportPeriod').textContent =
    `Semana ${weekStr.split('-W')[1]} — ${startDate.toLocaleDateString('es-MX', { month: 'long', day: 'numeric' })} al ${endDate.toLocaleDateString('es-MX', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  document.getElementById('reportGenerated').textContent = new Date().toLocaleString('es-MX');

  // KPIs
  document.getElementById('reportKpis').innerHTML = `
    <div class="report-kpi green"><div class="rk-label">💵 Total Ventas</div><div class="rk-value">${fmt(totalSales)}</div></div>
    <div class="report-kpi red"><div class="rk-label">🧾 Total Gastos</div><div class="rk-value">${fmt(totalExpense)}</div></div>
    <div class="report-kpi purple"><div class="rk-label">📊 Utilidad Neta</div><div class="rk-value" style="color:${netProfit>=0?'var(--sys-green)':'var(--sys-red)'}">${fmt(netProfit)}</div></div>
    <div class="report-kpi orange"><div class="rk-label">📦 Docenas Vendidas</div><div class="rk-value">${sales.reduce((a,s)=>a+s.qty,0).toFixed(1)} docenas</div></div>
  `;

  // By product chart
  const byProduct = {};
  PRODUCTS.forEach(p => { byProduct[p.id] = { name: p.name.replace('Tortilla de ',''), qty: 0, total: 0, emoji: p.emoji }; });
  sales.forEach(s => {
    if (byProduct[s.productId]) { byProduct[s.productId].qty += s.qty; byProduct[s.productId].total += s.total; }
  });
  const maxQty = Math.max(...Object.values(byProduct).map(p => p.qty), 0.1);
  document.getElementById('reportByProduct').innerHTML = Object.values(byProduct).map(p =>
    `<div class="chart-bar-item">
      <div class="chart-bar-label"><span>${p.emoji} ${p.name}</span><span>${p.qty.toFixed(1)} docenas — ${fmt(p.total)}</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(p.qty/maxQty*100).toFixed(1)}%"></div></div>
    </div>`
  ).join('');

  // Daily income vs expense
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  const dayLabels = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' };
  const maxDay = Math.max(...days.map(d => {
    const inc = sales.filter(s=>s.date===d).reduce((a,s)=>a+s.total,0) + transactions.filter(t=>t.date===d&&t.type==='ingreso').reduce((a,t)=>a+t.amount,0);
    const exp = transactions.filter(t=>t.date===d&&t.type==='gasto').reduce((a,t)=>a+t.amount,0);
    return Math.max(inc, exp);
  }), 1);

  document.getElementById('reportDailyChart').innerHTML = days.map(d => {
    const dt = new Date(d + 'T12:00:00');
    const inc = sales.filter(s=>s.date===d).reduce((a,s)=>a+s.total,0) + transactions.filter(t=>t.date===d&&t.type==='ingreso').reduce((a,t)=>a+t.amount,0);
    const exp = transactions.filter(t=>t.date===d&&t.type==='gasto').reduce((a,t)=>a+t.amount,0);
    return `<div class="chart-bar-item">
      <div class="chart-bar-label"><span>${dayLabels[dt.getDay()]}</span><span style="color:var(--sys-green)">${fmt(inc)}</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill income" style="width:${(inc/maxDay*100).toFixed(1)}%"></div></div>
      <div class="chart-bar-track" style="margin-top:2px;"><div class="chart-bar-fill expense" style="width:${(exp/maxDay*100).toFixed(1)}%"></div></div>
    </div>`;
  }).join('');

  // Transaction table
  const allTx = [
    ...sales.map(s => ({ date: s.date, type: 'ingreso', desc: `${s.productName.replace('Tortilla de ','')} ${s.qty} docenas`, amount: s.total })),
    ...transactions.map(t => ({ date: t.date, type: t.type, desc: t.desc, amount: t.amount }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById('reportTxBody').innerHTML = allTx.map(t =>
    `<tr>
      <td>${t.date}</td>
      <td><span class="${t.type==='ingreso'?'badge-income':'badge-expense'}">${t.type==='ingreso'?'💵 Ingreso':'🧾 Gasto'}</span></td>
      <td>${t.desc}</td>
      <td style="font-weight:700;color:${t.type==='ingreso'?'var(--sys-green)':'var(--sys-red)'}">
        ${t.type==='gasto'?'-':'+'} ${fmt(t.amount)}
      </td>
    </tr>`
  ).join('') || '<tr><td colspan="4" class="empty-msg">Sin transacciones en este período</td></tr>';

  // Conclusion
  const bestProduct = Object.values(byProduct).sort((a,b)=>b.qty-a.qty)[0];
  document.getElementById('reportConclusion').innerHTML = `
    <h4>📋 Resumen Ejecutivo</h4>
    <p>
      Durante esta semana se generaron <strong>${fmt(totalSales)}</strong> en ventas con gastos de <strong>${fmt(totalExpense)}</strong>,
      resultando en una <strong style="color:${netProfit>=0?'var(--sys-green)':'var(--sys-red)'}">utilidad neta de ${fmt(netProfit)}</strong>.
      ${bestProduct && bestProduct.qty > 0 ? `La variedad más vendida fue <strong>${bestProduct.emoji} ${bestProduct.name}</strong> con ${bestProduct.qty.toFixed(1)} docenas vendidas.` : ''}
      ${netProfit < 0 ? '⚠️ Esta semana los gastos superaron los ingresos. Se recomienda revisar los costos operativos.' : '✅ Semana rentable. ¡Buen trabajo!'}
    </p>
  `;

  toast('Reporte generado ✅');
}
