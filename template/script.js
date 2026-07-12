
const STORAGE_KEYS = {
  vault: 'rs_vault',
  people: 'rs_people',
  items: 'rs_items',
  total: 'rs_total_manual',
  deadline: 'rs_deadline',
  theme: 'rs_theme',
  currency: 'rs_currency',
  host: 'rs_host',
  reminders: 'rs_reminders',
};

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€' };

const uid = () => Math.random().toString(36).slice(2, 10);

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full / unavailable */ }
}

let vault = load(STORAGE_KEYS.vault, null);
let people = load(STORAGE_KEYS.people, []);
let items = load(STORAGE_KEYS.items, []);
let manualTotal = load(STORAGE_KEYS.total, null);
let deadline = load(STORAGE_KEYS.deadline, null);
let host = load(STORAGE_KEYS.host, { name: '', upi: '' });
let currency = load(STORAGE_KEYS.currency, 'INR');
let remindersOn = load(STORAGE_KEYS.reminders, true);
let deadlineReminderFired = false;
let countdownTimer = null;

if (vault === null) {
  vault = [{
    id: uid(),
    name: 'D-Mart Grocery Run',
    price: 1450,
    image: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=400',
  }];
  save(STORAGE_KEYS.vault, vault);
}

function sym() { return CURRENCY_SYMBOLS[currency] || '₹'; }
function money(n) {
  const val = Number.isFinite(n) ? n : 0;
  return `${sym()} ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

  //  Toasts

function toast(message, type = 'info') {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 2800);
}


  //  Navigation tabs


function switchTab(target) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.target === target));
  document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('active-view', p.id === target));
}

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(tab.dataset.target);
  });
});

  //  Calculator

let expression = '';
const OPERATORS = ['+', '-', '*', '/'];

function screenEl() { return document.getElementById('calc-screen'); }
function formulaEl() { return document.getElementById('formula-cache'); }

function renderCalc() {
  formulaEl().textContent = expression || '\u00A0';
}

function registerInput(token) {
  const isOperator = OPERATORS.includes(token);
  const lastChar = expression.slice(-1);

  if (isOperator) {
    if (expression === '' && token !== '-') return; // can't start with * / + (allow leading minus)
    if (OPERATORS.includes(lastChar)) {
      expression = expression.slice(0, -1) + token; // replace trailing operator
    } else {
      expression += token;
    }
  } else if (token === '.') {
    // prevent multiple decimals in current number segment
    const segment = expression.split(/[\+\-\*\/]/).pop();
    if (segment.includes('.')) return;
    expression += (segment === '' ? '0.' : '.');
  } else {
    expression += token;
  }
  renderCalc();
  screenEl().value = expression === '' ? '0' : expression;
}

function flushEngine() {
  expression = '';
  screenEl().value = '0';
  renderCalc();
}

function popLastEntry() {
  expression = expression.slice(0, -1);
  screenEl().value = expression === '' ? '0' : expression;
  renderCalc();
}

function applyPercentage() {
  if (expression === '') return;
  const match = expression.match(/(-?\d*\.?\d+)$/);
  if (!match) return;
  const num = parseFloat(match[0]);
  const replaced = (num / 100).toString();
  expression = expression.slice(0, match.index) + replaced;
  screenEl().value = expression;
  renderCalc();
}

function executeEvaluation() {
  if (expression === '') return;
  const cleanExpr = expression.replace(/[\+\-\*\/]+$/, '');
  if (!/^[0-9+\-*/.]+$/.test(cleanExpr)) { toast('That expression looks invalid.', 'error'); return; }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${cleanExpr})`)();
    if (!Number.isFinite(result)) throw new Error('bad result');
    formulaEl().textContent = `${cleanExpr} =`;
    expression = String(Math.round(result * 100) / 100);
    screenEl().value = expression;
  } catch (e) {
    screenEl().value = 'Error';
    expression = '';
    setTimeout(() => { screenEl().value = '0'; renderCalc(); }, 900);
  }
}

