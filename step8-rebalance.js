import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, showToast, saveProgress, goToNextStep, getStepData, exchangeRate as coreExchangeRate } from './core.js';

// --- State Management ---
let currentStep = 1;
let baseCurrency = 'USD';
let liveExchangeRate = 1350;
let exchangeRate = 1350;
let assets = [];
let chart = null;

window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });
    if (step === 3) renderWeights();
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function autoSaveData(immediate = false) {
    const manualRate = parseFloat(document.getElementById('manualExchangeRate')?.value) || exchangeRate;
    const portfolioData = { assets, baseCurrency, manualExchangeRate: manualRate, lastUpdated: new Date() };
    await saveProgress(8, portfolioData, immediate);
}

document.addEventListener('coreDataReady', async (e) => {
    liveExchangeRate = e.detail.exchangeRate || coreExchangeRate;
    const display = document.getElementById('exchangeRateDisplay');
    if (display) display.innerText = `현재 환율: ₩${liveExchangeRate.toLocaleString()}`;
    const input = document.getElementById('manualExchangeRate');
    if (input && !input.value) input.value = Math.round(liveExchangeRate);
    
    const step8Data = await getStepData(8);
    if (step8Data) {
        assets = step8Data.assets || [];
        baseCurrency = step8Data.baseCurrency || 'USD';
        exchangeRate = step8Data.manualExchangeRate || liveExchangeRate;
        if (input) input.value = Math.round(exchangeRate);
        setCurrency(baseCurrency);
    }
    if (assets.length === 0) addAsset();
    renderAssets();
});

function setCurrency(code) {
    baseCurrency = code;
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-currency-usd');
    const btnKrw = document.getElementById('btn-currency-krw');

    if (glider) glider.style.left = (code === 'USD') ? '4px' : 'calc(50% - 4px)';
    
    // 버튼 색상 클래스 업데이트
    if (btnUsd && btnKrw) {
        if (code === 'USD') {
            btnUsd.classList.replace('text-slate-400', 'text-blue-600');
            btnUsd.classList.add('dark:text-blue-400');
            btnKrw.classList.replace('text-blue-600', 'text-slate-400');
            btnKrw.classList.remove('dark:text-blue-400');
        } else {
            btnKrw.classList.replace('text-slate-400', 'text-blue-600');
            btnKrw.classList.add('dark:text-blue-400');
            btnUsd.classList.replace('text-blue-600', 'text-slate-400');
            btnUsd.classList.remove('dark:text-blue-400');
        }
    }
    
    autoSaveData();
}

function resetToLiveExchangeRate() {
    const input = document.getElementById('manualExchangeRate');
    if (input) {
        input.value = Math.round(liveExchangeRate);
        exchangeRate = liveExchangeRate;
        autoSaveData(true);
        showToast("실시간 환율이 적용되었습니다.", "success");
    }
}

function addAsset(initialData = { ticker: '', qty: 0, price: 0 }) {
    const id = Date.now() + Math.random();
    assets.push({ id, ...initialData });
    renderAssets();
    autoSaveData();
}

async function quickAdd(ticker) {
    try {
        const res = await fetch(`/api/price?ticker=${ticker}`);
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
        addAsset({ ticker, qty: 1, price: price });
    } catch (e) { addAsset({ ticker, qty: 1, price: 0 }); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-reset-rate')?.addEventListener('click', resetToLiveExchangeRate);
    document.getElementById('btn-start-asset')?.addEventListener('click', () => window.goToStep(2));
    document.getElementById('quick-add-voo')?.addEventListener('click', () => quickAdd('VOO'));
    document.getElementById('quick-add-qqq')?.addEventListener('click', () => quickAdd('QQQ'));
    document.getElementById('quick-add-btc')?.addEventListener('click', () => quickAdd('BTC-USD'));
    document.getElementById('quick-add-samsung')?.addEventListener('click', () => quickAdd('005930.KS'));
    document.getElementById('btn-add-asset-manual')?.addEventListener('click', () => addAsset());
    document.getElementById('btn-open-search')?.addEventListener('click', () => window.toggleSearchModal(true));
    document.getElementById('btn-currency-usd')?.addEventListener('click', () => setCurrency('USD'));
    document.getElementById('btn-currency-krw')?.addEventListener('click', () => setCurrency('KRW'));
    
    // 최종 마스터 플랜 버튼 연결
    document.getElementById('btn-to-blueprint')?.addEventListener('click', () => {
        location.href = 'final-blueprint.html';
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') autoSaveData(false);
    });
});

