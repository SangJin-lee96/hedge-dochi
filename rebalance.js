// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
} catch (e) { console.error("Firebase initialization error:", e); }

// ==========================================
// 1. State Management (Advanced Engine)
// ==========================================
let currentUser = null;
let holdings = [
    { ticker: "VOO", name: "Vanguard S&P 500", qty: 10, price: 500, targetPercent: 50, sector: "시장지수 (Equity)", locked: false },
    { ticker: "TLT", name: "20+ Year Treasury Bond", qty: 20, price: 90, targetPercent: 30, sector: "채권 (Bonds)", locked: false },
    { ticker: "BTC-USD", name: "Bitcoin", qty: 0.1, price: 40000, targetPercent: 10, sector: "가상자산 (Crypto)", locked: false },
    { ticker: "USD", name: "US Dollar", qty: 1000, price: 1, targetPercent: 10, sector: "현금 (Cash)", locked: false }
];

const PRIMARY_SECTORS = ["시장지수 (Equity)", "채권 (Bonds)", "원자재 (Commodity)", "가상자산 (Crypto)", "현금 (Cash)"];
let sectorTargets = { "시장지수 (Equity)": 50, "채권 (Bonds)": 30, "원자재 (Commodity)": 0, "가상자산 (Crypto)": 10, "현금 (Cash)": 10 };
let targetCapital = 0;
let chartInstance = null, tickerChartInstance = null, simulationChartInstance = null;
let currentDochiStyle = null, isIntegerMode = false;

// DOM Elements
const assetListBody = document.getElementById('assetListBody');
const totalValueDisplay = document.getElementById('totalValueDisplay');
const totalPercentDisplay = document.getElementById('totalPercentDisplay');
const actionPlanList = document.getElementById('actionPlanList');
const csvFileInput = document.getElementById('csvFileInput');

// ==========================================
// 2. Precision Rebalancing Engine
// ==========================================

/**
 * Normalizes all target weights to sum exactly to 100.00%.
 * Follows the Asset Locking logic: Locked assets are constant, Unlocked assets are adjusted.
 */
window.normalizeWeights = () => {
    const lockedAssets = holdings.filter(h => h.locked);
    const unlockedAssets = holdings.filter(h => !h.locked);
    
    if (unlockedAssets.length === 0) {
        if (lockedAssets.length > 0) alert("모든 자산이 잠겨있어 정규화할 수 없습니다.");
        return;
    }

    const lockedSum = lockedAssets.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    const remainingWeight = Math.max(0, 100 - lockedSum);
    const currentUnlockedSum = unlockedAssets.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);

    if (currentUnlockedSum === 0) {
        // Equal distribution if all unlocked are zero
        const share = parseFloat((remainingWeight / unlockedAssets.length).toFixed(2));
        unlockedAssets.forEach((h, i) => {
            if (i === unlockedAssets.length - 1) h.targetPercent = parseFloat((remainingWeight - (share * (unlockedAssets.length - 1))).toFixed(2));
            else h.targetPercent = share;
        });
    } else {
        // Proportional redistribution
        let distributed = 0;
        unlockedAssets.forEach((h, i) => {
            if (i === unlockedAssets.length - 1) {
                h.targetPercent = parseFloat((remainingWeight - distributed).toFixed(2));
            } else {
                const share = parseFloat(((h.targetPercent / currentUnlockedSum) * remainingWeight).toFixed(2));
                h.targetPercent = share;
                distributed += share;
            }
        });
    }
    renderAssetList();
};

window.toggleLock = (index) => {
    holdings[index].locked = !holdings[index].locked;
    renderAssetList();
};

// Top-Down: Sector Target -> Ticker Target Sync
window.distributeSector = (sectorName) => {
    const tickers = holdings.filter(h => h.sector === sectorName);
    if (tickers.length === 0) return;
    const targetGoal = sectorTargets[sectorName] || 0;
    const share = parseFloat((targetGoal / tickers.length).toFixed(2));
    tickers.forEach((h, idx) => {
        if (idx === tickers.length - 1) h.targetPercent = parseFloat((targetGoal - (share * (tickers.length - 1))).toFixed(2));
        else h.targetPercent = share;
    });
    renderAssetList();
};

