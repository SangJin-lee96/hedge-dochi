// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

let app, auth, db, analytics;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
} catch (e) {
    console.error("Firebase initialization error:", e);
}

// ==========================================
// 1. Data Structure & State
// ==========================================
let currentUser = null;
let holdings = [
    { ticker: "VOO", name: "Vanguard S&P 500", qty: 10, price: 500, targetPercent: 70, sector: "시장지수 (Equity)" },
    { ticker: "TLT", name: "20+ Year Treasury Bond", qty: 20, price: 90, targetPercent: 30, sector: "안전자산 (Bonds/Cash)" }
];

const PRIMARY_SECTORS = ["시장지수 (Equity)", "안전자산 (Bonds/Cash)", "원자재 (Gold/Alt)"];

let sectorTargets = {
    "시장지수 (Equity)": 70,
    "안전자산 (Bonds/Cash)": 30,
    "원자재 (Gold/Alt)": 0
};

let chartInstance = null;
let tickerChartInstance = null;
let currentDochiStyle = null;
let isIntegerMode = false;

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfile = document.getElementById('userProfile');
const userPhoto = document.getElementById('userPhoto');
const loginAlert = document.getElementById('loginAlert');
const appContent = document.getElementById('appContent');
const assetListBody = document.getElementById('assetListBody');
const addAssetBtn = document.getElementById('addAssetBtn');
const saveBtn = document.getElementById('saveBtn');
const refreshPricesBtn = document.getElementById('refreshPricesBtn');
const refreshIcon = document.getElementById('refreshIcon');
const tickerSearchInput = document.getElementById('tickerSearchInput');
const searchResultsContainer = document.getElementById('searchResultsContainer');
const searchResults = document.getElementById('searchResults');
const integerModeToggle = document.getElementById('integerModeToggle');

// ==========================================
// 2. Sector Mapping Logic
// ==========================================
const sectorMap = {
    "QQQ": "시장지수 (Equity)", "AAPL": "시장지수 (Equity)", "MSFT": "시장지수 (Equity)", "NVDA": "시장지수 (Equity)", "TSLA": "시장지수 (Equity)", 
    "GOOGL": "시장지수 (Equity)", "AMZN": "시장지수 (Equity)", "META": "시장지수 (Equity)", "AMD": "시장지수 (Equity)", "VGT": "시장지수 (Equity)", "XLK": "시장지수 (Equity)",
    "SPY": "시장지수 (Equity)", "VOO": "시장지수 (Equity)", "IVV": "시장지수 (Equity)", "VTI": "시장지수 (Equity)", "DIA": "시장지수 (Equity)",
    "TLT": "안전자산 (Bonds/Cash)", "IEF": "안전자산 (Bonds/Cash)", "SHY": "안전자산 (Bonds/Cash)", "BND": "안전자산 (Bonds/Cash)", "AGG": "안전자산 (Bonds/Cash)", "BIL": "안전자산 (Bonds/Cash)",
    "SCHD": "시장지수 (Equity)", "JEPI": "시장지수 (Equity)", "VYM": "시장지수 (Equity)", "O": "시장지수 (Equity)",
    "GLD": "원자재 (Gold/Alt)", "IAU": "원자재 (Gold/Alt)", "SLV": "원자재 (Gold/Alt)", "DBC": "원자재 (Gold/Alt)", "BTC-USD": "원자재 (Gold/Alt)", "ETH-USD": "원자재 (Gold/Alt)"
};

function getMappedSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (sectorMap[t]) return sectorMap[t];
    if (quoteType === 'CRYPTOCURRENCY') return "원자재 (Gold/Alt)";
    if (yahooSector.includes("Technology") || yahooSector.includes("Financial") || quoteType === 'ETF' || quoteType === 'EQUITY') return "시장지수 (Equity)";
    if (yahooSector.includes("Treasury") || yahooSector.includes("Bonds")) return "안전자산 (Bonds/Cash)";
    return "시장지수 (Equity)";
}

// ==========================================
// 3. Hierarchical Logic (Dual-Mode Sync)
// ==========================================

window.distributeSector = (sectorName) => {
    const tickersInSector = holdings.filter(h => h.sector === sectorName);
    if (tickersInSector.length === 0) return;
    const targetPct = sectorTargets[sectorName];
    const perTicker = parseFloat((targetPct / tickersInSector.length).toFixed(2));
    tickersInSector.forEach((h, idx) => {
        if (idx === tickersInSector.length - 1) {
            const sumSoFar = perTicker * (tickersInSector.length - 1);
            h.targetPercent = parseFloat((targetPct - sumSoFar).toFixed(2));
        } else { h.targetPercent = perTicker; }
    });
    renderAssetList();
    updateCalculation();
};

