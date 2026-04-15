// ==========================================
// XELA TORTILLERÍA — SISTEMA INTERNO
// ==========================================

// ---- Contraseña ----
const PASSWORDS = { control: 'xela2024', equipo: 'xelaempleado' };
let currentRole = null;

// ---- Último reporte generado (para PDF) ----
let lastReportData = null;

// ---- Productos del catálogo ----
const PRODUCTS = [
  { id: 'maiz',       name: 'Tortilla de Maíz',         price: 15, unit: 'docena', emoji: '🌽' },
  { id: 'moringa',    name: 'Tortilla de Moringa',       price: 30, unit: 'docena', emoji: '🌿' },
  { id: 'nopal',      name: 'Tortilla de Nopal',         price: 25, unit: 'docena', emoji: '🌵' },
  { id: 'pasilla',    name: 'Tortilla de Chile Pasilla', price: 25, unit: 'docena', emoji: '🌶️' },
  { id: 'agua_medio', name: 'Agua ½ litro',              price: 35, unit: 'pieza',  emoji: '💧' },
  { id: 'agua_litro', name: 'Agua 1 litro',              price: 45, unit: 'pieza',  emoji: '🚰' },
  { id: 'salsa',      name: 'Salsa',                     price: 35, unit: 'pieza',  emoji: '🫙' },
];

// ---- Firestore collection name mapping ----
const COLLECTION_MAP = {
  sales:        'ventas',
  transactions: 'gastos',
  inventory:    'inventario',
  clients:      'clientes',
  orders:       'pedidos',
  cortes:       'cortes',
};
const CONFIG_KEYS = ['initialized', 'corte_last_date'];

// ---- In-memory cache (mirrors Firestore state) ----
const _cache = {};

// ---- Tracks which collections have received their first Firestore snapshot ----
const _loaded = {};

// ---- Firestore ready tracking (resolves after first snapshot per collection) ----
const _readyResolvers = {};
const _readyPromises = {};
[...Object.keys(COLLECTION_MAP), 'config'].forEach(k => {
  _readyPromises[k] = new Promise(r => { _readyResolvers[k] = r; });
});

// ---- Start real-time Firestore listeners (called after login, runs in background) ----
function startFirestoreSync() {
  Object.entries(COLLECTION_MAP).forEach(([key, colName]) => {
    db.collection(colName).onSnapshot(snapshot => {
      _cache[key] = [];
      snapshot.forEach(doc => _cache[key].push(doc.data()));
      _loaded[key] = true;
      if (_readyResolvers[key]) { _readyResolvers[key](); delete _readyResolvers[key]; }
      _refreshUI(key);
    }, err => {
      console.error('Firestore error [' + colName + ']:', err);
      if (!_cache[key]) _cache[key] = [];
      _loaded[key] = true;
      if (_readyResolvers[key]) { _readyResolvers[key](); delete _readyResolvers[key]; }
    });
  });

  db.collection('config').doc('settings').onSnapshot(doc => {
    const data = doc.exists ? doc.data() : {};
    CONFIG_KEYS.forEach(k => { _cache[k] = data[k]; });
    _loaded['config'] = true;
    if (_readyResolvers['config']) { _readyResolvers['config'](); delete _readyResolvers['config']; }
  }, err => {
    console.error('Firestore config error:', err);
    _loaded['config'] = true;
    if (_readyResolvers['config']) { _readyResolvers['config'](); delete _readyResolvers['config']; }
  });
}

// ---- Re-render UI when Firestore data changes from another device ----
function _refreshUI(key) {
  if (!currentRole) return;
  const dash = document.getElementById('dashboard');
  if (!dash || dash.style.display === 'none') return;
  try {
    switch (key) {
      case 'sales':
        renderResumen(); renderSalesToday(); renderContador(); break;
      case 'transactions':
        renderResumen(); renderContador(); break;
      case 'inventory':
        renderInventario(); updateLowStockBadge(); renderProductButtons(); break;
      case 'clients':
        if (document.getElementById('mod-crm').classList.contains('active')) renderClientList(); break;
      case 'orders':
        if (document.getElementById('mod-crm').classList.contains('active')) renderCRM(); break;
      case 'cortes':
        renderContador(); break;
    }
  } catch (e) { console.error('UI refresh error for ' + key + ':', e); }
}

// ---- Storage API (replaces localStorage) ----
function getData(key, def) {
  const val = _cache[key];
  if (val !== undefined) return val;
  return def;
}

function setData(key, val) {
  if (CONFIG_KEYS.includes(key)) {
    _cache[key] = val;
    db.collection('config').doc('settings').set({ [key]: val }, { merge: true })
      .catch(e => console.error('Firestore config write error:', e));
    return;
  }
  const colName = COLLECTION_MAP[key];
  if (!colName) return;

  const prev = _cache[key] || [];
  _cache[key] = val;

  const validItems = val.filter(d => d.id !== undefined && d.id !== null);
  const newIds = new Set(validItems.map(d => String(d.id)));
  const batch = db.batch();
  validItems.forEach(item => batch.set(db.collection(colName).doc(String(item.id)), item));
  prev.forEach(item => { if (item.id !== undefined && item.id !== null && !newIds.has(String(item.id))) batch.delete(db.collection(colName).doc(String(item.id))); });
  batch.commit().catch(e => console.error('Firestore write error [' + colName + ']:', e));
}

// ---- Inicializar datos de muestra si están vacíos ----
function initSampleData() {
  if (getData('initialized', false)) return;

  // Inventario inicial
  const inventory = [
    { id: 'masa_maiz',    name: 'Masa de maíz',        qty: 6.25, unit: 'kg',     threshold: 2.5, cost: 12 },
    { id: 'moringa_polvo', name: 'Moringa en polvo',   qty: 0.875, unit: 'kg',     threshold: 0.5,  cost: 180 },
    { id: 'nopal_fresco',  name: 'Nopal fresco',       qty: 2,     unit: 'kg',     threshold: 1.25, cost: 15 },
    { id: 'chile_pasilla', name: 'Chile pasilla seco', qty: 1.5,  unit: 'docena', threshold: 2,   cost: 80 },
    { id: 'cal',           name: 'Cal',                qty: 10,   unit: 'docena', threshold: 3,   cost: 5 },
    { id: 'gas',           name: 'Gas LP',             qty: 1,    unit: 'litro',  threshold: 1,   cost: 300 },
    { id: 'agua_medio',    name: 'Agua ½ litro',       qty: 12,   unit: 'litro',  threshold: 5,   cost: 10,  litersPerUnit: 0.5 },
    { id: 'agua_litro',    name: 'Agua 1 litro',       qty: 20,   unit: 'litro',  threshold: 5,   cost: 15,  litersPerUnit: 1 },
    { id: 'salsa',         name: 'Salsa',              qty: 24,   unit: 'pieza',  threshold: 8,   cost: 12 },
  ];
  setData('inventory', inventory);

  // Transacciones de muestra (últimos 7 días)
  const today = new Date();
  const transactions = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = localDateStr(d);
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
    const ds = localDateStr(d);
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
  const tmStr = localDateStr(tomorrow);
  const orders = [
    { id: uid(), clientId: clients[0].id, clientName: clients[0].name, clientAddress: clients[0].address,
      items: [
        { productId: 'moringa', productName: 'Tortilla de Moringa', qty: 2, price: 30, total: 60 },
        { productId: 'maiz', productName: 'Tortilla de Maíz', qty: 1, price: 15, total: 15 },
      ], subtotal: 75, deliveryFee: 0, total: 75, date: tmStr, status: 'pendiente', notes: '' },
    { id: uid(), clientId: clients[1].id, clientName: clients[1].name, clientAddress: clients[1].address,
      items: [
        { productId: 'maiz', productName: 'Tortilla de Maíz', qty: 3, price: 15, total: 45 },
      ], subtotal: 45, deliveryFee: 0, total: 45, date: tmStr, status: 'pendiente', notes: '' },
    { id: uid(), clientId: clients[2].id, clientName: clients[2].name, clientAddress: clients[2].address,
      items: [
        { productId: 'nopal', productName: 'Tortilla de Nopal', qty: 1, price: 25, total: 25 },
        { productId: 'pasilla', productName: 'Tortilla de Chile Pasilla', qty: 2, price: 25, total: 50 },
      ], subtotal: 75, deliveryFee: 0, total: 75, date: tmStr, status: 'pendiente', notes: '' },
  ];
  setData('orders', orders);

  setData('initialized', true);
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ---- HTML escape to prevent XSS ----
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Conversión kg → docenas (1 kg masa = 4 docenas) ----
const KG_TO_DOCENAS = 4;

// ---- Pluralización de unidades (español) ----
function pluralUnit(unit, qty) { return qty === 1 ? unit : unit + 's'; }

// ---- Formato dinero ----
function fmt(n) { return '$' + parseFloat(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ---- Fecha hoy (local, no UTC) ----
function localDateStr(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function today() { return localDateStr(); }

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

// ---- Show inline loading spinner inside an element ----
function showSpinner(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.tagName === 'TBODY') {
    // Determine colspan from the nearest thead
    const table = el.closest('table');
    const cols = table ? (table.querySelector('thead tr')?.cells.length || 4) : 4;
    el.innerHTML = `<tr><td colspan="${cols}" class="empty-msg"><div class="mod-loading"><span class="mod-spinner"></span> Cargando datos…</div></td></tr>`;
  } else {
    el.innerHTML = '<div class="mod-loading"><span class="mod-spinner"></span> Cargando datos…</div>';
  }
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
    applyRoleAccess(role);
    initDashboard();
    // Start Firestore sync in background; init sample data only after config is confirmed empty
    startFirestoreSync();
    _readyPromises.config.then(() => initSampleData());
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
      _moduleInit.clear();
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('loginPassword').value = '';
      document.getElementById('loginError').style.display = 'none';
    }
  });
}