document.getElementById('calc-to-splitter-btn').addEventListener('click', () => {
  const val = parseFloat(screenEl().value);
  if (!Number.isFinite(val) || val <= 0) { toast('Calculate a valid total first.', 'error'); return; }
  document.getElementById('split-total').value = val.toFixed(2);
  manualTotal = val;
  save(STORAGE_KEYS.total, manualTotal);
  switchTab('splitter-view');
  renderSplitResult();
  toast(`Sent ${money(val)} to the splitter.`, 'success');
});

renderCalc();

  //  Receipt Vault

const galleryEl = document.getElementById('gallery');
const addBtn = document.getElementById('addBtn');
const formModal = document.getElementById('formModal');
const galleryForm = document.getElementById('galleryForm');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');

function renderVault() {
  galleryEl.querySelectorAll('.pad:not(.add-box)').forEach(el => el.remove());
  vault.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'pad';
    card.innerHTML = `
      <button type="button" class="card-remove" title="Remove receipt" data-id="${entry.id}">&times;</button>
      <div class="imagebox"><img src="${entry.image}" alt="${escapeHtml(entry.name)} receipt"></div>
      <h3>${escapeHtml(entry.name)}</h3>
      <h3>${money(entry.price)}</h3>
      <a href="#" class="send-vault-to-splitter" data-amount="${entry.price}">Split This Bill</a>
    `;
    galleryEl.insertBefore(card, addBtn);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

galleryEl.addEventListener('click', (e) => {
  const sendLink = e.target.closest('.send-vault-to-splitter');
  if (sendLink) {
    e.preventDefault();
    const amount = parseFloat(sendLink.dataset.amount);
    document.getElementById('split-total').value = amount.toFixed(2);
    manualTotal = amount;
    save(STORAGE_KEYS.total, manualTotal);
    switchTab('splitter-view');
    renderSplitResult();
    toast(`Sent ${money(amount)} to the splitter.`, 'success');
    return;
  }
  const removeBtn = e.target.closest('.card-remove');
  if (removeBtn) {
    vault = vault.filter(v => v.id !== removeBtn.dataset.id);
    save(STORAGE_KEYS.vault, vault);
    renderVault();
    toast('Receipt removed from vault.');
  }
});

addBtn.addEventListener('click', () => openModal(formModal));

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileLabel.classList.toggle('has-file', !!file);
  if (file) {
    fileLabel.lastChild.textContent = ` ${file.name}`;
  }
});

galleryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('modalItemName').value.trim();
  const price = parseFloat(document.getElementById('modalItemPrice').value);
  const file = fileInput.files[0];

  if (!name || !Number.isFinite(price) || price <= 0 || !file) {
    toast('Fill in every field before saving.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    vault.unshift({ id: uid(), name, price, image: reader.result });
    save(STORAGE_KEYS.vault, vault);
    renderVault();
    closeModal(formModal);
    galleryForm.reset();
    fileLabel.classList.remove('has-file');
    toast('Receipt saved to vault.', 'success');
  };
  reader.onerror = () => toast('Could not read that image.', 'error');
  reader.readAsDataURL(file);
});

document.getElementById('cancelModalBtn').addEventListener('click', () => {
  closeModal(formModal);
  galleryForm.reset();
  fileLabel.classList.remove('has-file');
});

  //  Modal helpers (generic)

