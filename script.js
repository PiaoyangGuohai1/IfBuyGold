const STORAGE_KEY = 'if-buy-gold-records-v1';
const CURRENCY_KEY = 'if-buy-gold-currency';
const FALLBACK_PRICE = 520; // 以人民币每克为例的兜底价格
const OUNCE_IN_GRAMS = 31.1034768;

const currencySymbols = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
  EUR: '€'
};

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

let currentPricePerGram = FALLBACK_PRICE;
let currentCurrency = (() => {
  try {
    const stored = localStorage.getItem(CURRENCY_KEY);
    if (stored && currencySymbols[stored]) {
      return stored;
    }
  } catch (error) {
    console.warn('读取存储的货币失败', error);
  }
  return 'CNY';
})();
let records = [];

const priceElement = document.getElementById('current-price');
const priceStatus = document.getElementById('price-status');
const manualPriceInput = document.getElementById('manual-price');
const currencySelect = document.getElementById('currency');
const amountCurrencyLabel = document.getElementById('amount-currency');

const totalSpentEl = document.getElementById('total-spent');
const totalGramsEl = document.getElementById('total-grams');
const totalCurrentEl = document.getElementById('total-current');
const totalDiffEl = document.getElementById('total-diff');
const expenseList = document.getElementById('expense-list');

const expenseForm = document.getElementById('expense-form');
const titleInput = document.getElementById('expense-title');
const amountInput = document.getElementById('expense-amount');
const priceInput = document.getElementById('expense-price');
const dateInput = document.getElementById('expense-date');
const clearAllButton = document.getElementById('clear-all');
const refreshButton = document.getElementById('refresh-price');
const applyManualButton = document.getElementById('apply-manual');

currencySelect.value = currentCurrency;
amountCurrencyLabel.textContent = currentCurrency;

async function fetchGoldPrice(currency = 'CNY') {
  priceStatus.textContent = '正在获取实时金价…';
  priceElement.textContent = '…';

  try {
    // 使用芝商所黄金期货价格作为参考（美元/盎司）
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F'),
      fetch('https://open.er-api.com/v6/latest/USD')
    ]);

    if (!goldRes.ok) {
      throw new Error('黄金价格接口不可用');
    }
    const goldData = await goldRes.json();
    const result = goldData?.quoteResponse?.result?.[0];
    if (!result || typeof result.regularMarketPrice !== 'number') {
      throw new Error('黄金价格数据异常');
    }

    const pricePerOunceUSD = result.regularMarketPrice;
    let pricePerGram = pricePerOunceUSD / OUNCE_IN_GRAMS; // 价格默认美元/克
    let symbol = '$';

    if (currency !== 'USD') {
      if (!fxRes.ok) {
        throw new Error('汇率获取失败');
      }
      const fxData = await fxRes.json();
      const rate = fxData?.rates?.[currency];
      if (typeof rate !== 'number') {
        throw new Error('汇率数据异常');
      }
      pricePerGram *= rate;
      symbol = currencySymbols[currency] || currency;
    }

    if (currency === 'USD') {
      symbol = '$';
    }

    updateCurrentPrice(pricePerGram, symbol, true);
    priceStatus.textContent = `最新更新：${new Date().toLocaleString()}（数据来源：Yahoo Finance GC=F）`;
  } catch (error) {
    console.warn('实时金价获取失败，将启用手动输入：', error);
    updateCurrentPrice(currentPricePerGram, currencySymbols[currency] || currency, false);
    priceStatus.textContent = '实时金价获取失败，请手动输入或稍后重试。';
  }
}

function updateCurrentPrice(pricePerGram, symbol, fromOnline) {
  currentPricePerGram = Number(pricePerGram) || FALLBACK_PRICE;
  priceElement.textContent = `${symbol}${formatNumber(currentPricePerGram)}/g`;
  manualPriceInput.value = '';
  renderRecords();
  if (fromOnline) {
    localStorage.setItem('if-buy-gold-last-price', JSON.stringify({
      price: currentPricePerGram,
      currency: currentCurrency,
      timestamp: Date.now()
    }));
  }
}