// ---- Tracks which modules have been initialised (event listeners attached) ----
const _moduleInit = new Set();

function switchModule(mod) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('mod-' + mod).classList.add('active');
  document.querySelector(`.nav-item[data-module="${mod}"]`).classList.add('active');
  const titles = { resumen: 'Resumen', pos: 'Punto de Venta', contador: 'Contador Diario', inventario: 'Inventario', crm: 'CRM + Entregas', reportes: 'Reportes' };
  document.getElementById('topbarTitle').textContent = titles[mod] || mod;
  document.getElementById('sidebar').classList.remove('open');

  if (!_moduleInit.has(mod)) {
    _moduleInit.add(mod);
    // First visit: run full init (attaches listeners + renders)
    switch (mod) {
      case 'resumen':    initResumen(); break;
      case 'pos':        initPOS(); break;
      case 'contador':   initContador(); break;
      case 'inventario': initInventario(); break;
      case 'crm':        initCRM(); break;
      case 'reportes':   initReportes(); break;
    }
  } else {
    // Subsequent visits: re-render only
    if (mod === 'resumen')    renderResumen();
    if (mod === 'pos')        renderPOS();
    if (mod === 'contador')   renderContador();
    if (mod === 'inventario') renderInventario();
    if (mod === 'crm')        renderCRM();
  }
}

// ==========================================
// MÓDULO: RESUMEN
// ==========================================
function initResumen() { renderResumen(); }

function renderResumen() {
  if (!_loaded.sales || !_loaded.transactions) {
    ['sum-ingresos', 'sum-gastos', 'sum-caja', 'sum-utilidad', 'sum-equilibrio', 'sum-top-product'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="mod-spinner"></span>';
    });
    showSpinner('recentSalesList');
    showSpinner('recentTransList');
    return;
  }
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
    rsl.innerHTML = recentSales.map(s => {
      const prod = PRODUCTS.find(p => p.id === s.productId);
      const unitLabel = prod ? prod.unit : 'docena';
      return `<div class="recent-item">
        <span class="ri-label">${s.emoji || ''} ${s.productName.replace('Tortilla de ', '')} — ${s.qty} ${pluralUnit(unitLabel, s.qty)}</span>
        <span class="ri-value green">${fmt(s.total)}</span>
      </div>`;
    }).join('');
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

// ---- Delivery fee ----
const DELIVERY_FEE = 20;
const FREE_DELIVERY_DOCENAS = 3;

// ---- Delivery zone (Zitácuaro city center, 3 km radius) ----
const ZONE_CENTER = { lat: 19.4333, lng: -100.3667 };
const ZONE_RADIUS_KM = 3;
const ZONE_EXTRA_FEE = 20;