function openModal(modal) { modal.classList.add('open'); }
function closeModal(modal) { modal.classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

  //  Bill Splitter — people & items

const namesList = document.getElementById('names-display-list');
const itemsList = document.getElementById('items-breakdown-list');
const splitTotalInput = document.getElementById('split-total');
const totalAutoHint = document.getElementById('total-auto-hint');
const itemsSubtotalRow = document.getElementById('items-subtotal-row');
const itemsSubtotalValue = document.getElementById('items-subtotal-value');

function itemsSum() { return items.reduce((sum, it) => sum + it.cost, 0); }

function effectiveTotal() {
  const manual = parseFloat(splitTotalInput.value);
  if (Number.isFinite(manual) && manual > 0) return manual;
  return itemsSum();
}

function renderPeople() {
  namesList.innerHTML = '';
  if (people.length === 0) {
    namesList.innerHTML = '<li class="placeholder-text" style="justify-content:center;background:transparent;border-style:dashed;">No friends added yet</li>';
  }
  people.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="entry-main">
        <strong>${escapeHtml(p.name)}</strong>
        ${p.upi ? `<small>${escapeHtml(p.upi)}</small>` : ''}
      </div>
      <button type="button" class="entry-remove" data-id="${p.id}" title="Remove">&times;</button>
    `;
    namesList.appendChild(li);
  });
}

function renderItems() {
  itemsList.innerHTML = '';
  items.forEach(it => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="entry-main"><strong>${escapeHtml(it.title)}</strong></div>
      <span class="entry-amount">${money(it.cost)}</span>
      <button type="button" class="entry-remove" data-id="${it.id}" title="Remove">&times;</button>
    `;
    itemsList.appendChild(li);
  });
  const sum = itemsSum();
  itemsSubtotalRow.style.display = items.length ? 'flex' : 'none';
  itemsSubtotalValue.textContent = money(sum);

  const manual = parseFloat(splitTotalInput.value);
  if (!Number.isFinite(manual) || manual <= 0) {
    totalAutoHint.textContent = items.length ? `Auto-filled from ${items.length} item${items.length > 1 ? 's' : ''} below.` : '';
  } else {
    totalAutoHint.textContent = '';
  }
}

document.getElementById('add-person-btn').addEventListener('click', () => {
  const nameInput = document.getElementById('person-name');
  const upiInput = document.getElementById('person-upi');
  const name = nameInput.value.trim();
  const upi = upiInput.value.trim();
  if (!name) { toast('Enter a name to add a friend.', 'error'); return; }
  if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('That name is already on the list.', 'error'); return; }
  people.push({ id: uid(), name, upi });
  save(STORAGE_KEYS.people, people);
  nameInput.value = '';
  upiInput.value = '';
  nameInput.focus();
  renderPeople();
  renderSplitResult();
});

namesList.addEventListener('click', (e) => {
  const btn = e.target.closest('.entry-remove');
  if (!btn) return;
  people = people.filter(p => p.id !== btn.dataset.id);
  save(STORAGE_KEYS.people, people);
  renderPeople();
  renderSplitResult();
});

document.getElementById('add-item-btn').addEventListener('click', () => {
  const titleInput = document.getElementById('shopping-item-title');
  const costInput = document.getElementById('shopping-item-cost');
  const title = titleInput.value.trim();
  const cost = parseFloat(costInput.value);
  if (!title || !Number.isFinite(cost) || cost <= 0) { toast('Add an item name and a valid price.', 'error'); return; }
  items.push({ id: uid(), title, cost });
  save(STORAGE_KEYS.items, items);
  titleInput.value = '';
  costInput.value = '';
  titleInput.focus();
  renderItems();
  renderSplitResult();
});

itemsList.addEventListener('click', (e) => {
  const btn = e.target.closest('.entry-remove');
  if (!btn) return;
  items = items.filter(it => it.id !== btn.dataset.id);
  save(STORAGE_KEYS.items, items);
  renderItems();
  renderSplitResult();
});

splitTotalInput.addEventListener('input', () => {
  const val = parseFloat(splitTotalInput.value);
  manualTotal = Number.isFinite(val) ? val : null;
  save(STORAGE_KEYS.total, manualTotal);
  renderItems();
  renderSplitResult();
});

// Split result + UPI settle links
const perHeadEl = document.getElementById('per-head-shares');
const resultMeta = document.getElementById('result-meta');
const upiLinksContainer = document.getElementById('upi-links-container');

function renderSplitResult() {
  const total = effectiveTotal();
  const count = people.length;
  const perHead = count > 0 ? total / count : 0;

  perHeadEl.textContent = perHead.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  resultMeta.textContent = count > 0
    ? `${money(total)} split across ${count} ${count === 1 ? 'person' : 'people'}`
    : 'Add friends to calculate a share';

  renderSettleLinks(perHead);
}

