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
    { ticker: "VOO", name: "Vanguard S&P 500", qty: 10, price: 500, targetPercent: 50, sector: "시장지수 (Equity)" },
    { ticker: "TLT", name: "20+ Year Treasury Bond", qty: 20, price: 90, targetPercent: 30, sector: "채권 (Bonds)" },
    { ticker: "BTC-USD", name: "Bitcoin", qty: 0.1, price: 40000, targetPercent: 10, sector: "가상자산 (Crypto)" },
    { ticker: "USD", name: "US Dollar", qty: 1000, price: 1, targetPercent: 10, sector: "현금 (Cash)" }
];

const PRIMARY_SECTORS = ["시장지수 (Equity)", "채권 (Bonds)", "원자재 (Commodity)", "가상자산 (Crypto)", "현금 (Cash)"];

let sectorTargets = {
    "시장지수 (Equity)": 50, "채권 (Bonds)": 30, "원자재 (Commodity)": 0, "가상자산 (Crypto)": 10, "현금 (Cash)": 10
};

let targetCapital = 0;
let chartInstance = null;
let tickerChartInstance = null;
let simulationChartInstance = null;
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
const targetCapitalInput = document.getElementById('targetCapitalInput');

// ==========================================
// 2. Core Logic
// ==========================================

function getMappedSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (quoteType === 'CRYPTOCURRENCY' || t.endsWith('-USD') || t.endsWith('-KRW') || t === 'BTC' || t === 'ETH') return "가상자산 (Crypto)";
    if (t === 'USD' || t === 'KRW' || t === 'CASH' || t === '현금') return "현금 (Cash)";
    if (yahooSector.includes("Treasury") || yahooSector.includes("Bonds") || t === 'TLT' || t === 'BND') return "채권 (Bonds)";
    if (yahooSector.includes("Commodit") || t === 'GLD' || t === 'IAU' || t === 'USO') return "원자재 (Commodity)";
    return "시장지수 (Equity)";
}

async function fetchInternalAPI(endpoint, params) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/${endpoint}?${queryString}`);
    if (!response.ok) throw new Error("API Error");
    return await response.json();
}

window.addQuickAsset = async (ticker, sector) => {
    if (holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase())) {
        alert("이미 목록에 있습니다."); return;
    }
    const isCash = (ticker === 'USD' || ticker === 'KRW');
    holdings.push({ ticker, name: isCash ? ticker : "불러오는 중...", qty: 0, price: isCash ? 1 : 0, targetPercent: 0, sector });
    renderAssetList();
    if (!isCash) {
        try {
            const data = await fetchInternalAPI('price', { ticker });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
                const asset = holdings.find(h => h.ticker === ticker);
                if (asset) { asset.price = meta.regularMarketPrice || meta.chartPreviousClose || 0; asset.name = meta.symbol; renderAssetList(); }
            }
        } catch (e) {}
    }
};

window.distributeSector = (sectorName) => {
    const tickers = holdings.filter(h => h.sector === sectorName);
    if (tickers.length === 0) return;
    const target = sectorTargets[sectorName] || 0;
    const share = parseFloat((target / tickers.length).toFixed(2));
    tickers.forEach((h, idx) => {
        if (idx === tickers.length - 1) h.targetPercent = parseFloat((target - (share * (tickers.length - 1))).toFixed(2));
        else h.targetPercent = share;
    });
    renderAssetList();
};

window.updateSectorTarget = (sectorName, value) => {
    sectorTargets[sectorName] = parseFloat(value) || 0;
    updateSectorUI();
    updateCalculation();
};

function updateSectorUI() {
    const map = { "시장지수 (Equity)": "target_equity", "채권 (Bonds)": "target_bonds", "원자재 (Commodity)": "target_commodity", "가상자산 (Crypto)": "target_crypto", "현금 (Cash)": "target_cash" };
    Object.keys(map).forEach(s => { if (document.getElementById(map[s])) document.getElementById(map[s]).value = sectorTargets[s] || 0; });
    const totalGoal = Object.values(sectorTargets).reduce((a, b) => a + b, 0);
    const status = document.getElementById('sectorTotalStatus');
    if (status) {
        status.innerText = `Target: ${totalGoal.toFixed(1)}%`;
        status.className = `text-sm font-bold px-3 py-1 rounded-full ${Math.abs(totalGoal - 100) < 0.1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`;
    }
}

// ==========================================
// 3. Rendering & Charts
// ==========================================

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group`;
        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <div class="flex flex-col">
                    <input type="text" value="${item.ticker}" class="bg-transparent font-bold text-slate-700 dark:text-slate-200 uppercase focus:outline-none" onchange="updateHolding(${index}, 'ticker', this.value)">
                    <select class="text-[10px] bg-transparent text-indigo-500 font-bold outline-none" onchange="updateHolding(${index}, 'sector', this.value)">
                        ${PRIMARY_SECTORS.map(s => `<option value="${s}" ${item.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right focus:outline-none" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.price}" class="w-full bg-transparent text-right focus:outline-none" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right focus:outline-none font-semibold text-blue-600 dark:text-blue-400" onchange="updateHolding(${index}, 'targetPercent', this.value)"></td>
            <td class="py-3 px-2 text-center align-middle"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500 p-2">✕</button></td>`;
        assetListBody.appendChild(tr);
    });
    updateCalculation();
}