// ---- CRM order cart ----
let _orderCart = {};

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
  document.getElementById('discountValue')?.addEventListener('input', () => { renderOrderItems(); });
  document.getElementById('discountType')?.addEventListener('change', () => { renderOrderItems(); });
  document.getElementById('deliveryToggle')?.addEventListener('change', () => { renderOrderItems(); });

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
  if (!_loaded.inventory) { showSpinner('productButtons'); return; }
  const inventory = getData('inventory', []);
  const html = PRODUCTS.map(p => {
    // Exact match first; fall back to prefix match for legacy inventory IDs (e.g. masa_maiz → maiz)
    const invItem = inventory.find(i => i.id === p.id) || inventory.find(i => i.id.includes(p.id.split('_')[0]));
    const stockInfo = invItem ? `${invItem.qty} ${invItem.unit} disponibles` : '';
    return `<button class="product-btn" onclick="addToOrder('${p.id}')">
      <span class="pb-name">${p.emoji} ${p.name.replace('Tortilla de ', '')}</span>
      <span class="pb-price">${fmt(p.price)} / ${p.unit}</span>
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

function renderSmartPaymentButtons(subtotal) {
  const container = document.getElementById('smartPayBtns');
  if (!container) return;
  if (!subtotal || subtotal <= 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  const next50 = Math.ceil(subtotal / 50) * 50;
  const next100 = Math.ceil(subtotal / 100) * 100;
  const suggestions = [...new Set([next50, next100, 200, 500, 1000])]
    .filter(b => b > subtotal)
    .sort((a, b) => a - b)
    .slice(0, 3);
  let html = `<button type="button" class="bill-btn bill-btn-exact" onclick="setBillAmount(${subtotal})">Exacto ${fmt(subtotal)}</button>`;
  suggestions.forEach(b => {
    html += `<button type="button" class="bill-btn" onclick="setBillAmount(${b})">$${b.toLocaleString('es-MX')}</button>`;
  });
  container.innerHTML = html;
  container.style.display = 'grid';
}

function getDiscount(subtotal) {
  const type = document.getElementById('discountType')?.value || 'pct';
  const val = parseFloat(document.getElementById('discountValue')?.value) || 0;
  if (!val || val <= 0) return 0;
  if (type === 'pct') return Math.min(subtotal, subtotal * val / 100);
  return Math.min(subtotal, val);
}

// Helper: calculate delivery fee from items array
// items: [{productId, qty}] objects OR [[productId, qty]] entries
function calcDeliveryFee(items) {
  let docenas = 0;
  for (const item of items) {
    const productId = Array.isArray(item) ? item[0] : item.productId;
    const qty       = Array.isArray(item) ? item[1] : item.qty;
    const prod = PRODUCTS.find(p => p.id === productId);
    if (prod && prod.unit === 'docena') docenas += qty;
  }
  const freeDelivery = docenas >= FREE_DELIVERY_DOCENAS;
  return { docenas, freeDelivery, deliveryFee: freeDelivery ? 0 : DELIVERY_FEE };
}

// Check if coordinates fall inside the delivery zone (haversineDistance defined later, but hoisted)
function isInsideZone(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return true;
  return haversineDistance(ZONE_CENTER, { lat: parseFloat(lat), lng: parseFloat(lng) }) <= ZONE_RADIUS_KM;
}

// ---- CRM zone tracking for the current order form ----
let _orderClientLat = null;
let _orderClientLng = null;

function updateOrderZone(lat, lng) {
  _orderClientLat = (lat != null && !isNaN(lat)) ? parseFloat(lat) : null;
  _orderClientLng = (lng != null && !isNaN(lng)) ? parseFloat(lng) : null;
  const warning = document.getElementById('orderZoneWarning');
  if (warning) {
    const inside = isInsideZone(_orderClientLat, _orderClientLng);
    warning.style.display = (_orderClientLat != null && _orderClientLng != null && !inside) ? 'block' : 'none';
  }
  renderOrderCart();
}

// Returns delivery fee for POS (0 when delivery toggle is off)
function getPOSDeliveryFee() {
  if (!document.getElementById('deliveryToggle')?.checked) return 0;
  return calcDeliveryFee(currentOrder).deliveryFee;
}

function renderOrderItems() {
  const container = document.getElementById('orderItems');
  if (currentOrder.length === 0) {
    container.innerHTML = '<p class="empty-msg">Agrega productos para comenzar</p>';
    document.getElementById('orderSubtotal').textContent = '$0.00';
    document.getElementById('changeDisplay').textContent = '$0.00';
    const discountRow = document.getElementById('discountAmountRow');
    if (discountRow) discountRow.style.display = 'none';
    const deliveryFeeRowEl = document.getElementById('deliveryFeeRow');
    if (deliveryFeeRowEl) deliveryFeeRowEl.style.display = 'none';
    const finalTotalEl = document.getElementById('orderFinalTotal');
    if (finalTotalEl) finalTotalEl.textContent = '$0.00';
    renderSmartPaymentButtons(0);
    return;
  }
  container.innerHTML = currentOrder.map((item, idx) => {
    const prod = PRODUCTS.find(p => p.id === item.productId);
    const unitLabel = prod ? pluralUnit(prod.unit, item.qty) : 'docenas';
    return `<div class="order-item">
      <span>${item.emoji} ${item.productName.replace('Tortilla de ', '')}</span>
      <div class="oi-controls">
        <button class="oi-btn" onclick="changeQty(${idx}, -1)">−</button>
        <span class="oi-qty">${item.qty} ${unitLabel}</span>
        <button class="oi-btn" onclick="changeQty(${idx}, 1)">+</button>
        <span style="min-width:60px;text-align:right;font-weight:600;">${fmt(item.total)}</span>
        <button class="oi-btn" style="color:var(--sys-red)" onclick="removeItem(${idx})">✕</button>
      </div>
    </div>`;
  }).join('');
  const subtotal = currentOrder.reduce((a, o) => a + o.total, 0);
  document.getElementById('orderSubtotal').textContent = fmt(subtotal);
  const discount = getDiscount(subtotal);
  const discountRow = document.getElementById('discountAmountRow');
  if (discountRow) {
    if (discount > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('discountAmount').textContent = '-' + fmt(discount);
    } else {
      discountRow.style.display = 'none';
    }
  }
  // Delivery fee (POS)
  const isDelivery = document.getElementById('deliveryToggle')?.checked;
  const deliveryFeeRowEl = document.getElementById('deliveryFeeRow');
  const deliveryFeeAmt = document.getElementById('deliveryFeeAmt');
  const deliveryFeeLabel = document.getElementById('deliveryFeeLabel');
  let posDeliveryFee = 0;
  if (isDelivery) {
    const { freeDelivery, deliveryFee } = calcDeliveryFee(currentOrder);
    posDeliveryFee = deliveryFee;
    if (deliveryFeeRowEl) {
      deliveryFeeRowEl.style.display = 'flex';
      if (freeDelivery) {
        if (deliveryFeeLabel) deliveryFeeLabel.textContent = '🚚 Envío:';
        if (deliveryFeeAmt) { deliveryFeeAmt.textContent = 'Envío gratis 🎉'; deliveryFeeAmt.style.color = 'var(--sys-green)'; }
      } else {
        if (deliveryFeeLabel) deliveryFeeLabel.textContent = '🚚 Envío:';
        if (deliveryFeeAmt) { deliveryFeeAmt.textContent = '+' + fmt(deliveryFee); deliveryFeeAmt.style.color = 'var(--sys-orange)'; }
      }
    }
  } else {
    if (deliveryFeeRowEl) deliveryFeeRowEl.style.display = 'none';
  }
  const finalTotalEl = document.getElementById('orderFinalTotal');
  if (finalTotalEl) finalTotalEl.textContent = fmt(subtotal - discount + posDeliveryFee);
  renderSmartPaymentButtons(subtotal - discount + posDeliveryFee);
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
  const discount = getDiscount(subtotal);
  const deliveryFee = getPOSDeliveryFee();
  const finalTotal = subtotal - discount + deliveryFee;
  const received = parseFloat(document.getElementById('cashReceived').value) || 0;
  const change = received - finalTotal;
  document.getElementById('changeDisplay').textContent = fmt(Math.max(0, change));
  document.getElementById('changeDisplay').style.color = change < 0 ? 'var(--sys-red)' : 'var(--sys-green)';
}

function setBillAmount(amount) {
  document.getElementById('cashReceived').value = amount;
  updateChange();
}

function confirmSale() {
  if (currentOrder.length === 0) { toast('Agrega al menos un producto', 'warning'); return; }
  const subtotal = currentOrder.reduce((a, o) => a + o.total, 0);
  const discount = getDiscount(subtotal);
  const isDelivery = document.getElementById('deliveryToggle')?.checked;
  const deliveryFee = getPOSDeliveryFee();
  const finalTotal = subtotal - discount + deliveryFee;
  if (paymentMethod === 'efectivo') {
    const received = parseFloat(document.getElementById('cashReceived').value) || 0;
    if (received < finalTotal) { toast('El monto recibido es insuficiente', 'error'); return; }
  }
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 5);
  const sales = getData('sales', []);
  currentOrder.forEach(item => {
    sales.push({ id: uid(), date: today(), time: timeStr, productId: item.productId, productName: item.productName, emoji: item.emoji, qty: item.qty, price: item.price, total: item.total, payment: paymentMethod });
  });
  setData('sales', sales);
  const transactions = getData('transactions', []);
  if (discount > 0) {
    const discType = document.getElementById('discountType')?.value || 'pct';
    const discVal = parseFloat(document.getElementById('discountValue')?.value) || 0;
    transactions.push({ id: uid(), date: today(), type: 'gasto', desc: `Descuento cliente frecuente (${discType === 'pct' ? discVal + '%' : '$' + discVal})`, amount: discount });
  }
  if (deliveryFee > 0) {
    transactions.push({ id: uid(), date: today(), type: 'ingreso', desc: 'Cargo envío a domicilio', amount: deliveryFee });
  }
  setData('transactions', transactions);
  let deliveryMsg = '';
  if (isDelivery) deliveryMsg = deliveryFee > 0 ? ' + 🚚 $20 envío' : ' 🎉 envío gratis';
  const discountMsg = discount > 0 ? ` (desc. ${fmt(discount)})` : '';
  toast(`Venta registrada: ${fmt(finalTotal)}${discountMsg}${deliveryMsg} ✅`);
  currentOrder = [];
  document.getElementById('cashReceived').value = '';
  const discountValueEl = document.getElementById('discountValue');
  if (discountValueEl) discountValueEl.value = '';
  const discountRow = document.getElementById('discountAmountRow');
  if (discountRow) discountRow.style.display = 'none';
  const deliveryFeeRowEl = document.getElementById('deliveryFeeRow');
  if (deliveryFeeRowEl) deliveryFeeRowEl.style.display = 'none';
  const deliveryToggle = document.getElementById('deliveryToggle');
  if (deliveryToggle) deliveryToggle.checked = false;
  renderOrderItems();
  renderSalesToday();
  updateLowStockBadge();
}

function renderSalesToday() {
  if (!_loaded.sales) { showSpinner('salesTodayBody'); return; }
  const sales = getData('sales', []).filter(s => s.date === today());
  const body = document.getElementById('salesTodayBody');
  if (sales.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="empty-msg">Sin ventas hoy</td></tr>';
    document.getElementById('salesTodayTotal').textContent = 'Total: $0';
    return;
  }
  const sorted = [...sales].reverse();
  body.innerHTML = sorted.map(s => {
    const prod = PRODUCTS.find(p => p.id === s.productId);
    const unitLabel = prod ? prod.unit : 'docena';
    return `<tr>
      <td>${s.time}</td>
      <td>${s.emoji || ''} ${s.productName.replace('Tortilla de ', '')}</td>
      <td>${s.qty} ${pluralUnit(unitLabel, s.qty)}</td>
      <td>${fmt(s.price)}/${unitLabel}</td>
      <td><strong>${fmt(s.total)}</strong></td>
      <td>${s.payment === 'efectivo' ? '💵' : '📲'} ${s.payment}</td>
    </tr>`;
  }).join('');
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

  // Corte de Caja button
  document.getElementById('corteCajaBtn')?.addEventListener('click', openCorteModal);
  document.getElementById('verCortesBtn')?.addEventListener('click', openCortesHist);

  // Show "Ver Historial de Cortes" only for Dueño (control role)
  if (currentRole === 'control') {
    document.getElementById('verCortesBtn').style.display = 'block';
  }

  renderContador();
}


// ==========================================
// CORTE DE CAJA
// ==========================================
function openCorteModal() {
  document.getElementById('corteStep1').style.display = 'block';
  document.getElementById('corteStep2').style.display = 'none';
  document.getElementById('corteStep3').style.display = 'none';
  document.getElementById('cortePassword').value = '';
  document.getElementById('cortePasswordError').style.display = 'none';
  document.getElementById('corteCajaModal').style.display = 'flex';
}

function closeCorteModal() {
  document.getElementById('corteCajaModal').style.display = 'none';
}

function authorizeCorte() {
  const pw = document.getElementById('cortePassword').value;
  if (pw !== PASSWORDS.control) {
    document.getElementById('cortePasswordError').style.display = 'block';
    document.getElementById('cortePassword').value = '';
    return;
  }
  document.getElementById('cortePasswordError').style.display = 'none';
  document.getElementById('corteStep1').style.display = 'none';
  document.getElementById('corteStep2').style.display = 'block';
  document.getElementById('corteWho').value = '';
  document.getElementById('corteWho').focus();
}

function showCorteSummary() {
  const who = document.getElementById('corteWho').value.trim();
  if (!who) { toast('Ingresa el nombre de quien realiza el corte', 'warning'); return; }

  const todayStr = today();
  const now = new Date();
  const sales = getData('sales', []).filter(s => s.date === todayStr);
  const transactions = getData('transactions', []).filter(t => t.date === todayStr);
  const orders = getData('orders', []).filter(o => o.date === todayStr && o.status === 'entregado');

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const ingresos = totalSales + transactions.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const gastos = transactions.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);
  const netProfit = ingresos - gastos;

  const allSalesAll = getData('sales', []);
  const allTxAll = getData('transactions', []);
  const allIncome = allSalesAll.reduce((a, s) => a + s.total, 0) + allTxAll.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const allExpense = allTxAll.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);
  const cash = allIncome - allExpense;

  const byProduct = {};
  sales.forEach(s => { byProduct[s.productName] = (byProduct[s.productName] || 0) + s.qty; });
  const topProductEntries = Object.entries(byProduct).sort((a, b) => b[1] - a[1]);
  const topProduct = topProductEntries.length > 0 ? topProductEntries[0] : null;

  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  document.getElementById('corteSummaryContent').innerHTML = `
    <div class="corte-summary-header">
      <div class="corte-who">👤 Realizado por: <strong>${esc(who)}</strong></div>
      <div class="corte-datetime">📅 ${dateStr} — <strong>${timeStr}</strong></div>
    </div>
    <div class="corte-kpis">
      <div class="corte-kpi green"><div class="ck-label">💵 Total Ventas</div><div class="ck-value">${fmt(ingresos)}</div></div>
      <div class="corte-kpi red"><div class="ck-label">🧾 Total Gastos</div><div class="ck-value">${fmt(gastos)}</div></div>
      <div class="corte-kpi ${netProfit >= 0 ? 'purple' : 'red'}"><div class="ck-label">📊 Utilidad Neta</div><div class="ck-value" style="color:${netProfit>=0?'var(--sys-green)':'var(--sys-red)'}">${fmt(netProfit)}</div></div>
      <div class="corte-kpi blue"><div class="ck-label">🏦 Efectivo en Caja</div><div class="ck-value">${fmt(cash)}</div></div>
      <div class="corte-kpi orange"><div class="ck-label">🥇 Más Vendido</div><div class="ck-value">${topProduct ? esc(topProduct[0].replace('Tortilla de ','')) : '—'}</div></div>
      <div class="corte-kpi teal"><div class="ck-label">🚚 Entregas del Día</div><div class="ck-value">${orders.length}</div></div>
    </div>
  `;
  // Store draft corte data for confirmation
  document.getElementById('corteStep2').style.display = 'none';
  document.getElementById('corteStep3').style.display = 'block';

  // Save draft for confirmCorte to use
  window._corteDraft = { who, date: todayStr, time: timeStr, ingresos, gastos, netProfit, cash, topProduct: topProduct ? topProduct[0] : '', ordersDelivered: orders.length };
}

function confirmCorte() {
  const draft = window._corteDraft;
  if (!draft) return;

  const cortes = getData('cortes', []);
  cortes.push({ id: uid(), ...draft });
  setData('cortes', cortes);

  // Reset today's counters by storing corte date
  setData('corte_last_date', today());

  closeCorteModal();
  toast('✅ Corte de caja realizado y guardado', 'success');
  renderContador();
}

function openCortesHist() {
  if (currentRole !== 'control') { toast('Solo el Dueño puede ver este historial', 'error'); return; }
  const cortes = getData('cortes', []);
  const list = document.getElementById('cortesHistList');
  if (cortes.length === 0) {
    list.innerHTML = '<p class="empty-msg">Sin cortes registrados</p>';
  } else {
    list.innerHTML = [...cortes].reverse().map(c => `
      <div class="corte-hist-item">
        <div class="chi-header">
          <span class="chi-date">📅 ${c.date} — <strong>${c.time}</strong></span>
          <span class="chi-who">👤 ${esc(c.who)}</span>
        </div>
        <div class="chi-kpis">
          <span>💵 Ventas: <strong>${fmt(c.ingresos)}</strong></span>
          <span>🧾 Gastos: <strong>${fmt(c.gastos)}</strong></span>
          <span>📊 Utilidad: <strong style="color:${c.netProfit>=0?'var(--sys-green)':'var(--sys-red)'}">${fmt(c.netProfit)}</strong></span>
          <span>🏦 Caja: <strong>${fmt(c.cash)}</strong></span>
          <span>🥇 Top: <strong>${c.topProduct ? esc(c.topProduct.replace('Tortilla de ','')) : '—'}</strong></span>
          <span>🚚 Entregas: <strong>${c.ordersDelivered}</strong></span>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('cortesHistModal').style.display = 'flex';
}

function renderContador() {
  if (!_loaded.sales || !_loaded.transactions || !_loaded.config) {
    ['cntTotalIncome', 'cntTotalExpense', 'cntCash', 'cntProfit', 'cntBreakeven'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="mod-spinner"></span>';
    });
    showSpinner('txTableBody');
    return;
  }
  const transactions = getData('transactions', []);
  const sales = getData('sales', []);

  // Today's totals — reset to 0 if corte was done today
  const todayStr = today();
  const corteLastDate = getData('corte_last_date', '');
  const corteDoneToday = corteLastDate === todayStr;

  const todayTx = transactions.filter(t => t.date === todayStr);
  const todaySales = sales.filter(s => s.date === todayStr);

  const todayIncome = corteDoneToday ? 0 : (todaySales.reduce((a, s) => a + s.total, 0) +
                      todayTx.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0));
  const todayExpense = corteDoneToday ? 0 : todayTx.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);

  // All-time caja
  const allIncome = sales.reduce((a, s) => a + s.total, 0) +
                    transactions.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const allExpense = transactions.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);

  document.getElementById('cntTotalIncome').textContent = fmt(todayIncome);
  document.getElementById('cntTotalExpense').textContent = fmt(todayExpense);
  if (corteDoneToday) {
    document.getElementById('cntTotalIncome').title = 'Corte de caja realizado hoy';
    document.getElementById('cntTotalIncome').style.opacity = '0.5';
  } else {
    document.getElementById('cntTotalIncome').title = '';
    document.getElementById('cntTotalIncome').style.opacity = '';
  }
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
  if (corteDoneToday) {
    document.getElementById('cntBreakevenHint').textContent = '✅ Corte de caja realizado hoy';
  } else if (parseFloat(be) === 0) {
    document.getElementById('cntBreakevenHint').textContent = 'Sin gastos registrados hoy';
  } else if (diff >= 0) {
    document.getElementById('cntBreakevenHint').textContent = `✅ Superado por ${diff.toFixed(1)} docenas (${fmt(diff * avgPrice)})`;
  } else {
    document.getElementById('cntBreakevenHint').textContent = `⚠️ Faltan ${Math.abs(diff).toFixed(1)} docenas para cubrir gastos`;
  }

  renderTransactionTable();
}