function syncTickerToSector(sectorName) {
    const sum = holdings.filter(h => h.sector === sectorName).reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    sectorTargets[sectorName] = parseFloat(sum.toFixed(2));
    updateSectorUI();
}

window.updateSectorTarget = (sectorName, value) => {
    sectorTargets[sectorName] = parseFloat(value) || 0;
    updateSectorUI();
    updateCalculation();
};

function updateSectorUI() {
    document.getElementById('target_equity').value = sectorTargets["시장지수 (Equity)"];
    document.getElementById('target_bonds').value = sectorTargets["안전자산 (Bonds/Cash)"];
    document.getElementById('target_alt').value = sectorTargets["원자재 (Gold/Alt)"];
    const total = Object.values(sectorTargets).reduce((a, b) => a + b, 0);
    const statusElem = document.getElementById('sectorTotalStatus');
    if (Math.abs(total - 100) < 0.01) {
        statusElem.innerText = "Total: 100%";
        statusElem.className = "text-sm font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    } else {
        statusElem.innerText = `Total: ${total.toFixed(1)}% (Not 100%)`;
        statusElem.className = "text-sm font-bold px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
}

// ==========================================
// 4. API & Search Logic
// ==========================================

async function fetchInternalAPI(endpoint, params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`/api/${endpoint}?${queryString}`);
        if (!response.ok) throw new Error("Internal API Error");
        return await response.json();
    } catch (e) { throw e; }
}

async function refreshAllPrices() {
    const validHoldings = holdings.filter(h => h.ticker && h.ticker.trim() !== '' && !['CASH', 'USD', 'KRW', '현금'].includes(h.ticker.toUpperCase()));
    if (validHoldings.length === 0) return;
    refreshPricesBtn.disabled = true;
    if (refreshIcon) refreshIcon.classList.add('animate-spin', 'inline-block');
    for (const item of validHoldings) {
        try {
            const data = await fetchInternalAPI('price', { ticker: item.ticker });
            const result = data?.chart?.result?.[0];
            if (result && result.meta) {
                const price = result.meta.regularMarketPrice || result.meta.chartPreviousClose || 0;
                item.price = price;
                if (!item.name) item.name = result.meta.symbol || item.ticker;
                if (!item.sector) item.sector = getMappedSector(item.ticker);
            }
        } catch (e) { console.warn(`Failed: ${item.ticker}`); }
        await new Promise(r => setTimeout(r, 100));
    }
    refreshPricesBtn.disabled = false;
    if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    renderAssetList();
}

async function performSearch(query) {
    searchResultsContainer.classList.remove('hidden');
    searchResults.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';
    try {
        const data = await fetchInternalAPI('search', { q: query });
        const quotes = data.quotes || [];
        searchResults.innerHTML = quotes.length ? '' : '<li class="text-center py-4 text-slate-400 text-sm">결과 없음</li>';
        quotes.forEach(quote => {
            if (!quote.symbol) return;
            const li = document.createElement('li');
            li.className = "p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900 group";
            li.innerHTML = `<div class="flex justify-between items-center"><div class="flex-1 min-w-0 pr-4"><div class="flex items-center gap-2"><span class="font-bold text-blue-600 dark:text-blue-400 group-hover:underline truncate">${quote.symbol}</span></div><div class="text-sm text-slate-600 dark:text-slate-300 truncate">${quote.shortname || quote.symbol}</div></div><button class="shrink-0 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">추가</button></div>`;
            li.onclick = () => addAssetFromSearch(quote);
            searchResults.appendChild(li);
        });
    } catch (e) { searchResults.innerHTML = `<li class="text-center py-4 text-red-400 text-sm">네트워크 오류</li>`; }
}

async function addAssetFromSearch(quote) {
    if (holdings.find(h => h.ticker.toUpperCase() === quote.symbol.toUpperCase())) { alert("이미 목록에 있습니다."); return; }
    const detectedSector = getMappedSector(quote.symbol, quote.quoteType, quote.sector);
    holdings.push({ ticker: quote.symbol, name: quote.shortname || quote.symbol, qty: 0, price: 0, targetPercent: 0, sector: detectedSector });
    tickerSearchInput.value = ''; searchResultsContainer.classList.add('hidden'); renderAssetList();
}