// Bottom-Up: Ticker Target -> Sector Status (Visual Only)
function updateSectorProgress(stats, totalValue) {
    Object.keys(stats).forEach(name => {
        const s = stats[name];
        const currentPct = totalValue > 0 ? (s.current / totalValue) * 100 : 0;
        const idMap = { "시장지수 (Equity)": "equity", "채권 (Bonds)": "bonds", "원자재 (Commodity)": "commodity", "가상자산 (Crypto)": "crypto", "현금 (Cash)": "cash" };
        const key = idMap[name];
        if (!key) return;

        if (document.getElementById(`current_${key}_pct`)) document.getElementById(`current_${key}_pct`).innerText = `${currentPct.toFixed(1)}%`;
        if (document.getElementById(`target_${key}_pct`)) document.getElementById(`target_${key}_pct`).innerText = `${s.goal}%`;
        
        const prog = document.getElementById(`progress_${key}_current`);
        const gap = document.getElementById(`progress_${key}_gap`);
        if (prog) prog.style.width = `${Math.min(s.assigned, s.goal)}%`;
        if (gap) gap.style.width = `${Math.max(0, s.goal - s.assigned)}%`;
    });
}

// ==========================================
// 3. UI Rendering
// ==========================================

function renderAssetList() {
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${item.locked ? 'bg-indigo-50/10' : ''}`;
        tr.innerHTML = `
            <td class="py-3 px-2 align-middle">
                <button onclick="toggleLock(${index})" class="text-lg transition-transform active:scale-90" title="${item.locked ? '잠금 해제' : '비중 잠금'}">
                    ${item.locked ? '🔒' : '🔓'}
                </button>
            </td>
            <td class="py-3 px-2 align-middle">
                <div class="flex flex-col">
                    <input type="text" value="${item.ticker}" class="bg-transparent font-bold text-slate-700 dark:text-slate-200 uppercase focus:outline-none w-full" onchange="updateHolding(${index}, 'ticker', this.value)">
                    <select class="text-[10px] bg-transparent text-indigo-500 font-bold outline-none cursor-pointer" onchange="updateHolding(${index}, 'sector', this.value)">
                        ${PRIMARY_SECTORS.map(s => `<option value="${s}" ${item.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right focus:outline-none" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2 align-middle"><input type="number" value="${item.price}" class="w-full bg-transparent text-right focus:outline-none" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2 align-middle">
                <div class="relative">
                    <input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right focus:outline-none font-semibold ${item.locked ? 'text-indigo-600' : 'text-blue-600 dark:text-blue-400'}" onchange="updateHolding(${index}, 'targetPercent', this.value)" ${item.locked ? 'readonly' : ''}>
                </div>
            </td>
            <td class="py-3 px-2 text-center align-middle">
                <button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500 transition-colors">✕</button>
            </td>`;
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

    if (totalValueDisplay) totalValueDisplay.innerText = `$${currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Target Percent Validation
    const totalTarget = holdings.reduce((sum, h) => sum + (parseFloat(h.targetPercent) || 0), 0);
    if (totalPercentDisplay) {
        if (Math.abs(totalTarget - 100) < 0.01) totalPercentDisplay.innerHTML = `<span class="text-emerald-500">✨ 비중 합계: 100.00%</span>`;
        else totalPercentDisplay.innerHTML = `<span class="${totalTarget > 100 ? 'text-red-500' : 'text-blue-500'} font-bold">⚠️ 비중 합계: ${totalTarget.toFixed(2)}%</span>`;
    }

    updateSectorProgress(stats, currentTotal);

    // Rebalancing Plan (Threshold-based)
    const base = targetCapital > 0 ? targetCapital : currentTotal;
    actionPlanList.innerHTML = '';
    let balanced = true;
    const THRESHOLD_VAL = Math.max(10, base * 0.01); // Min $10 or 1% deviation

    holdings.forEach(h => {
        const targetVal = base * (h.targetPercent / 100);
        const currentVal = h.qty * h.price;
        const diff = targetVal - currentVal;

        if (Math.abs(diff) > THRESHOLD_VAL) {
            balanced = false;
            const div = document.createElement('div');
            div.className = `p-3 rounded-xl border flex justify-between items-center ${diff > 0 ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`;
            const shares = h.price > 0 ? Math.floor(Math.abs(diff) / h.price) : 0;
            div.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-bold text-slate-800 dark:text-slate-200">${h.ticker}</span>
                    <span class="text-[10px] opacity-60">${shares > 0 ? shares + '주 ' + (diff > 0 ? '매수' : '매도') : '금액 조정'}</span>
                </div>
                <span class="${diff > 0 ? 'text-red-600' : 'text-blue-600'} font-black">$${Math.abs(diff).toLocaleString(undefined, {maximumFractionDigits:0})}</span>`;
            actionPlanList.appendChild(div);
        }
    });
    if (balanced) actionPlanList.innerHTML = `<div class="text-center py-10 text-slate-400 font-bold italic">"Perfectly Balanced."<br><span class="text-[10px] font-normal not-italic">모든 비중이 임계치 이내입니다.</span></div>`;

    updateMainCharts(stats, currentTotal);
    updateSimulationChart(currentTotal);
}