function renderTransactionTable() {
  if (!_loaded.transactions) { showSpinner('txTableBody'); return; }
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
  // Live yield preview
  function updateYieldPreview() {
    const qty = parseFloat(document.getElementById('invQty').value) || 0;
    const unit = document.getElementById('invUnit').value;
    const preview = document.getElementById('invYieldPreview');
    if (unit === 'kg' && qty > 0) {
      document.getElementById('invYieldValue').textContent = (qty * KG_TO_DOCENAS).toFixed(1);
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }
  document.getElementById('invQty').addEventListener('input', updateYieldPreview);
  document.getElementById('invUnit').addEventListener('change', updateYieldPreview);

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
    document.getElementById('invYieldPreview').style.display = 'none';
    renderInventario();
    updateLowStockBadge();
  });
  renderInventario();
}

function renderInventario() {
  if (!_loaded.inventory) { showSpinner('inventoryList'); return; }
  const container = document.getElementById('inventoryList');
  const inventory = getData('inventory', []);
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
    let yieldLine = '';
    if (item.unit === 'kg') {
      yieldLine = `<div class="inv-yield-display">🫓 Rendimiento estimado: <strong>${(item.qty * KG_TO_DOCENAS).toFixed(1)} docenas</strong></div>`;
    } else if (item.unit === 'litro' && item.litersPerUnit) {
      yieldLine = `<div class="inv-yield-display">📦 Unidades estimadas: <strong>${(item.qty / item.litersPerUnit).toFixed(0)} piezas</strong></div>`;
    }
    return `<div class="inv-card ${cardClass}">
      <div class="inv-card-info">
        <div class="inv-card-name">${item.name}</div>
        <div class="inv-card-qty">${item.qty} ${item.unit} — Mínimo: ${item.threshold} ${item.unit} ${item.cost ? `— $${item.cost}/u` : ''}</div>
        ${yieldLine}
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
let optimizedStops = [];
let routeStarted = false;

function initCRM() {
  // Lazy-load Leaflet CSS (only needed for the map in CRM)
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  // CRM Tabs
  document.querySelectorAll('.crm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.crm-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.crm-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('crm-' + tab.dataset.crm).classList.add('active');
      if (tab.dataset.crm === 'ruta') initMap();
      if (tab.dataset.crm === 'historial') renderHistorialList();
    });
  });

  // Historial search listeners
  document.getElementById('histClientSearch')?.addEventListener('input', renderHistorialList);
  document.getElementById('histDateFilter')?.addEventListener('change', renderHistorialList);

  // Check and create recurring orders for today
  checkRecurringOrders();

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
      updateOrderZone(null, null);
      return;
    }
    const clients = getData('clients', []);
    const found = clients.find(c => (c.phone || '').replace(/\D/g, '').endsWith(phone));
    if (found) {
      orderSelectedClient = found;
      phoneResult.style.display = 'block';
      phoneResult.className = 'phone-search-result found';
      phoneResult.innerHTML = `<span class="phone-found-icon">✅</span> <strong>${found.name}</strong>${found.address ? ` — 📍 ${found.address}` : ''}`;
      newClientFields.style.display = 'none';
      updateOrderZone(found.lat, found.lng);
    } else {
      orderSelectedClient = null;
      phoneResult.style.display = 'block';
      phoneResult.className = 'phone-search-result not-found';
      phoneResult.innerHTML = '🆕 Cliente nuevo — completa los datos:';
      newClientFields.style.display = 'block';
      updateOrderZone(null, null);
    }
  });

  // Zone updates are now driven by Places autocomplete (see initGooglePlaces)

  // POS-style product grid for orders
  renderOrderProductGrid();

  // Auto-date: default to today
  document.getElementById('orderDate').value = today();
  document.getElementById('toggleCustomDate').addEventListener('click', function() {
    const wrap = document.getElementById('customDateWrap');
    const isVisible = wrap.style.display !== 'none';
    wrap.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      document.getElementById('orderDateCustom').value = document.getElementById('orderDate').value;
    }
  });
  document.getElementById('orderDateCustom').addEventListener('change', function() {
    document.getElementById('orderDate').value = this.value;
  });
  document.getElementById('resetDateToday').addEventListener('click', function() {
    document.getElementById('orderDate').value = today();
    document.getElementById('orderDateCustom').value = today();
    document.getElementById('customDateWrap').style.display = 'none';
  });

  // Order form submit with POS-style cart
  document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const phone = document.getElementById('orderPhone').value.trim();
    const date = document.getElementById('orderDate').value;
    if (!phone) { toast('Ingresa un teléfono', 'warning'); return; }
    if (!date) { toast('Selecciona fecha de entrega', 'warning'); return; }

    // Collect items from cart
    const items = [];
    const orderCart = getOrderCart();
    for (const [productId, qty] of Object.entries(orderCart)) {
      if (qty < 1) continue;
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
      const newLat = parseFloat(document.getElementById('orderClientLat')?.value) || null;
      const newLng = parseFloat(document.getElementById('orderClientLng')?.value) || null;
      client = { id: uid(), name, phone, address, lat: newLat || null, lng: newLng || null, notes: '' };
      const clients = getData('clients', []);
      clients.push(client);
      setData('clients', clients);
      toast(`Cliente "${name}" registrado automáticamente ✅`);
    }

    const subtotal = items.reduce((a, i) => a + i.total, 0);
    const { freeDelivery, deliveryFee } = calcDeliveryFee(items);
    const outOfZone = !isInsideZone(client.lat, client.lng) && client.lat != null && client.lng != null;
    const zoneExtra = outOfZone ? ZONE_EXTRA_FEE : 0;
    const totalDeliveryFee = deliveryFee + zoneExtra;
    const orderTotal = subtotal + totalDeliveryFee;
    const orders = getData('orders', []);
    orders.push({
      id: uid(), clientId: client.id, clientName: client.name, clientAddress: client.address || '',
      items, subtotal, deliveryFee: totalDeliveryFee, outOfZone: outOfZone || false, total: orderTotal, date, status: 'pendiente',
      notes: document.getElementById('orderNotes').value.trim(),
    });
    setData('orders', orders);
    this.reset();
    orderSelectedClient = null;
    _orderClientLat = null;
    _orderClientLng = null;
    const zoneWarning = document.getElementById('orderZoneWarning');
    if (zoneWarning) zoneWarning.style.display = 'none';
    phoneResult.style.display = 'none';
    newClientFields.style.display = 'none';
    // Reset cart
    _orderCart = {};
    renderOrderProductGrid();
    renderOrderCart();
    // Reset date to today
    document.getElementById('orderDate').value = today();
    document.getElementById('customDateWrap').style.display = 'none';
    const deliveryInfo = freeDelivery && !outOfZone ? ' — Envío gratis 🎉' : ` — 🚚 Envío $${totalDeliveryFee}`;
    const zoneInfo = outOfZone ? ' ⚠️ Fuera de zona' : '';
    toast(`Pedido registrado: ${fmt(orderTotal)}${deliveryInfo}${zoneInfo} ✅`);
    renderCRM();
  });

  // Map date + route button
  document.getElementById('mapDateFilter').value = today();
  document.getElementById('loadRouteBtn').addEventListener('click', loadRoute);
  document.getElementById('startDeliveriesBtn').addEventListener('click', startDeliveries);
  document.getElementById('openGoogleMapsBtn').addEventListener('click', openInGoogleMaps);

  // Load Google Maps Places API for address autocomplete
  loadGoogleMapsPlaces().then(initGooglePlaces);

  renderCRM();
}

function renderCRM() {
  renderClientList();
  renderOrderList();
  // Update historial if that tab is active
  const histTab = document.querySelector('.crm-tab[data-crm="historial"]');
  if (histTab && histTab.classList.contains('active')) renderHistorialList();
}

// ---- Google Maps Places API — lazy loader ----
const MAPS_API_KEY = 'AIzaSyA5orV2cj41j6YZHi7Tn-fX62rM3zOLUfI';

function loadGoogleMapsPlaces() {
  if (window.google?.maps?.places) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-maps-api')) {
      // Script tag already injected; wait for it to finish loading
      document.getElementById('google-maps-api').addEventListener('load', resolve);
      document.getElementById('google-maps-api').addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-api';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&language=es&region=MX`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { console.warn('Google Maps API failed to load'); resolve(); };
    document.head.appendChild(script);
  });
}