window.toggleSearchModal = function(show) {
    const modal = document.getElementById('searchModal');
    const container = document.getElementById('searchModalContainer');
    if (!modal || !container) return;
    if (show) {
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => { container.classList.remove('scale-95', 'opacity-0'); container.classList.add('scale-100', 'opacity-100'); document.getElementById('assetSearchInput')?.focus(); }, 10);
    } else {
        container.classList.remove('scale-100', 'opacity-100'); container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
    }
};

window.searchAsset = async function() {
    const q = document.getElementById('assetSearchInput')?.value.trim();
    if (!q) return;
    const resContainer = document.getElementById('searchResults');
    if (resContainer) resContainer.innerHTML = '<div class="text-center py-8 animate-pulse text-xs text-slate-400">검색 중...</div>';
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const quotes = data?.quotes || [];
        if (quotes.length === 0) { if (resContainer) resContainer.innerHTML = '<p class="text-xs text-center py-8">결과가 없습니다.</p>'; return; }
        if (resContainer) {
            resContainer.innerHTML = quotes.map(item => `
                <div onclick="window.selectAndAddAsset('${item.symbol}')" class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 hover:border-blue-500 border border-transparent cursor-pointer transition-all flex justify-between items-center group">
                    <div><p class="font-black group-hover:text-blue-600">${item.symbol}</p><p class="text-[10px] text-slate-400">${item.shortname || ''}</p></div>
                    <span class="text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100">+ 추가</span>
                </div>
            `).join('');
        }
    } catch (e) { if (resContainer) resContainer.innerHTML = '<p class="text-xs text-red-400 text-center py-8">오류 발생</p>'; }
};

window.selectAndAddAsset = async function(ticker) {
    window.toggleSearchModal(false);
    await quickAdd(ticker);
    document.getElementById('assetSearchInput').value = '';
};

window.updateAsset = function(id, key, val) {
    const asset = assets.find(a => a.id === id);
    if (asset) asset[key] = key === 'ticker' ? val.toUpperCase() : parseFloat(val);
    autoSaveData();
};

window.removeAsset = function(id) {
    assets = assets.filter(a => a.id !== id);
    renderAssets(); autoSaveData();
};

function renderAssets() {
    const container = document.getElementById('assetContainer');
    if (!container) return;
    container.innerHTML = '';
    assets.forEach(asset => {
        const div = document.createElement('div');
        div.className = "p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-4 animate-fade-in-up";
        div.innerHTML = `
            <div class="flex-1 min-w-[120px]"><label class="block text-[10px] font-bold text-slate-400 mb-1">TICKER</label><input type="text" value="${asset.ticker}" onchange="window.updateAsset(${asset.id}, 'ticker', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold uppercase"></div>
            <div class="w-32"><label class="block text-[10px] font-bold text-slate-400 mb-1">QTY</label><input type="number" value="${asset.qty}" onchange="window.updateAsset(${asset.id}, 'qty', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold"></div>
            <div class="w-32"><label class="block text-[10px] font-bold text-slate-400 mb-1">PRICE</label><input type="number" value="${asset.price}" onchange="window.updateAsset(${asset.id}, 'price', this.value)" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl p-3 font-bold"></div>
            <button onclick="window.removeAsset(${asset.id})" class="mt-4 p-3 text-red-400 hover:bg-red-50 rounded-xl transition-colors">✕</button>
        `;
        container.appendChild(div);
    });
}

function renderWeights() {
    const container = document.getElementById('weightContainer');
    if (!container) return;
    container.innerHTML = '';
    const avgWeight = assets.length > 0 ? Math.floor(100 / assets.length) : 0;
    assets.forEach((asset, idx) => {
        if (!asset.targetWeight) asset.targetWeight = idx === assets.length - 1 ? 100 - (avgWeight * (assets.length - 1)) : avgWeight;
        const div = document.createElement('div');
        div.className = "space-y-2";
        div.innerHTML = `
            <div class="flex justify-between items-end px-2"><span class="font-black text-slate-800 dark:text-white">${asset.ticker || '자산 ' + (idx+1)}</span><span class="text-blue-600 font-black">${asset.targetWeight}%</span></div>
            <input type="range" value="${asset.targetWeight}" oninput="window.updateWeight(${asset.id}, this.value)" class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600">
        `;
        container.appendChild(div);
    });
    updateTotalWeight();
}

window.updateWeight = function(id, val) {
    const asset = assets.find(a => a.id === id);
    if (asset) asset.targetWeight = parseInt(val);
    renderWeights(); autoSaveData();
};