// ==========================================
// 5. Rendering & Calculation
// ==========================================

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group`;
        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <div class="flex flex-col">
                    <div class="flex items-center gap-1">
                        <input type="text" value="${item.ticker}" class="w-full min-w-[60px] bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-slate-700 dark:text-slate-200 uppercase" onchange="updateHolding(${index}, 'ticker', this.value)">
                    </div>
                    <select class="text-[10px] bg-transparent text-indigo-500 font-bold outline-none cursor-pointer" onchange="updateHolding(${index}, 'sector', this.value)">
                        ${PRIMARY_SECTORS.map(s => `<option value="${s}" ${item.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.price}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right border-b border-transparent focus:border-blue-500 outline-none font-semibold text-blue-600 dark:text-blue-400" onchange="updateHolding(${index}, 'targetPercent', this.value)"></td>
            <td class="py-3 px-2 text-center align-middle"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500 p-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></td>`;
        assetListBody.appendChild(tr);
    });
    updateCalculation();
}

window.updateHolding = (index, field, value) => {
    if (field === 'qty' || field === 'price' || field === 'targetPercent') holdings[index][field] = parseFloat(value) || 0;
    else holdings[index][field] = value;
    if (field === 'targetPercent' || field === 'sector') { syncTickerToSector(holdings[index].sector); }
    updateCalculation();
};

window.removeAsset = (index) => {
    if(confirm('삭제하시겠습니까?')) {
        const sector = holdings[index].sector;
        holdings.splice(index, 1);
        syncTickerToSector(sector);
        renderAssetList();
    }
};

function updateCalculation() {
    let totalValue = 0;
    const sectorStats = {
        "시장지수 (Equity)": { current: 0, target: sectorTargets["시장지수 (Equity)"], key: "equity" },
        "안전자산 (Bonds/Cash)": { current: 0, target: sectorTargets["안전자산 (Bonds/Cash)"], key: "bonds" },
        "원자재 (Gold/Alt)": { current: 0, target: sectorTargets["원자재 (Gold/Alt)"], key: "alt" }
    };
    holdings.forEach(h => { const val = h.qty * h.price; totalValue += val; if (sectorStats[h.sector]) sectorStats[h.sector].current += val; });
    document.getElementById('totalValueDisplay').innerText = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    Object.keys(sectorStats).forEach(name => {
        const s = sectorStats[name];
        const currentPct = totalValue > 0 ? (s.current / totalValue) * 100 : 0;
        document.getElementById(`current_${s.key}_pct`).innerText = `${currentPct.toFixed(1)}%`;
        document.getElementById(`target_${s.key}_pct`).innerText = `${s.target}%`;
        const progCurrent = document.getElementById(`progress_${s.key}_current`);
        const progGap = document.getElementById(`progress_${s.key}_gap`);
        progCurrent.style.width = `${Math.min(currentPct, s.target)}%`;
        const gap = s.target - currentPct;
        progGap.style.width = `${gap > 0 ? gap : 0}%`;
    });
    const actionPlanList = document.getElementById('actionPlanList');
    actionPlanList.innerHTML = '';
    let isBalanced = true;
    holdings.forEach(h => {
        const currentVal = h.qty * h.price;
        const targetVal = totalValue * (h.targetPercent / 100);
        const diffVal = targetVal - currentVal;
        if (Math.abs(diffVal) > (totalValue * 0.01)) {
            isBalanced = false;
            const div = document.createElement('div');
            div.className = `p-4 rounded-xl border flex justify-between items-center ${diffVal > 0 ? "bg-red-50/50 border-red-100" : "bg-blue-50/50 border-blue-100"}`;
            let qtyMsg = h.price > 0 ? `<span class="block text-xs opacity-70">${(Math.abs(diffVal)/h.price).toFixed(isIntegerMode ? 0 : 2)}주</span>` : '';
            div.innerHTML = `<div><span class="font-bold">${h.ticker}</span></div><div class="text-right"><span class="font-bold ${diffVal > 0 ? 'text-red-600' : 'text-blue-600'}">${diffVal > 0 ? '매수' : '매도'} $${Math.abs(diffVal).toLocaleString(undefined, {maximumFractionDigits:0})}</span>${qtyMsg}</div>`;
            actionPlanList.appendChild(div);
        }
    });
    if (isBalanced) actionPlanList.innerHTML = `<div class="text-center py-10 text-slate-400">✅ 목표 비중 달성!</div>`;
    updateCharts(sectorStats, totalValue);
}

function updateCharts(sectorStats, totalValue) {
    const ctxSector = document.getElementById('portfolioChart');
    const ctxTicker = document.getElementById('tickerChart');
    if (chartInstance) chartInstance.destroy();
    if (tickerChartInstance) tickerChartInstance.destroy();
    const sectorLabels = Object.keys(sectorStats).map(s => s.split(' ')[0]);
    const sectorCurrent = Object.values(sectorStats).map(s => totalValue > 0 ? (s.current / totalValue * 100).toFixed(1) : 0);
    const sectorTarget = Object.values(sectorStats).map(s => s.target);
    chartInstance = new Chart(ctxSector, {
        type: 'bar',
        data: { labels: sectorLabels, datasets: [{ label: '현재 (%)', data: sectorCurrent, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 8 }, { label: '목표 (%)', data: sectorTarget, borderColor: '#10b981', type: 'line', fill: false, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { position: 'top' } } }
    });
    const tickerLabels = holdings.map(h => h.ticker);
    const tickerCurrent = holdings.map(h => totalValue > 0 ? ((h.qty * h.price) / totalValue * 100).toFixed(1) : 0);
    const tickerTarget = holdings.map(h => h.targetPercent);
    tickerChartInstance = new Chart(ctxTicker, {
        type: 'bar',
        data: { labels: tickerLabels, datasets: [{ label: '현재 (%)', data: tickerCurrent, backgroundColor: 'rgba(244, 63, 94, 0.8)', borderRadius: 8 }, { label: '목표 (%)', data: tickerTarget, borderColor: '#10b981', type: 'line', fill: false, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { position: 'top' } } }
    });
}

// ==========================================
// 6. Character Integration & Auth
// ==========================================

window.selectDochi = (type) => {
    currentDochiStyle = type;
    const presets = { aggressive: { equity: 80, bonds: 10, alt: 10 }, balanced: { equity: 50, bonds: 40, alt: 10 }, defensive: { equity: 20, bonds: 60, alt: 20 } };
    const p = presets[type];
    sectorTargets["시장지수 (Equity)"] = p.equity;
    sectorTargets["안전자산 (Bonds/Cash)"] = p.bonds;
    sectorTargets["원자재 (Gold/Alt)"] = p.alt;
    updateSectorUI(); updateCalculation();
    alert(`${type === 'aggressive' ? '공격도치' : type === 'balanced' ? '중도도치' : '수비도치'} 섹터 비중이 설정되었습니다. '하위 종목 균등배분'을 눌러 세부 비중을 정하세요.`);
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginBtn.classList.add('hidden'); userProfile.classList.remove('hidden'); userPhoto.src = user.photoURL;
        loginAlert.classList.add('hidden'); appContent.classList.remove('hidden'); appContent.classList.add('grid');
        await loadPortfolio();
    } else {
        loginBtn.classList.remove('hidden'); userProfile.classList.add('hidden'); loginAlert.classList.remove('hidden'); appContent.classList.add('hidden');
    }
});

async function loadPortfolio() {
    if (!currentUser) return;
    try {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.holdings) holdings = data.holdings;
            if (data.sectorTargets) sectorTargets = data.sectorTargets;
        }
        updateSectorUI(); renderAssetList();
    } catch (e) { console.error("Load error", e); }
}

async function savePortfolio() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), { uid: currentUser.uid, holdings: holdings, sectorTargets: sectorTargets, lastUpdated: new Date() });
        alert("성공적으로 저장되었습니다! 💾");
    } catch (e) { alert("저장 실패"); }
}

saveBtn.addEventListener('click', savePortfolio);
addAssetBtn.addEventListener('click', () => { holdings.push({ ticker: "NEW", name: "", qty: 0, price: 0, targetPercent: 0, sector: "시장지수 (Equity)" }); renderAssetList(); });
refreshPricesBtn.addEventListener('click', refreshAllPrices);
if (integerModeToggle) { integerModeToggle.addEventListener('change', (e) => { isIntegerMode = e.target.checked; updateCalculation(); }); }

if (tickerSearchInput) {
    let timer = null;
    tickerSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (timer) clearTimeout(timer);
        if (q.length < 2) { searchResultsContainer.classList.add('hidden'); return; }
        timer = setTimeout(() => performSearch(q), 500);
    });
}

// Initialize
updateSectorUI();
renderAssetList();
updateCalculation();