// ---- Google Places Autocomplete for address fields ----
function initGooglePlaces() {
  if (!window.google?.maps?.places) return;

  // Bias results to Zitácuaro, Michoacán bounding box
  const ZITACUARO_BOUNDS = new google.maps.LatLngBounds(
    new google.maps.LatLng(19.38, -100.43),
    new google.maps.LatLng(19.49, -100.31)
  );

  const AC_OPTIONS = {
    bounds: ZITACUARO_BOUNDS,
    componentRestrictions: { country: 'mx' },
    fields: ['formatted_address', 'geometry'],
    strictBounds: false,
  };

  // ---- Client registration form ----
  const cliAddressInput = document.getElementById('cliAddress');
  if (cliAddressInput && !cliAddressInput.dataset.acInit) {
    cliAddressInput.dataset.acInit = '1';
    const acCli = new google.maps.places.Autocomplete(cliAddressInput, AC_OPTIONS);
    acCli.addListener('place_changed', () => {
      const place = acCli.getPlace();
      if (!place?.geometry?.location) return;
      cliAddressInput.value = place.formatted_address || cliAddressInput.value;
      document.getElementById('cliLat').value = place.geometry.location.lat();
      document.getElementById('cliLng').value = place.geometry.location.lng();
      const hint = document.getElementById('cliAddressHint');
      if (hint) hint.style.display = 'inline';
    });
    // Clear coords if user edits the address manually after autocomplete
    cliAddressInput.addEventListener('input', () => {
      document.getElementById('cliLat').value = '';
      document.getElementById('cliLng').value = '';
      const hint = document.getElementById('cliAddressHint');
      if (hint) hint.style.display = 'none';
    });
  }

  // ---- New client address in order form ----
  const orderAddressInput = document.getElementById('orderClientAddress');
  if (orderAddressInput && !orderAddressInput.dataset.acInit) {
    orderAddressInput.dataset.acInit = '1';
    const acOrder = new google.maps.places.Autocomplete(orderAddressInput, AC_OPTIONS);
    acOrder.addListener('place_changed', () => {
      const place = acOrder.getPlace();
      if (!place?.geometry?.location) return;
      orderAddressInput.value = place.formatted_address || orderAddressInput.value;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      document.getElementById('orderClientLat').value = lat;
      document.getElementById('orderClientLng').value = lng;
      const hint = document.getElementById('orderAddressHint');
      if (hint) hint.style.display = 'inline';
      updateOrderZone(lat, lng);
    });
    // Clear coords if user edits address manually
    orderAddressInput.addEventListener('input', () => {
      document.getElementById('orderClientLat').value = '';
      document.getElementById('orderClientLng').value = '';
      const hint = document.getElementById('orderAddressHint');
      if (hint) hint.style.display = 'none';
      updateOrderZone(null, null);
    });
  }
}