function renderSettleLinks(perHead) {
  upiLinksContainer.innerHTML = '';
  if (people.length === 0) {
    upiLinksContainer.innerHTML = '<p class="placeholder-text">Add group names or items to view payment shortcuts.</p>';
    return;
  }
  people.forEach(p => {
    const row = document.createElement('div');
    row.className = 'settle-row';
    row.innerHTML = `
      <div>
        <span class="settle-name">${escapeHtml(p.name)}</span>
        ${p.upi ? `<span class="settle-upi">${escapeHtml(p.upi)}</span>` : '<span class="settle-upi">No UPI ID saved</span>'}
      </div>
      <button type="button" class="settle-pay-btn" data-name="${escapeHtml(p.name)}" data-amount="${perHead.toFixed(2)}">${money(perHead)}</button>
    `;
    upiLinksContainer.appendChild(row);
  });
}

// Payment
const paymentAppModal = document.getElementById('paymentAppModal');
const paymentAppModalSubtitle = document.getElementById('paymentAppModalSubtitle');

upiLinksContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.settle-pay-btn');
  if (!btn) return;
  const name = btn.dataset.name;
  const amount = btn.dataset.amount;
  paymentAppModalSubtitle.textContent = `Transferring ${money(parseFloat(amount))} — request sent to ${name}`;

  const payeeUpi = host.upi || '';
  const payeeName = host.name || 'RupeeSplit Host';
  const note = encodeURIComponent(`RupeeSplit: share from ${name}`);
  const params = `pa=${encodeURIComponent(payeeUpi)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${note}`;

  if (!payeeUpi) {
    toast('Add your UPI ID in Settings first so friends know where to pay.', 'error');
    return;
  }

  document.getElementById('pay-gpay').href = `tez://upi/pay?${params}`;
  document.getElementById('pay-phonepe').href = `phonepe://pay?${params}`;
  document.getElementById('pay-paytm').href = `paytmmp://pay?${params}`;
  document.getElementById('pay-generic').href = `upi://pay?${params}`;

  openModal(paymentAppModal);
});

document.getElementById('closePaymentModalBtn').addEventListener('click', () => closeModal(paymentAppModal));

document.getElementById('copySummaryBtn').addEventListener('click', () => {
  const total = effectiveTotal();
  const count = people.length;
  const perHead = count > 0 ? total / count : 0;
  const lines = [
    `RupeeSplit summary`,
    `Total: ${money(total)}`,
    count > 0 ? `Per head: ${money(perHead)} (${count} people)` : 'Add friends to see a per-head share.',
    ...people.map(p => `• ${p.name}${p.upi ? ` (${p.upi})` : ''} — ${money(perHead)}`),
  ];
  const text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast('Summary copied to clipboard.', 'success'),
      () => toast('Could not copy — select and copy manually.', 'error')
    );
  } else {
    toast('Clipboard not available on this device.', 'error');
  }
});

  //  Deadline countdown

const deadlineInput = document.getElementById('payment-deadline');
const alertTracker = document.getElementById('alert-tracker');
const alertStatusTag = document.getElementById('alert-status-tag');
const countdownText = document.getElementById('countdown-text');
const progressBarFill = document.getElementById('progress-bar-fill');

if (deadline) deadlineInput.value = deadline;

deadlineInput.addEventListener('change', () => {
  deadline = deadlineInput.value || null;
  save(STORAGE_KEYS.deadline, deadline);
  deadlineReminderFired = false;
  startCountdown();
});