window.applyModel = function(modelType) {
    if (assets.length === 0) { showToast("자산을 추가해주세요."); return; }
    if (modelType === 'ALL_WEATHER') { const counts = [0.3, 0.55, 0.15]; assets.forEach((a, i) => a.targetWeight = Math.round(counts[i % 3] / Math.ceil(assets.length/3) * 100)); }
    else if (modelType === '6040') { const counts = [0.6, 0.4]; assets.forEach((a, i) => a.targetWeight = Math.round(counts[i % 2] / Math.ceil(assets.length/2) * 100)); }
    else if (modelType === 'PERMANENT') { const weight = Math.floor(100 / assets.length); assets.forEach(a => a.targetWeight = weight); }
    let total = assets.reduce((sum, a) => sum + (a.targetWeight || 0), 0);
    if (total !== 100 && assets.length > 0) assets[assets.length - 1].targetWeight += (100 - total);
    renderWeights(); autoSaveData();
};

function updateTotalWeight() {
    const total = assets.reduce((sum, a) => sum + (a.targetWeight || 0), 0);
    const display = document.getElementById('totalWeight');
    const btn = document.getElementById('btn-final-step');
    if (display) { display.innerText = total + '%'; display.className = `text-2xl font-black ${total === 100 ? 'text-emerald-500' : 'text-red-500'}`; }
    if (btn) btn.disabled = (total !== 100);
}

window.calculateRebalance = async function() {
    const resultsContainer = document.getElementById('rebalanceResults');
    if (resultsContainer) resultsContainer.innerHTML = '<div class="text-center py-8 animate-pulse font-bold text-slate-400">분석 중...</div>';
    
    let totalVal = assets.reduce((sum, a) => sum + (a.qty * a.price), 0);
    const processed = assets.map(a => {
        const targetVal = totalVal * (a.targetWeight / 100);
        const currentVal = a.qty * a.price;
        const diffVal = targetVal - currentVal;
        const diffQty = (diffVal / a.price).toFixed(2);
        return { ...a, diffQty, diffVal, currentWeight: totalVal > 0 ? (currentVal / totalVal * 100).toFixed(1) : 0 };
    });

    setTimeout(() => {
        if (resultsContainer) {
            resultsContainer.innerHTML = processed.map(a => `
                <div class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <div class="flex flex-col"><span class="font-bold">${a.ticker}</span><span class="text-[10px] text-slate-400">${a.currentWeight}% → ${a.targetWeight}%</span></div>
                    <div class="text-right">
                        <span class="font-black ${a.diffQty > 0 ? 'text-emerald-500' : 'text-red-500'}">${a.diffQty > 0 ? '매수' : '매도'} ${Math.abs(a.diffQty)}주</span>
                        <p class="text-[10px] text-slate-400">약 ${formatVal(Math.abs(a.diffVal))}</p>
                    </div>
                </div>
            `).join('');
        }
        renderChart(processed);
        updateHealthScore(processed);
        window.goToStep(4);
        autoSaveData(true);
    }, 800);
};

function formatVal(v) {
    if (baseCurrency === 'KRW') {
        if (v >= 100000000) return (v / 100000000).toFixed(1) + '억 원';
        if (v >= 10000) return (v / 10000).toFixed(1) + '만 원';
        return Math.round(v).toLocaleString() + '원';
    }
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

window.downloadRebalanceImage = function() {
    const area = document.querySelector('.capture-area');
    if (!area) return;
    html2canvas(area, { useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement('a'); link.download = `HedgeDochi_Report.png`; link.href = canvas.toDataURL(); link.click();
    });
};

function renderChart(data) {
    const ctx = document.getElementById('currentChart')?.getContext('2d');
    if (!ctx) return;
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: data.map(a => a.ticker), datasets: [{ data: data.map(a => Math.max(0, a.qty * a.price)), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], borderWidth: 0 }] },
        options: { cutout: '75%', plugins: { legend: { display: false } } }
    });
}

function updateHealthScore(data) {
    const deviance = data.reduce((sum, a) => sum + Math.abs(a.currentWeight - a.targetWeight), 0);
    const score = Math.max(0, 100 - Math.round(deviance));
    const el = document.getElementById('healthScore');
    if (el) { el.innerText = score; el.className = `text-6xl font-black ${score > 80 ? 'text-emerald-500' : score > 50 ? 'text-amber-500' : 'text-red-500'}`; }
}