function renderClientList() {
  if (!_loaded.clients || !_loaded.orders) { showSpinner('clientList'); return; }
  const clients = getData('clients', []);
  const orders = getData('orders', []);
  const q = document.getElementById('cliSearch').value.toLowerCase();
  const filtered = q ? clients.filter(c => c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)) : clients;
  const container = document.getElementById('clientList');
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin clientes registrados</p>';
    return;
  }
  const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  container.innerHTML = filtered.map(c => {
    const clientOrders = orders.filter(o => o.clientId === c.id);
    const totalPurchases = clientOrders.reduce((a, o) => a + o.total, 0);
    const recurring = c.recurringOrders || [];
    const recurringHtml = recurring.map((r, ri) => {
      const prod = PRODUCTS.find(p => p.id === r.productId);
      return `<div class="recurring-item">`
        + `${prod ? prod.emoji : ''} ${prod ? prod.name.replace('Tortilla de ', '') : r.productId} × ${r.qty} — ${DAY_NAMES[r.day]}`
        + ` <button type="button" class="btn-rec-del" onclick="deleteRecurring('${c.id}',${ri})">✕</button></div>`;
    }).join('');
    const productOptions = PRODUCTS.map(p =>
      `<option value="${p.id}">${p.emoji} ${p.name.replace('Tortilla de ', '')}</option>`
    ).join('');
    const dayOptions = DAY_NAMES.map((d, i) =>
      `<option value="${i}">${d}</option>`
    ).join('');
    return `<div class="client-card">
      <div class="client-card-header">
        <div>
          <div class="client-name">👤 ${esc(c.name)}</div>
          ${c.phone ? `<div class="client-detail">📱 ${esc(c.phone)}</div>` : ''}
          ${c.address ? `<div class="client-detail">📍 ${esc(c.address)}</div>` : ''}
          <div class="client-detail">🛒 ${clientOrders.length} pedido(s) — Total: ${fmt(totalPurchases)}</div>
          ${c.notes ? `<div class="client-notes">${esc(c.notes)}</div>` : ''}
        </div>
        <div class="client-card-actions">
          ${c.phone ? `<a href="https://wa.me/52${c.phone.replace(/\D/g,'')}" target="_blank" class="btn-secondary-sys">💬</a>` : ''}
          <button class="btn-danger-sys" onclick="deleteClient('${c.id}')">🗑️</button>
        </div>
      </div>
      <details class="recurring-section">
        <summary class="recurring-summary">🔄 Pedido Recurrente</summary>
        <div class="recurring-body">
          ${recurringHtml || '<p class="empty-msg small">Sin pedidos recurrentes</p>'}
          <form class="recurring-form" onsubmit="saveRecurring('${c.id}', event)">
            <select class="rec-product" name="recProduct">${productOptions}</select>
            <input class="rec-qty" type="number" name="recQty" placeholder="Cant." min="1" step="1" value="1" required />
            <select class="rec-day" name="recDay">${dayOptions}</select>
            <button type="submit" class="btn-secondary-sys rec-add-btn">➕ Agregar</button>
          </form>
        </div>
      </details>
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

function saveRecurring(clientId, event) {
  event.preventDefault();
  const form = event.target;
  const productId = form.recProduct.value;
  const qty = parseInt(form.recQty.value) || 1;
  const day = parseInt(form.recDay.value);
  const clients = getData('clients', []);
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx < 0) return;
  if (!clients[idx].recurringOrders) clients[idx].recurringOrders = [];
  clients[idx].recurringOrders.push({ productId, qty, day });
  setData('clients', clients);
  toast('Pedido recurrente guardado ✅');
  renderClientList();
}

function deleteRecurring(clientId, recurringIdx) {
  const clients = getData('clients', []);
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx < 0) return;
  clients[idx].recurringOrders = (clients[idx].recurringOrders || []).filter((_, i) => i !== recurringIdx);
  setData('clients', clients);
  toast('Pedido recurrente eliminado', 'warning');
  renderClientList();
}

function checkRecurringOrders() {
  const todayStr = today();
  const todayDay = new Date(todayStr + 'T12:00:00').getDay();
  const clients = getData('clients', []);
  const orders = getData('orders', []);
  let created = 0;
  clients.forEach(c => {
    const recurring = c.recurringOrders || [];
    recurring.forEach(r => {
      if (parseInt(r.day) !== todayDay) return;
      // Check if already exists for today
      const alreadyExists = orders.some(o =>
        o.clientId === c.id && o.date === todayStr && o.recurring === true &&
        (o.items || []).some(i => i.productId === r.productId)
      );
      if (alreadyExists) return;
      const prod = PRODUCTS.find(p => p.id === r.productId);
      if (!prod) return;
      const item = { productId: r.productId, productName: prod.name, qty: r.qty, price: prod.price, total: r.qty * prod.price };
      const { freeDelivery: recFree, deliveryFee: recFee } = calcDeliveryFee([item]);
      orders.push({
        id: uid(), clientId: c.id, clientName: c.name, clientAddress: c.address || '',
        items: [item], subtotal: item.total, deliveryFee: recFee, total: item.total + recFee, date: todayStr, status: 'pendiente',
        notes: 'Pedido recurrente automático', recurring: true,
      });
      created++;
    });
  });
  if (created > 0) {
    setData('orders', orders);
    toast(`🔄 ${created} pedido(s) recurrente(s) creado(s) automáticamente`, 'success');
    updateCRMBadge(created);
  }
}

function updateCRMBadge(count) {
  const badge = document.getElementById('crmBadge');
  if (!badge) return;
  const current = parseInt(badge.textContent) || 0;
  const total = current + count;
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// ---- CRM order cart helpers ----
function getOrderCart() { return _orderCart; }

function addToOrderCart(productId) {
  _orderCart[productId] = (_orderCart[productId] || 0) + 1;
  renderOrderProductGrid();
}

function changeOrderCartQty(productId, delta) {
  const newQty = (_orderCart[productId] || 0) + delta;
  if (newQty <= 0) delete _orderCart[productId];
  else _orderCart[productId] = newQty;
  renderOrderProductGrid();
}

function renderOrderProductGrid() {
  const container = document.getElementById('orderProductGrid');
  if (!container) return;
  container.innerHTML = PRODUCTS.map(p => {
    const qty = _orderCart[p.id] || 0;
    return `<button type="button" class="order-grid-btn${qty > 0 ? ' active' : ''}" onclick="addToOrderCart('${p.id}')">
      ${qty > 0 ? `<span class="og-badge">${qty}</span>` : ''}
      <span class="og-emoji">${p.emoji}</span>
      <span class="og-name">${p.name.replace('Tortilla de ', '')}</span>
      <span class="og-price">${fmt(p.price)} / ${p.unit}</span>
    </button>`;
  }).join('');
  renderOrderCart();
}

function renderOrderCart() {
  const summary = document.getElementById('orderCartSummary');
  const cartItems = document.getElementById('orderCartItems');
  const runningTotal = document.getElementById('orderRunningTotal');
  const deliveryRow = document.getElementById('orderDeliveryFeeRow');
  const deliveryAmt = document.getElementById('orderDeliveryFeeAmt');
  if (!summary || !cartItems || !runningTotal) return;

  const entries = Object.entries(_orderCart).filter(([, qty]) => qty > 0);
  if (entries.length === 0) {
    summary.style.display = 'none';
    if (deliveryRow) deliveryRow.style.display = 'none';
    runningTotal.textContent = '$0.00';
    return;
  }

  summary.style.display = 'block';
  cartItems.innerHTML = entries.map(([productId, qty]) => {
    const prod = PRODUCTS.find(p => p.id === productId);
    if (!prod) return '';
    const total = qty * prod.price;
    return `<div class="cart-item">
      <span class="ci-info">${prod.emoji} ${prod.name.replace('Tortilla de ', '')}</span>
      <div class="ci-controls">
        <button type="button" onclick="changeOrderCartQty('${productId}', -1)">−</button>
        <span>${qty} ${pluralUnit(prod.unit, qty)}</span>
        <button type="button" onclick="changeOrderCartQty('${productId}', 1)">+</button>
      </div>
      <span class="ci-total">${fmt(total)}</span>
      <button type="button" class="ci-controls" style="border:none;background:none;cursor:pointer;color:var(--sys-red);font-size:1rem;" onclick="changeOrderCartQty('${productId}', -999)">✕</button>
    </div>`;
  }).join('');

  const subtotal = entries.reduce((a, [pid, qty]) => {
    const prod = PRODUCTS.find(p => p.id === pid);
    return a + (prod ? qty * prod.price : 0);
  }, 0);

  const { freeDelivery, deliveryFee } = calcDeliveryFee(entries);
  const outOfZone = !isInsideZone(_orderClientLat, _orderClientLng) && _orderClientLat != null && _orderClientLng != null;
  const zoneExtra = outOfZone ? ZONE_EXTRA_FEE : 0;
  const totalDeliveryFee = deliveryFee + zoneExtra;
  const total = subtotal + totalDeliveryFee;

  if (deliveryRow) {
    deliveryRow.style.display = 'flex';
    if (freeDelivery && !outOfZone) {
      if (deliveryAmt) { deliveryAmt.textContent = 'Envío gratis 🎉'; deliveryAmt.style.color = 'var(--sys-green)'; }
    } else {
      if (deliveryAmt) { deliveryAmt.textContent = fmt(totalDeliveryFee); deliveryAmt.style.color = 'var(--sys-orange)'; }
    }
  }
  runningTotal.textContent = fmt(total);
}

function markDelivered(id) {
  const orders = getData('orders', []);
  const idx = orders.findIndex(o => o.id === id);
  if (idx < 0) return;
  orders[idx].status = 'entregado';
  orders[idx].deliveredDate = today();
  setData('orders', orders);
  toast(`Entrega de ${orders[idx].clientName} completada ✅`);
  renderCRM();
  // Sync map route stops if active
  optimizedStops.forEach(s => { if (s.order.id === id) s.order.status = 'entregado'; });
  const rutaTab = document.querySelector('.crm-tab[data-crm="ruta"]');
  if (rutaTab && rutaTab.classList.contains('active')) {
    renderRouteStops();
    updateRouteProgress();
  }
}

function renderOrderList() {
  if (!_loaded.orders) { showSpinner('orderList'); return; }
  const orders = getData('orders', []).filter(o => o.status === 'pendiente');
  const container = document.getElementById('orderList');
  if (orders.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin pedidos activos</p>';
    return;
  }
  container.innerHTML = [...orders].reverse().map(o => {
    // Support both legacy single-product orders and new multi-product orders
    const items = o.items || [{ productName: o.productName, qty: o.qty, total: o.total }];
    const orderTotal = o.total || items.reduce((a, i) => a + (i.total || 0), 0);
    const productsHtml = items.map(i => {
      const prod = PRODUCTS.find(p => p.id === i.productId);
      const unitLabel = prod ? prod.unit : 'doc';
      return `<div class="order-product-item">📦 ${(i.productName || '').replace('Tortilla de ','')} — ${i.qty} ${pluralUnit(unitLabel, i.qty)} — ${fmt(i.total)}</div>`;
    }).join('');
    const deliveryHtml = o.deliveryFee > 0
      ? `<div class="order-detail" style="color:var(--sys-orange)">🚚 Envío: ${fmt(o.deliveryFee)}</div>`
      : (o.subtotal !== undefined ? `<div class="order-detail" style="color:var(--sys-green)">🚚 Envío gratis 🎉</div>` : '');
    const zoneHtml = o.outOfZone ? `<div class="order-zone-badge">⚠️ Fuera de zona — envío adicional $20</div>` : '';
    return `<div class="order-card-new">
      <div class="order-card-body">
        <div class="order-client-name">👤 ${esc(o.clientName)}</div>
        ${o.clientAddress ? `<div class="order-detail">📍 ${esc(o.clientAddress)}</div>` : ''}
        <div class="order-detail">📅 Entrega: ${o.date}</div>
        <div class="order-products-list">${productsHtml}</div>
        ${deliveryHtml}
        ${zoneHtml}
        <div class="order-total-line">Total: ${fmt(orderTotal)}</div>
        ${o.notes ? `<div class="order-detail order-notes-text">${esc(o.notes)}</div>` : ''}
      </div>
      <div class="order-card-actions-row">
        <button class="btn-entregado" onclick="markDelivered('${o.id}')">✅ Entregado</button>
        <button class="btn-cancelar" onclick="openCancelModal('${o.id}')">❌ Cancelar</button>
      </div>
    </div>`;
  }).join('');
}

let _cancelOrderId = null;

function openCancelModal(id) {
  _cancelOrderId = id;
  document.getElementById('cancelReason').value = '';
  document.getElementById('cancelOrderModal').style.display = 'flex';
}

function closeCancelModal() {
  _cancelOrderId = null;
  document.getElementById('cancelOrderModal').style.display = 'none';
}

function confirmCancelOrder() {
  if (!_cancelOrderId) return;
  const reason = document.getElementById('cancelReason').value.trim();
  const orders = getData('orders', []);
  const idx = orders.findIndex(o => o.id === _cancelOrderId);
  if (idx >= 0) {
    orders[idx].status = 'cancelado';
    orders[idx].cancelReason = reason || '';
    orders[idx].cancelDate = new Date().toISOString();
    setData('orders', orders);
  }
  closeCancelModal();
  toast('Pedido cancelado', 'warning');
  renderCRM();
}

function deleteOrder(id) {
  // Keep for backward compatibility
  const orders = getData('orders', []).filter(o => o.id !== id);
  setData('orders', orders);
  renderCRM();
}

function renderHistorialList() {
  const orders = getData('orders', []).filter(o => o.status === 'entregado' || o.status === 'cancelado');
  const container = document.getElementById('historialList');
  if (!container) return;

  const q = (document.getElementById('histClientSearch')?.value || '').toLowerCase();
  const dateFilter = document.getElementById('histDateFilter')?.value || '';

  let filtered = [...orders];
  if (q) filtered = filtered.filter(o => o.clientName.toLowerCase().includes(q));
  if (dateFilter) filtered = filtered.filter(o => o.date === dateFilter);
  filtered = filtered.reverse();

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin entregas en el historial</p>';
    return;
  }
  container.innerHTML = filtered.map(o => {
    const items = o.items || [{ productName: o.productName, qty: o.qty, total: o.total }];
    const orderTotal = o.total || items.reduce((a, i) => a + (i.total || 0), 0);
    const isCancelled = o.status === 'cancelado';
    const productsHtml = items.map(i => {
      const prod = PRODUCTS.find(p => p.id === i.productId);
      const unitLabel = prod ? prod.unit : 'doc';
      return `<div class="order-product-item">📦 ${(i.productName || '').replace('Tortilla de ', '')} — ${i.qty} ${pluralUnit(unitLabel, i.qty)} — ${fmt(i.total)}</div>`;
    }).join('');
    const cancelInfo = isCancelled && o.cancelReason ? `<div class="order-detail hist-cancel-reason">📌 Motivo: ${esc(o.cancelReason)}</div>` : '';
    const statusBadge = isCancelled
      ? '<span class="hist-badge cancelled">❌ Cancelado</span>'
      : '<span class="hist-badge delivered">✅ Entregado</span>';
    const deliveryHtml = o.deliveryFee > 0
      ? `<div class="order-detail" style="color:var(--sys-orange)">🚚 Envío: ${fmt(o.deliveryFee)}</div>`
      : (o.subtotal !== undefined ? `<div class="order-detail" style="color:var(--sys-green)">🚚 Envío gratis 🎉</div>` : '');
    const zoneHtml = o.outOfZone ? `<div class="order-zone-badge">⚠️ Fuera de zona</div>` : '';
    return `<div class="order-card-new ${isCancelled ? 'order-card-cancelled' : ''}">
      <div class="order-card-body">
        <div class="order-card-hist-header">
          <div class="order-client-name">👤 ${esc(o.clientName)}</div>
          ${statusBadge}
        </div>
        ${o.clientAddress ? `<div class="order-detail">📍 ${esc(o.clientAddress)}</div>` : ''}
        <div class="order-detail">📅 ${o.date}</div>
        <div class="order-products-list">${productsHtml}</div>
        ${deliveryHtml}
        ${zoneHtml}
        <div class="order-total-line">Total: ${fmt(orderTotal)}</div>
        ${cancelInfo}
        ${o.notes ? `<div class="order-detail order-notes-text">"${esc(o.notes)}"</div>` : ''}
      </div>
    </div>`;
  }).join('');
}


const HOME_BASE = { lat: 19.4326, lng: -100.3572 };

function initMap() {
  if (deliveryMap) { loadRoute(); return; }
  deliveryMap = L.map('deliveryMap').setView([HOME_BASE.lat, HOME_BASE.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(deliveryMap);

  // Draw delivery zone circle (persistent — not in deliveryMarkers)
  L.circle([ZONE_CENTER.lat, ZONE_CENTER.lng], {
    radius: ZONE_RADIUS_KM * 1000,
    color: '#38A169',
    fillColor: '#38A169',
    fillOpacity: 0.08,
    weight: 2,
    dashArray: '6, 4',
  }).addTo(deliveryMap).bindPopup(`<strong>Zona de cobertura</strong><br/>Radio: ${ZONE_RADIUS_KM} km<br/>Fuera de esta zona aplica envío adicional $${ZONE_EXTRA_FEE}`);

  // Click to get coordinates
  deliveryMap.on('click', function(e) {
    toast(`Coords: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)} (copiadas al portapapeles)`, 'success');
    navigator.clipboard?.writeText(`${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
  });

  loadRoute();
}