// ==========================================
// 4. Data Import & Batch Save
// ==========================================

if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const rows = text.split('\n').slice(1); // Skip header
            rows.forEach(row => {
                const [ticker, qty] = row.split(',').map(s => s?.trim());
                if (ticker && qty) {
                    const existing = holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase());
                    if (existing) existing.qty = parseFloat(qty);
                    else holdings.push({ ticker: ticker.toUpperCase(), name: ticker, qty: parseFloat(qty), price: 0, targetPercent: 0, sector: "시장지수 (Equity)", locked: false });
                }
            });
            renderAssetList();
            alert("CSV 데이터를 불러왔습니다. '시세 새로고침'을 눌러 최신가를 반영하세요.");
        };
        reader.readAsText(file);
    });
}

const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, "users", currentUser.uid);
            batch.set(userRef, {
                uid: currentUser.uid,
                holdings,
                sectorTargets,
                targetCapital,
                lastUpdated: new Date()
            }, { merge: true });
            await batch.commit();
            alert("포트폴리오가 안전하게 저장되었습니다! 💾");
        } catch (e) { console.error(e); alert("저장 중 오류가 발생했습니다."); }
    });
}

// ==========================================
// 5. Chart Visualization
// ==========================================

function updateMainCharts(stats, total) {
    const ctxS = document.getElementById('portfolioChart')?.getContext('2d');
    const ctxT = document.getElementById('tickerChart')?.getContext('2d');
    if (!ctxS || !ctxT) return;

    if (chartInstance) chartInstance.destroy();
    if (tickerChartInstance) tickerChartInstance.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? '#94a3b8' : '#64748b';

    chartInstance = new Chart(ctxS, {
        type: 'bar',
        data: {
            labels: Object.keys(stats).map(s => s.split(' ')[0]),
            datasets: [
                { label: '현재 (%)', data: Object.values(stats).map(s => total > 0 ? (s.current / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 4 },
                { label: '목표 (%)', data: Object.values(stats).map(s => s.goal), borderColor: '#10b981', type: 'line', fill: false, tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color } }, x: { ticks: { color } } }, plugins: { legend: { labels: { color } } } }
    });

    tickerChartInstance = new Chart(ctxT, {
        type: 'bar',
        data: {
            labels: holdings.map(h => h.ticker),
            datasets: [
                { label: '현재 (%)', data: holdings.map(h => total > 0 ? (h.qty * h.price / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(244, 63, 94, 0.8)', borderRadius: 4 },
                { label: '목표 (%)', data: holdings.map(h => h.targetPercent), borderColor: '#10b981', type: 'line', fill: false, tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color } }, x: { ticks: { color } } }, plugins: { legend: { labels: { color } } } }
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
                { label: '예상 성장', data: data, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, pointRadius: 0 },
                { label: '실질 가치', data: realData, borderColor: '#f59e0b', borderDash: [5,5], fill: false, tension: 0.4, pointRadius: 0 }
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
// 6. Character & Auth
// ==========================================

window.selectDochi = (type) => {
    currentDochiStyle = type;
    const p = { aggressive: [70, 10, 5, 10, 5], balanced: [40, 40, 5, 5, 10], defensive: [20, 50, 10, 0, 20] }[type];
    const sNames = ["시장지수 (Equity)", "채권 (Bonds)", "원자재 (Commodity)", "가상자산 (Crypto)", "현금 (Cash)"];
    sNames.forEach((s, i) => sectorTargets[s] = p[i]);
    updateSectorUI(); updateCalculation();
    alert(`[${type.toUpperCase()}] 성향 가이드가 적용되었습니다.`);
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('loginBtn')?.classList.add('hidden');
        document.getElementById('userProfile')?.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        document.getElementById('loginAlert')?.classList.add('hidden');
        document.getElementById('appContent')?.classList.remove('hidden');
        document.getElementById('appContent')?.classList.add('grid');
        
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

async function refreshAllPrices() {
    const valid = holdings.filter(h => h.ticker && h.ticker.trim() !== '' && !['CASH', 'USD', 'KRW', '현금'].includes(h.ticker.toUpperCase()));
    if (valid.length === 0) return;
    const btn = document.getElementById('refreshPricesBtn');
    btn.disabled = true; btn.innerText = "⏳ 갱신 중...";
    for (const item of valid) {
        try {
            const data = await fetchInternalAPI('price', { ticker: item.ticker });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
                item.price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
                item.name = meta.symbol;
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 100));
    }
    btn.disabled = false; btn.innerText = "🔄 시세 새로고침";
    renderAssetList();
}

async function performSearch(query) {
    const container = document.getElementById('searchResultsContainer');
    const list = document.getElementById('searchResults');
    container.classList.remove('hidden');
    list.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';
    try {
        const data = await fetchInternalAPI('search', { q: query });
        const quotes = data.quotes || [];
        list.innerHTML = quotes.length ? '' : '<li class="text-center py-4 text-slate-400 text-sm">결과 없음</li>';
        quotes.forEach(quote => {
            if (!quote.symbol) return;
            const li = document.createElement('li');
            li.className = "p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-900 group";
            li.innerHTML = `<div class="flex justify-between items-center"><div class="flex-1 min-w-0 pr-4"><div class="flex items-center gap-2"><span class="font-bold text-blue-600 dark:text-blue-400 truncate">${quote.symbol}</span></div><div class="text-sm text-slate-600 dark:text-slate-300 truncate">${quote.shortname || quote.symbol}</div></div><button class="shrink-0 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">추가</button></div>`;
            li.onclick = () => {
                const detectedSector = getMappedSector(quote.symbol, quote.quoteType, quote.sector);
                holdings.push({ ticker: quote.symbol, name: quote.shortname || quote.symbol, qty: 0, price: 0, targetPercent: 0, sector: detectedSector, locked: false });
                document.getElementById('tickerSearchInput').value = ''; container.classList.add('hidden'); renderAssetList();
            };
            list.appendChild(li);
        });
    } catch (e) { list.innerHTML = `<li class="text-center py-4 text-red-400 text-sm">네트워크 오류</li>`; }
}

// Initial Events
document.getElementById('addAssetBtn')?.addEventListener('click', () => { holdings.push({ ticker: "NEW", name: "", qty: 0, price: 0, targetPercent: 0, sector: "시장지수 (Equity)", locked: false }); renderAssetList(); });
document.getElementById('refreshPricesBtn')?.addEventListener('click', refreshAllPrices);
document.getElementById('targetCapitalInput')?.addEventListener('input', (e) => { targetCapital = parseFloat(e.target.value) || 0; updateCalculation(); });
document.getElementById('tickerSearchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) { document.getElementById('searchResultsContainer').classList.add('hidden'); return; }
    performSearch(q);
});

// Initial Run
updateSectorUI();
renderAssetList();