window.updateHolding = (index, field, value) => {
    if (['qty', 'price', 'targetPercent'].includes(field)) holdings[index][field] = parseFloat(value) || 0;
    else holdings[index][field] = value;
    updateCalculation();
};

window.removeAsset = (index) => { if(confirm('삭제하시겠습니까?')) { holdings.splice(index, 1); renderAssetList(); } };

function updateCalculation() {
    let currentTotal = 0;
    const stats = {
        "시장지수 (Equity)": { current: 0, assigned: 0, goal: sectorTargets["시장지수 (Equity)"] || 0, key: "equity" },
        "채권 (Bonds)": { current: 0, assigned: 0, goal: sectorTargets["채권 (Bonds)"] || 0, key: "bonds" },
        "원자재 (Commodity)": { current: 0, assigned: 0, goal: sectorTargets["원자재 (Commodity)"] || 0, key: "commodity" },
        "가상자산 (Crypto)": { current: 0, assigned: 0, goal: sectorTargets["가상자산 (Crypto)"] || 0, key: "crypto" },
        "현금 (Cash)": { current: 0, assigned: 0, goal: sectorTargets["현금 (Cash)"] || 0, key: "cash" }
    };

    holdings.forEach(h => {
        const val = h.qty * h.price; currentTotal += val;
        if (stats[h.sector]) { stats[h.sector].current += val; stats[h.sector].assigned += (parseFloat(h.targetPercent) || 0); }
    });

    document.getElementById('totalValueDisplay').innerText = `$${currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // 비중 합계 표시
    const totalTarget = holdings.reduce((sum, h) => sum + (parseFloat(h.targetPercent) || 0), 0);
    const totalDisplay = document.getElementById('totalPercentDisplay');
    if (totalDisplay) {
        if (Math.abs(totalTarget - 100) < 0.1) totalDisplay.innerHTML = `<span class="text-emerald-500">✨ 비중 합계: 100%</span>`;
        else totalDisplay.innerHTML = `<span class="${totalTarget > 100 ? 'text-red-500' : 'text-blue-500'} font-bold">⚠️ 비중 합계: ${totalTarget.toFixed(1)}%</span>`;
    }

    // 섹터 진행 바 업데이트
    Object.keys(stats).forEach(name => {
        const s = stats[name];
        const currentPct = currentTotal > 0 ? (s.current / currentTotal) * 100 : 0;
        if (document.getElementById(`current_${s.key}_pct`)) document.getElementById(`current_${s.key}_pct`).innerText = `${currentPct.toFixed(1)}%`;
        if (document.getElementById(`target_${s.key}_pct`)) document.getElementById(`target_${s.key}_pct`).innerText = `${s.goal}%`;
        const prog = document.getElementById(`progress_${s.key}_current`);
        const gap = document.getElementById(`progress_${s.key}_gap`);
        if (prog) prog.style.width = `${Math.min(s.assigned, s.goal)}%`;
        if (gap) gap.style.width = `${Math.max(0, s.goal - s.assigned)}%`;
    });

    // 리밸런싱 가이드
    const base = targetCapital > 0 ? targetCapital : currentTotal;
    const planList = document.getElementById('actionPlanList');
    planList.innerHTML = '';
    let balanced = true;
    holdings.forEach(h => {
        const diff = (base * (h.targetPercent / 100)) - (h.qty * h.price);
        if (Math.abs(diff) > (base * 0.01)) {
            balanced = false;
            const div = document.createElement('div');
            div.className = `p-3 rounded-xl border flex justify-between items-center ${diff > 0 ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`;
            div.innerHTML = `<span class="font-bold">${h.ticker}</span><span class="${diff > 0 ? 'text-red-600' : 'text-blue-600'} font-bold">${diff > 0 ? '매수' : '매도'} $${Math.abs(diff).toLocaleString(undefined, {maximumFractionDigits:0})}</span>`;
            planList.appendChild(div);
        }
    });
    if (balanced) planList.innerHTML = `<div class="text-center py-4 text-slate-400">✅ 비율 양호</div>`;

    updateMainCharts(stats, currentTotal);
    updateSimulationChart(currentTotal);
}

function updateMainCharts(stats, total) {
    const ctxS = document.getElementById('portfolioChart')?.getContext('2d');
    const ctxT = document.getElementById('tickerChart')?.getContext('2d');
    if (!ctxS || !ctxT) return;

    if (chartInstance) chartInstance.destroy();
    if (tickerChartInstance) tickerChartInstance.destroy();

    chartInstance = new Chart(ctxS, {
        type: 'bar',
        data: {
            labels: Object.keys(stats).map(s => s.split(' ')[0]),
            datasets: [
                { label: '현재 (%)', data: Object.values(stats).map(s => total > 0 ? (s.current / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(99, 102, 241, 0.8)' },
                { label: '목표 (%)', data: Object.values(stats).map(s => s.goal), borderColor: '#10b981', type: 'line', fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    tickerChartInstance = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: holdings.map(h => h.ticker),
            datasets: [
                { label: '현재 (%)', data: holdings.map(h => total > 0 ? (h.qty * h.price / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(244, 63, 94, 0.8)' },
                { label: '목표 (%)', data: holdings.map(h => h.targetPercent), borderColor: '#10b981', type: 'line', fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function updateSimulationChart(total) {
    const canvas = document.getElementById('simulationChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (simulationChartInstance) simulationChartInstance.destroy();

    const startVal = total || 10000;
    const years = [0,1,2,3,4,5,6,7,8,9,10];
    const presets = { aggressive: 0.12, balanced: 0.07, defensive: 0.04 };
    const rate = currentDochiStyle ? presets[currentDochiStyle] : 0.07;

    const data = years.map(y => Math.round(startVal * Math.pow(1 + rate, y)));
    const realData = years.map(y => Math.round(startVal * Math.pow(1 + rate - 0.025, y)));

    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? '#94a3b8' : '#64748b';

    simulationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => `${y}y`),
            datasets: [
                { label: '예상 성장', data: data, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                { label: '실질 가치', data: realData, borderColor: '#f59e0b', borderDash: [5,5], fill: false, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color, callback: v => '$' + (v/1000).toFixed(0) + 'k' }, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' } },
                x: { ticks: { color }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color } } }
        }
    });
}

// ==========================================
// 4. Initialization & Auth
// ==========================================

window.selectDochi = (type) => {
    currentDochiStyle = type;
    const p = { aggressive: [70, 10, 5, 10, 5], balanced: [40, 40, 5, 5, 10], defensive: [20, 50, 10, 0, 20] }[type];
    ["시장지수 (Equity)", "채권 (Bonds)", "원자재 (Commodity)", "가상자산 (Crypto)", "현금 (Cash)"].forEach((s, i) => sectorTargets[s] = p[i]);
    updateSectorUI(); updateCalculation();
    alert(`성향 설정 완료! '균등배분'으로 종목에 적용하세요.`);
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userProfile) userProfile.classList.remove('hidden');
        if (userPhoto) userPhoto.src = user.photoURL;
        if (loginAlert) loginAlert.classList.add('hidden');
        if (appContent) { appContent.classList.remove('hidden'); appContent.classList.add('grid'); }
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.holdings) holdings = data.holdings;
            if (data.sectorTargets) sectorTargets = data.sectorTargets;
            if (data.targetCapital && targetCapitalInput) { targetCapital = data.targetCapital; targetCapitalInput.value = targetCapital; }
        }
        updateSectorUI(); renderAssetList();
    }
});

if (saveBtn) saveBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    try { await setDoc(doc(db, "users", currentUser.uid), { uid: currentUser.uid, holdings, sectorTargets, targetCapital, lastUpdated: new Date() }); alert("저장 완료!"); } catch (e) { alert("저장 실패"); }
});

if (addAssetBtn) addAssetBtn.addEventListener('click', () => { holdings.push({ ticker: "NEW", name: "", qty: 0, price: 0, targetPercent: 0, sector: "시장지수 (Equity)" }); renderAssetList(); });
if (refreshPricesBtn) refreshPricesBtn.addEventListener('click', refreshAllPrices);
if (targetCapitalInput) targetCapitalInput.addEventListener('input', (e) => { targetCapital = parseFloat(e.target.value) || 0; updateCalculation(); });
if (tickerSearchInput) {
    let timer = null;
    tickerSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (timer) clearTimeout(timer);
        if (q.length < 2) { searchResultsContainer.classList.add('hidden'); return; }
        timer = setTimeout(() => performSearch(q), 500);
    });
}

// Initial Run
updateSectorUI();
renderAssetList();