// Haversine distance in km between two {lat, lng} points
function haversineDistance(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Nearest-neighbor algorithm: orders stops starting from HOME_BASE
function optimizeRouteOrder(stops) {
  if (stops.length <= 1) return stops;
  const remaining = [...stops];
  const ordered = [];
  let current = { lat: HOME_BASE.lat, lng: HOME_BASE.lng };

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current, { lat: remaining[i].client.lat, lng: remaining[i].client.lng });
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    current = { lat: next.client.lat, lng: next.client.lng };
  }
  return ordered;
}

function loadRoute() {
  if (!deliveryMap) return;
  const date = document.getElementById('mapDateFilter').value;

  const orders = getData('orders', []).filter(o => o.date === date);
  const clients = getData('clients', []);

  // Clear old markers
  deliveryMarkers.forEach(m => deliveryMap.removeLayer(m));
  deliveryMarkers = [];
  routeStarted = false;

  // HQ marker
  const hqIcon = L.divIcon({ html: '🌽', className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
  const hqMarker = L.marker([HOME_BASE.lat, HOME_BASE.lng], { icon: hqIcon }).addTo(deliveryMap);
  hqMarker.bindPopup('<strong>Xela Tortillería</strong><br/>Punto de origen');
  deliveryMarkers.push(hqMarker);

  // Build stops array
  const stops = [];
  orders.forEach((order) => {
    const client = clients.find(c => c.id === order.clientId);
    if (client && client.lat && client.lng) {
      stops.push({ order, client });
    }
  });

  // Apply nearest-neighbor optimization
  optimizedStops = optimizeRouteOrder(stops);

  // Number each stop and add markers
  optimizedStops.forEach((s, i) => {
    s.num = i + 1;
    const isDelivered = s.order.status === 'entregado';
    const inZone = isInsideZone(s.client.lat, s.client.lng);
    const pinColor = inZone ? '#38A169' : '#DD6B20';
    const icon = L.divIcon({
      html: `<div style="background:${pinColor};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${isDelivered ? '✓' : s.num}</div>`,
      className: '', iconSize: [28, 28], iconAnchor: [14, 14],
    });
    const marker = L.marker([s.client.lat, s.client.lng], { icon }).addTo(deliveryMap);
    const productsHtml = (s.order.items || [{ productName: s.order.productName, qty: s.order.qty }])
      .map(it => `${(it.productName || '').replace('Tortilla de ', '')}: ${it.qty} doc.`).join('<br/>');
    const zoneLabel = inZone ? '<span style="color:green">✅ Dentro de zona</span>' : '<span style="color:orange">⚠️ Fuera de zona</span>';
    marker.bindPopup(`<strong>${s.num}. ${s.client.name}</strong><br/>${productsHtml}<br/>📍 ${s.client.address || ''}<br/>${zoneLabel}<br/><span style="color:${isDelivered ? 'green' : 'gray'}">${s.order.status}</span>`);
    deliveryMarkers.push(marker);
  });

  // Draw route line
  if (optimizedStops.length > 0) {
    const latlngs = [[HOME_BASE.lat, HOME_BASE.lng], ...optimizedStops.map(s => [s.client.lat, s.client.lng])];
    const line = L.polyline(latlngs, { color: '#2D6A0F', weight: 3, dashArray: '6, 8', opacity: 0.7 }).addTo(deliveryMap);
    deliveryMarkers.push(line);
    deliveryMap.fitBounds(line.getBounds().pad(0.1));
  }

  // Update action buttons
  const hasStops = optimizedStops.length > 0;
  const hasPending = optimizedStops.some(s => s.order.status !== 'entregado');
  document.getElementById('startDeliveriesBtn').disabled = !hasStops || !hasPending;
  document.getElementById('openGoogleMapsBtn').disabled = !hasStops;

  // Update progress bar
  updateRouteProgress();

  // Route stops list
  renderRouteStops();
}

function renderRouteStops() {
  const routeStopsEl = document.getElementById('routeStops');
  const date = document.getElementById('mapDateFilter').value;

  if (optimizedStops.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-msg';
    p.textContent = `Sin entregas para ${date || 'la fecha seleccionada'}`;
    routeStopsEl.innerHTML = '';
    routeStopsEl.appendChild(p);
    return;
  }

  // Find the next pending stop
  const nextPendingIdx = optimizedStops.findIndex(s => s.order.status !== 'entregado');

  routeStopsEl.innerHTML = optimizedStops.map((s, idx) => {
    const isDelivered = s.order.status === 'entregado';
    const isNext = idx === nextPendingIdx && routeStarted;
    const productsText = (s.order.items || [{ productName: s.order.productName, qty: s.order.qty }])
      .map(it => `${(it.productName || '').replace('Tortilla de ', '')} ${it.qty} doc.`).join(', ');

    return `<div class="route-stop ${isDelivered ? 'done' : ''} ${isNext ? 'next-stop' : ''}">
      <div class="stop-num ${isDelivered ? 'stop-num-done' : ''}">${s.num}</div>
      <div class="stop-info">
        <div class="stop-name">${s.client.name}</div>
        <div class="stop-addr">📍 ${s.client.address || 'Sin dirección'}</div>
        <div class="stop-products">📦 ${productsText}</div>
      </div>
      ${isDelivered
        ? `<span class="stop-done-label">✅ Entregado</span>`
        : `<button class="stop-complete-btn" onclick="markDelivered('${s.order.id}')">Entregado ✅</button>`
      }
    </div>`;
  }).join('');
}

function updateRouteProgress() {
  const progressWrap = document.getElementById('routeProgress');
  if (optimizedStops.length === 0) {
    progressWrap.style.display = 'none';
    return;
  }
  const delivered = optimizedStops.filter(s => s.order.status === 'entregado').length;
  const total = optimizedStops.length;
  const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
  progressWrap.style.display = 'flex';
  document.getElementById('routeProgressBar').style.width = pct + '%';
  document.getElementById('routeProgressText').textContent = `${delivered} / ${total} entregas (${pct}%)`;
}

function startDeliveries() {
  if (optimizedStops.length === 0) return;
  routeStarted = true;
  toast('🚀 Ruta optimizada — ¡a entregar!', 'success');
  renderRouteStops();

  // Scroll to the next pending stop
  const nextEl = document.querySelector('.route-stop.next-stop');
  if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function openInGoogleMaps() {
  if (optimizedStops.length === 0) return;

  const pendingStops = optimizedStops.filter(s => s.order.status !== 'entregado');
  const stopsToNavigate = pendingStops.length > 0 ? pendingStops : optimizedStops;

  if (stopsToNavigate.length === 1) {
    const dest = `${stopsToNavigate[0].client.lat},${stopsToNavigate[0].client.lng}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`, '_blank');
    return;
  }

  const destination = `${stopsToNavigate[stopsToNavigate.length - 1].client.lat},${stopsToNavigate[stopsToNavigate.length - 1].client.lng}`;
  const waypoints = stopsToNavigate.slice(0, -1).map(s => `${s.client.lat},${s.client.lng}`).join('|');
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`, '_blank');
}

// ==========================================
// MÓDULO: REPORTES
// ==========================================
function initReportes() {
  // Default range: last 7 days (6 days ago through today)
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 6);
  document.getElementById('reportStartDate').value = localDateStr(rangeStart);
  document.getElementById('reportEndDate').value = localDateStr(today);

  document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}

function generateReport() {
  const startStr = document.getElementById('reportStartDate').value;
  const endStr = document.getElementById('reportEndDate').value;
  if (!startStr || !endStr) { toast('Selecciona fecha inicio y fecha fin', 'warning'); return; }
  if (startStr > endStr) { toast('La fecha inicio debe ser anterior a la fecha fin', 'warning'); return; }

  const startDate = new Date(startStr + 'T12:00:00');
  const endDate = new Date(endStr + 'T12:00:00');

  const sales = getData('sales', []).filter(s => s.date >= startStr && s.date <= endStr);
  const transactions = getData('transactions', []).filter(t => t.date >= startStr && t.date <= endStr);

  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const totalIncome = totalSales + transactions.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);
  const netProfit = totalSales - totalExpense;

  // Show report
  document.getElementById('reportPlaceholder').style.display = 'none';
  document.getElementById('reportContent').style.display = 'block';

  // Header
  const fmtDate = d => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('reportPeriod').textContent =
    startStr === endStr
      ? fmtDate(startDate)
      : `${fmtDate(startDate)} — ${fmtDate(endDate)}`;
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

  // Daily income vs expense — iterate every day in the selected range
  const days = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    days.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
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
    const label = days.length === 1
      ? fmtDate(dt)
      : (days.length <= 14 ? `${dayLabels[dt.getDay()]} ${dt.getDate()}` : d);
    return `<div class="chart-bar-item">
      <div class="chart-bar-label"><span>${label}</span><span style="color:var(--sys-green)">${fmt(inc)}</span></div>
      <div class="chart-bar-track"><div class="chart-bar-fill income" style="width:${(inc/maxDay*100).toFixed(1)}%"></div></div>
      <div class="chart-bar-track" style="margin-top:2px;"><div class="chart-bar-fill expense" style="width:${(exp/maxDay*100).toFixed(1)}%;background:var(--sys-red)"></div></div>
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
      Durante este período se generaron <strong>${fmt(totalSales)}</strong> en ventas con gastos de <strong>${fmt(totalExpense)}</strong>,
      resultando en una <strong style="color:${netProfit>=0?'var(--sys-green)':'var(--sys-red)'}">utilidad neta de ${fmt(netProfit)}</strong>.
      ${bestProduct && bestProduct.qty > 0 ? `La variedad más vendida fue <strong>${bestProduct.emoji} ${bestProduct.name}</strong> con ${bestProduct.qty.toFixed(1)} docenas vendidas.` : ''}
      ${netProfit < 0 ? '⚠️ Los gastos superaron los ingresos en este período. Se recomienda revisar los costos operativos.' : '✅ Período rentable. ¡Buen trabajo!'}
    </p>
  `;

  // Store report data for PDF export
  lastReportData = { startStr, endStr, totalSales, totalExpense, netProfit, bestProduct, byProduct, days, allTx, fmtDate, startDate, endDate };
  document.getElementById('downloadPdfBtn').onclick = downloadReportPDF;

  toast('Reporte generado ✅');
}

function downloadReportPDF() {
  if (!lastReportData) return;
  const { startStr, endStr, totalSales, totalExpense, netProfit, bestProduct, byProduct, days, allTx, fmtDate, startDate, endDate } = lastReportData;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  const buildPdf = (logoDataUrl) => {
    // Logo
    if (logoDataUrl) {
      const logoW = 30;
      const logoH = 30;
      doc.addImage(logoDataUrl, 'PNG', (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 4;
    }

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(45, 106, 79); // #2d6a4f
    doc.text('Xela Tortillería', pageW / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Reporte de Resultados', pageW / 2, y, { align: 'center' });
    y += 6;

    // Period
    const periodText = startStr === endStr
      ? fmtDate(startDate)
      : `${fmtDate(startDate)} — ${fmtDate(endDate)}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${periodText}`, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, pageW / 2, y, { align: 'center' });
    y += 8;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // KPIs
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(45, 106, 79);
    doc.text('Resumen Financiero', margin, y);
    y += 6;

    const kpis = [
      { label: 'Total Ventas', value: fmt(totalSales), color: [39, 174, 96] },
      { label: 'Total Gastos', value: fmt(totalExpense), color: [231, 76, 60] },
      { label: 'Utilidad Neta', value: fmt(netProfit), color: netProfit >= 0 ? [39, 174, 96] : [231, 76, 60] },
    ];
    const colW = (pageW - margin * 2) / kpis.length;
    kpis.forEach((k, i) => {
      const x = margin + i * colW;
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 250, 248);
      doc.roundedRect(x + 1, y, colW - 3, 16, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(k.label, x + (colW - 3) / 2 + 1, y + 5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...k.color);
      doc.text(k.value, x + (colW - 3) / 2 + 1, y + 12, { align: 'center' });
    });
    y += 22;

    // Best product
    if (bestProduct && bestProduct.qty > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Producto más vendido: ${bestProduct.name} — ${bestProduct.qty.toFixed(1)} docenas (${fmt(bestProduct.total)})`, margin, y);
      y += 8;
    }

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // Daily breakdown table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(45, 106, 79);
    doc.text('Desglose Diario', margin, y);
    y += 4;

    const dayLabels = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' };
    const dailyRows = days.map(d => {
      const dt = new Date(d + 'T12:00:00');
      const daySales = getData('sales', []).filter(s => s.date === d);
      const dayTxs = getData('transactions', []).filter(t => t.date === d);
      const inc = daySales.reduce((a, s) => a + s.total, 0) + dayTxs.filter(t => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
      const exp = dayTxs.filter(t => t.type === 'gasto').reduce((a, t) => a + t.amount, 0);
      const net = inc - exp;
      const label = `${dayLabels[dt.getDay()]} ${dt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}`;
      return [label, fmt(inc), fmt(exp), { content: fmt(net), styles: { textColor: net >= 0 ? [39, 174, 96] : [231, 76, 60] } }];
    });

    doc.autoTable({
      startY: y,
      head: [['Día', 'Ingresos', 'Gastos', 'Neto']],
      body: dailyRows,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [45, 106, 79], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
      alternateRowStyles: { fillColor: [245, 250, 247] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { halign: 'right', textColor: [39, 174, 96] },
        2: { halign: 'right', textColor: [231, 76, 60] },
        3: { halign: 'right' },
      },
      theme: 'grid',
    });

    // Footer note
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generado por el Sistema Interno de Xela Tortillería', pageW / 2, finalY, { align: 'center' });

    // Save
    const fileName = `Reporte_Xela_${startStr}${startStr !== endStr ? '_a_' + endStr : ''}.pdf`;
    doc.save(fileName);
  };

  // Load logo as base64, then build PDF
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    buildPdf(canvas.toDataURL('image/png'));
  };
  img.onerror = () => buildPdf(null);
  img.src = '../logoxela.png';
}