function loadPersistedPrice() {
  const cached = localStorage.getItem('if-buy-gold-last-price');
  if (!cached) return;
  try {
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed.price === 'number' && parsed.currency === currentCurrency) {
      updateCurrentPrice(parsed.price, currencySymbols[currentCurrency] || currentCurrency, false);
      priceStatus.textContent = `已应用上次缓存的金价：${new Date(parsed.timestamp).toLocaleString()}`;
    }
  } catch (error) {
    console.warn('解析缓存金价失败', error);
  }
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      records = parsed;
    }
  } catch (error) {
    console.warn('解析记录失败', error);
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCurrency(value) {
  return `${currencySymbols[currentCurrency] || currentCurrency}${formatNumber(value)}`;
}

function formatDiff(value) {
  if (value > 0) {
    return `+${formatCurrency(value)}`;
  }
  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`;
  }
  return formatCurrency(0);
}

function renderRecords() {
  expenseList.innerHTML = '';

  if (!records.length) {
    expenseList.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">还没有记录，先回想一次冲动消费吧。</td>
      </tr>
    `;
    recalculateSummary();
    return;
  }

  records.forEach((record) => {
    const currentValue = record.grams * currentPricePerGram;
    const diff = currentValue - record.amount;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.title}</td>
      <td>${record.date || '--'}</td>
      <td class="numeric">${formatCurrency(record.amount)}</td>
      <td class="numeric">${formatNumber(record.grams)} g</td>
      <td class="numeric">${formatCurrency(currentValue)}</td>
      <td class="numeric ${diff >= 0 ? 'positive' : 'negative'}">${formatDiff(diff)}</td>
      <td class="numeric"><button class="delete-button" data-id="${record.id}">删除</button></td>
    `;
    expenseList.appendChild(row);
  });

  recalculateSummary();
}

function recalculateSummary() {
  const totals = records.reduce(
    (acc, record) => {
      acc.amount += record.amount;
      acc.grams += record.grams;
      acc.current += record.grams * currentPricePerGram;
      return acc;
    },
    { amount: 0, grams: 0, current: 0 }
  );

  const diff = totals.current - totals.amount;

  totalSpentEl.textContent = records.length ? formatCurrency(totals.amount) : '--';
  totalGramsEl.textContent = records.length ? `${formatNumber(totals.grams)} g` : '--';
  totalCurrentEl.textContent = records.length ? formatCurrency(totals.current) : '--';
  totalDiffEl.textContent = records.length ? formatDiff(diff) : '--';

  totalDiffEl.classList.toggle('positive', diff >= 0 && records.length);
  totalDiffEl.classList.toggle('negative', diff < 0 && records.length);
}

function addRecord({ title, amount, priceAtThatTime, date }) {
  const priceUsed = priceAtThatTime > 0 ? priceAtThatTime : currentPricePerGram;
  const grams = amount / priceUsed;

  const record = {
    id: generateId(),
    title,
    amount,
    grams,
    priceAtThatTime: priceUsed,
    date: date || '--',
    currency: currentCurrency
  };

  records.unshift(record);
  saveRecords();
  renderRecords();
}

function handleFormSubmit(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const priceAtThatTime = Number(priceInput.value);
  const date = dateInput.value;

  if (!title || !(amount > 0)) {
    alert('请完整填写消费内容和金额。');
    return;
  }

  if (priceInput.value && !(priceAtThatTime > 0)) {
    alert('请输入有效的金价。');
    return;
  }

  addRecord({ title, amount, priceAtThatTime, date });

  expenseForm.reset();
  amountCurrencyLabel.textContent = currentCurrency;
}

function handleListClick(event) {
  if (event.target.matches('.delete-button')) {
    const id = event.target.dataset.id;
    records = records.filter((record) => record.id !== id);
    saveRecords();
    renderRecords();
  }
}

function handleClearAll() {
  if (!records.length) return;
  const ok = confirm('确定要清空所有记录吗？该操作不可撤销。');
  if (!ok) return;
  records = [];
  saveRecords();
  renderRecords();
}

function applyManualPrice() {
  const manualPrice = Number(manualPriceInput.value);
  if (!(manualPrice > 0)) {
    alert('请输入有效的金价数值。');
    return;
  }
  updateCurrentPrice(manualPrice, currencySymbols[currentCurrency] || currentCurrency, false);
  priceStatus.textContent = '已使用手动输入的金价。';
}

function handleCurrencyChange() {
  const newCurrency = currencySelect.value;
  if (newCurrency === currentCurrency) {
    return;
  }
  if (records.length) {
    const ok = confirm('切换货币会清空现有记录，是否继续？');
    if (!ok) {
      currencySelect.value = currentCurrency;
      return;
    }
    records = [];
    saveRecords();
  }
  currentCurrency = newCurrency;
  amountCurrencyLabel.textContent = currentCurrency;
  localStorage.setItem(CURRENCY_KEY, currentCurrency);
  renderRecords();
  loadPersistedPrice();
  fetchGoldPrice(currentCurrency);
}

function initDateInput() {
  if (!dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

function init() {
  loadRecords();
  loadPersistedPrice();
  records = records.map((record) => {
    const priceUsed = record.priceAtThatTime || record.cachedPrice || currentPricePerGram;
    const grams = record.grams || (record.amount && priceUsed ? record.amount / priceUsed : 0);
    return {
      id: record.id || generateId(),
      title: record.title || '未命名消费',
      amount: record.amount || 0,
      grams,
      priceAtThatTime: priceUsed,
      date: record.date || '--',
      currency: record.currency || currentCurrency
    };
  });
  saveRecords();
  renderRecords();
  initDateInput();
  fetchGoldPrice(currentCurrency);
}

expenseForm.addEventListener('submit', handleFormSubmit);
expenseList.addEventListener('click', handleListClick);
clearAllButton.addEventListener('click', handleClearAll);
refreshButton.addEventListener('click', () => fetchGoldPrice(currentCurrency));
applyManualButton.addEventListener('click', applyManualPrice);
currencySelect.addEventListener('change', handleCurrencyChange);

init();