function formatDuration(ms) {
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function tickCountdown() {
  if (!deadline) { alertTracker.style.display = 'none'; return; }
  alertTracker.style.display = 'block';

  const created = deadlineInput.dataset.created ? parseInt(deadlineInput.dataset.created, 10) : Date.now();
  if (!deadlineInput.dataset.created) deadlineInput.dataset.created = String(created);

  const target = new Date(deadline).getTime();
  const now = Date.now();
  const remaining = target - now;
  const windowMs = Math.max(target - created, 1);
  const elapsedPct = Math.min(100, Math.max(0, ((now - created) / windowMs) * 100));

  progressBarFill.style.width = `${elapsedPct}%`;

  if (remaining <= 0) {
    alertStatusTag.textContent = 'Overdue';
    alertStatusTag.className = 'alert-tag text-overdue';
    countdownText.textContent = `Was due ${formatDuration(remaining)} ago`;
    progressBarFill.style.background = 'var(--danger)';
  } else if (remaining <= 60 * 60 * 1000) {
    alertStatusTag.textContent = 'Due soon';
    alertStatusTag.className = 'alert-tag text-soon';
    countdownText.textContent = `${formatDuration(remaining)} remaining`;
    progressBarFill.style.background = 'var(--danger)';
    if (remindersOn && !deadlineReminderFired) {
      deadlineReminderFired = true;
      toast('Payment deadline is under an hour away.', 'error');
    }
  } else {
    alertStatusTag.textContent = 'Pending';
    alertStatusTag.className = 'alert-tag text-pending';
    countdownText.textContent = `${formatDuration(remaining)} remaining`;
    progressBarFill.style.background = 'var(--brand)';
  }
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!deadline) { alertTracker.style.display = 'none'; return; }
  delete deadlineInput.dataset.created;
  tickCountdown();
  countdownTimer = setInterval(tickCountdown, 30000);
}

  //  Settings

const themeToggle = document.getElementById('theme-toggle');
const reminderToggle = document.getElementById('reminder-toggle');
const currencySelect = document.getElementById('currency-select');
const currentHostUpi = document.getElementById('current-host-upi');
const resultCurrencySymbol = document.getElementById('result-currency-symbol');

function applyTheme(isDark) {
  document.body.classList.toggle('dark-theme', isDark);
  themeToggle.checked = isDark;
}

const savedTheme = load(STORAGE_KEYS.theme, null);
applyTheme(savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches));

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked);
  save(STORAGE_KEYS.theme, themeToggle.checked ? 'dark' : 'light');
});

reminderToggle.checked = remindersOn;
reminderToggle.addEventListener('change', () => {
  remindersOn = reminderToggle.checked;
  save(STORAGE_KEYS.reminders, remindersOn);
});

currencySelect.value = currency;
currencySelect.addEventListener('change', () => {
  currency = currencySelect.value;
  save(STORAGE_KEYS.currency, currency);
  resultCurrencySymbol.textContent = sym();
  renderVault();
  renderItems();
  renderSplitResult();
  toast(`Currency switched to ${currency}.`, 'success');
});
resultCurrencySymbol.textContent = sym();

function refreshHostLabel() {
  currentHostUpi.textContent = host.upi ? `${host.name || 'Host'} · ${host.upi}` : 'Default: not set';
}
refreshHostLabel();

const upiProfileModal = document.getElementById('upiProfileModal');
document.getElementById('openUpiModalBtn').addEventListener('click', () => {
  document.getElementById('hostName').value = host.name || '';
  document.getElementById('hostUpiId').value = host.upi || '';
  openModal(upiProfileModal);
});
document.getElementById('cancelUpiModalBtn').addEventListener('click', () => closeModal(upiProfileModal));
document.getElementById('upiProfileForm').addEventListener('submit', (e) => {
  e.preventDefault();
  host = {
    name: document.getElementById('hostName').value.trim(),
    upi: document.getElementById('hostUpiId').value.trim(),
  };
  save(STORAGE_KEYS.host, host);
  refreshHostLabel();
  closeModal(upiProfileModal);
  toast('UPI profile saved.', 'success');
});

document.getElementById('resetDataBtn').addEventListener('click', () => {
  if (!confirm('This clears your vault, friends, items and profile from this device. Continue?')) return;
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  toast('All data reset. Reloading…', 'success');
  setTimeout(() => window.location.reload(), 700);
});


renderVault();
renderPeople();
renderItems();
renderSplitResult();
startCountdown();