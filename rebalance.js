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
} catch (e) { console.error("Firebase init error:", e); }

// ==========================================
// 1. State Management
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

// DOM
const assetListBody = document.getElementById('assetListBody');
const totalValueDisplay = document.getElementById('totalValueDisplay');
const totalPercentDisplay = document.getElementById('totalPercentDisplay');
const actionPlanList = document.getElementById('actionPlanList');
const targetCapitalInput = document.getElementById('targetCapitalInput');
const refreshPricesBtn = document.getElementById('refreshPricesBtn');
const csvFileInput = document.getElementById('csvFileInput');
const tickerSearchInput = document.getElementById('tickerSearchInput');

// ==========================================
// 2. Logic & Utilities
// ==========================================

function getMappedSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (quoteType === 'CRYPTOCURRENCY' || t.endsWith('-USD') || t.endsWith('-KRW') || t === 'BTC' || t === 'ETH') return "가상자산 (Crypto)";
    if (t === 'USD' || t === 'KRW' || t === 'CASH' || t === '현금') return "현금 (Cash)";
    if (yahooSector.includes("Treasury") || yahooSector.includes("Bonds") || t === 'TLT' || t === 'BND' || t === 'IEF') return "채권 (Bonds)";
    if (yahooSector.includes("Commodit") || t === 'GLD' || t === 'IAU' || t === 'USO' || t === 'SLV') return "원자재 (Commodity)";
    return "시장지수 (Equity)";
}

function migrateData(data) {
    if (data.holdings) {
        data.holdings.forEach(h => {
            if (h.sector === "안전자산 (Bonds/Cash)") h.sector = "채권 (Bonds)";
            if (h.sector === "원자재 (Gold/Alt)") h.sector = "원자재 (Commodity)";
            if (!h.sector) h.sector = getMappedSector(h.ticker);
            if (h.locked === undefined) h.locked = false;
            if (h.price === undefined) h.price = 0;
            if (h.qty === undefined) h.qty = 0;
            if (h.targetPercent === undefined) h.targetPercent = 0;
        });
    }
    return data;
}

async function fetchInternalAPI(endpoint, params) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/${endpoint}?${queryString}`);
    if (!response.ok) throw new Error("API Error");
    return await response.json();
}

// ==========================================
// 3. UI Actions (Window functions for HTML)
// ==========================================

window.toggleLock = (index) => {
    holdings[index].locked = !holdings[index].locked;
    renderAssetList();
};

window.normalizeWeights = () => {
    const locked = holdings.filter(h => h.locked);
    const unlocked = holdings.filter(h => !h.locked);
    if (unlocked.length === 0) return;
    const lockedSum = locked.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    const rem = Math.max(0, 100 - lockedSum);
    const curUnlockedSum = unlocked.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    if (curUnlockedSum === 0) {
        const share = parseFloat((rem / unlocked.length).toFixed(2));
        unlocked.forEach((h, i) => h.targetPercent = (i === unlocked.length-1) ? parseFloat((rem - share*(unlocked.length-1)).toFixed(2)) : share);
    } else {
        let dist = 0;
        unlocked.forEach((h, i) => {
            if (i === unlocked.length-1) h.targetPercent = parseFloat((rem - dist).toFixed(2));
            else { const s = parseFloat(((h.targetPercent / curUnlockedSum) * rem).toFixed(2)); h.targetPercent = s; dist += s; }
        });
    }
    renderAssetList();
};

window.distributeSector = (sectorName) => {
    const ts = holdings.filter(h => h.sector === sectorName);
    if (ts.length === 0) return;
    const goal = sectorTargets[sectorName] || 0;
    const share = parseFloat((goal / ts.length).toFixed(2));
    ts.forEach((h, idx) => h.targetPercent = (idx === ts.length-1) ? parseFloat((goal - share*(ts.length-1)).toFixed(2)) : share);
    renderAssetList();
};

window.updateSectorTarget = (sector, val) => { sectorTargets[sector] = parseFloat(val) || 0; updateSectorUI(); updateCalculation(); };

window.addQuickAsset = async (ticker, sector) => {
    if (holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase())) { alert("이미 목록에 있습니다."); return; }
    const isCash = (ticker === 'USD' || ticker === 'KRW');
    holdings.push({ ticker, name: isCash ? ticker : "불러오는 중...", qty: 0, price: isCash ? 1 : 0, targetPercent: 0, sector, locked: false });
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

function updateSectorUI() {
    const map = { "시장지수 (Equity)": "target_equity", "채권 (Bonds)": "target_bonds", "원자재 (Commodity)": "target_commodity", "가상자산 (Crypto)": "target_crypto", "현금 (Cash)": "target_cash" };
    Object.keys(map).forEach(s => { const el = document.getElementById(map[s]); if (el) el.value = sectorTargets[s] || 0; });
    const totalGoal = Object.values(sectorTargets).reduce((a, b) => a + b, 0);
    const status = document.getElementById('sectorTotalStatus');
    if (status) {
        status.innerText = `Guide: ${totalGoal.toFixed(1)}%`;
        status.className = `text-sm font-bold px-3 py-1 rounded-full ${Math.abs(totalGoal-100)<0.1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`;
    }
}

// ==========================================
// 4. Rendering & Calculation
// ==========================================

function renderAssetList() {
    if (!assetListBody) return;
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${item.locked ? 'bg-indigo-50/10' : ''}`;
        tr.innerHTML = `
            <td class="py-3 px-2 text-center align-middle"><button onclick="toggleLock(${index})" class="text-lg">${item.locked ? '🔒' : '🔓'}</button></td>
            <td class="py-3 px-2">
                <div class="flex flex-col">
                    <input type="text" value="${item.ticker}" class="bg-transparent font-bold uppercase focus:outline-none w-full" onchange="updateHolding(${index}, 'ticker', this.value)">
                    <select class="text-[10px] bg-transparent text-indigo-500 font-bold outline-none" onchange="updateHolding(${index}, 'sector', this.value)">
                        ${PRIMARY_SECTORS.map(s => `<option value="${s}" ${item.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </td>
            <td class="py-3 px-2"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right focus:outline-none" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2"><input type="number" value="${item.price}" class="w-full bg-transparent text-right focus:outline-none" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right focus:outline-none font-semibold text-blue-600" onchange="updateHolding(${index}, 'targetPercent', this.value)" ${item.locked ? 'readonly' : ''}></td>
            <td class="py-3 px-2 text-center"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500">✕</button></td>`;
        assetListBody.appendChild(tr);
    });
    updateCalculation();
}

window.updateHolding = (idx, field, val) => {
    holdings[idx][field] = (['qty', 'price', 'targetPercent'].includes(field)) ? parseFloat(val) || 0 : val;
    updateCalculation();
};

window.removeAsset = (idx) => { if(confirm('삭제하시겠습니까?')) { holdings.splice(idx, 1); renderAssetList(); } };

function updateCalculation() {
    let currentTotal = 0;
    const stats = { "시장지수 (Equity)": { current: 0, assigned: 0, goal: sectorTargets["시장지수 (Equity)"] || 0, key: "equity" }, "채권 (Bonds)": { current: 0, assigned: 0, goal: sectorTargets["채권 (Bonds)"] || 0, key: "bonds" }, "원자재 (Commodity)": { current: 0, assigned: 0, goal: sectorTargets["원자재 (Commodity)"] || 0, key: "commodity" }, "가상자산 (Crypto)": { current: 0, assigned: 0, goal: sectorTargets["가상자산 (Crypto)"] || 0, key: "crypto" }, "현금 (Cash)": { current: 0, assigned: 0, goal: sectorTargets["현금 (Cash)"] || 0, key: "cash" } };
    
    holdings.forEach(h => {
        const v = (h.qty || 0) * (h.price || 0); currentTotal += v;
        if (stats[h.sector]) { stats[h.sector].current += v; stats[h.sector].assigned += (parseFloat(h.targetPercent) || 0); }
    });

    if (totalValueDisplay) totalValueDisplay.innerText = `$${currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    const totTarg = holdings.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    if (totalPercentDisplay) totalPercentDisplay.innerHTML = `<span class="${Math.abs(totTarg-100)<0.1?'text-emerald-500':'text-blue-500'} font-bold">비중 합계: ${totTarg.toFixed(2)}%</span>`;

    Object.keys(stats).forEach(n => {
        const s = stats[n]; const curP = currentTotal > 0 ? (s.current / currentTotal)*100 : 0;
        const cp = document.getElementById(`current_${s.key}_pct`); if(cp) cp.innerText = `${curP.toFixed(1)}%`;
        const tp = document.getElementById(`target_${s.key}_pct`); if(tp) tp.innerText = `${s.goal}%`;
        const pr = document.getElementById(`progress_${s.key}_current`); if(pr) pr.style.width = `${Math.min(s.assigned, s.goal)}%`;
        const gp = document.getElementById(`progress_${s.key}_gap`); if(gp) gp.style.width = `${Math.max(0, s.goal - s.assigned)}%`;
    });

    const base = targetCapital > 0 ? targetCapital : currentTotal;
    if (actionPlanList) {
        actionPlanList.innerHTML = '';
        let bal = true;
        holdings.forEach(h => {
            const diff = (base * ((parseFloat(h.targetPercent)||0)/100)) - ((h.qty||0)*(h.price||0));
            if (Math.abs(diff) > Math.max(10, base*0.01)) {
                bal = false;
                const d = document.createElement('div');
                d.className = `p-3 rounded-xl border flex justify-between items-center ${diff>0?'bg-red-50/50 border-red-100':'bg-blue-50/50 border-blue-100'}`;
                const shares = h.price > 0 ? Math.floor(Math.abs(diff)/h.price) : 0;
                d.innerHTML = `<div class="flex flex-col"><span class="font-bold">${h.ticker}</span><span class="text-[10px] opacity-60">${shares > 0 ? shares + '주' : '금액'} ${diff > 0 ? '매수' : '매도'}</span></div><span class="${diff>0?'text-red-600':'text-blue-600'} font-black">$${Math.abs(diff).toLocaleString(undefined,{maximumFractionDigits:0})}</span>`;
                actionPlanList.appendChild(d);
            }
        });
        if (bal) actionPlanList.innerHTML = '<p class="text-center py-10 text-slate-400 font-bold italic">Perfectly Balanced.</p>';
    }

    updateCharts(stats, currentTotal);
}

function updateCharts(stats, total) {
    const ctxS = document.getElementById('portfolioChart')?.getContext('2d');
    const ctxT = document.getElementById('tickerChart')?.getContext('2d');
    const ctxSim = document.getElementById('simulationChart')?.getContext('2d');
    if (!ctxS || !ctxT || !ctxSim) return;

    if (chartInstance) chartInstance.destroy();
    if (tickerChartInstance) tickerChartInstance.destroy();
    if (simulationChartInstance) simulationChartInstance.destroy();

    const isD = document.documentElement.classList.contains('dark');
    const col = isD ? '#94a3b8' : '#64748b';

    chartInstance = new Chart(ctxS, {
        type: 'bar',
        data: { labels: Object.keys(stats).map(s=>s.split(' ')[0]), datasets: [{ label: '현재 (%)', data: Object.values(stats).map(s=>total>0?(s.current/total*100).toFixed(1):0), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 4 }, { label: '목표 (%)', data: Object.values(stats).map(s=>s.goal), borderColor: '#10b981', type: 'line', fill: false, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: col } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col } } } }
    });

    tickerChartInstance = new Chart(ctxT, {
        type: 'bar',
        data: { labels: holdings.map(h=>h.ticker), datasets: [{ label: '현재 (%)', data: holdings.map(h=>total>0?((h.qty*h.price)/total*100).toFixed(1):0), backgroundColor: 'rgba(244, 63, 94, 0.8)', borderRadius: 4 }, { label: '목표 (%)', data: holdings.map(h=>h.targetPercent), borderColor: '#10b981', type: 'line', fill: false, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: col } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col } } } }
    });

    const years = [0,1,2,3,4,5,6,7,8,9,10];
    const presets = { aggressive: 0.12, balanced: 0.07, defensive: 0.04 };
    const rate = currentDochiStyle ? presets[currentDochiStyle] : 0.07;
    const startVal = total || 10000;
    simulationChartInstance = new Chart(ctxSim, {
        type: 'line',
        data: { labels: years.map(y=>y+'y'), datasets: [{ label: '예상 성장', data: years.map(y=>Math.round(startVal*Math.pow(1+rate, y))), borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, pointRadius: 0 }, { label: '실질 가치', data: years.map(y=>Math.round(startVal*Math.pow(1+rate-0.025, y))), borderColor: '#f59e0b', borderDash: [5,5], tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: col, callback: v => '$'+(v/1000).toFixed(0)+'k' }, grid: { color: isD ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' } }, x: { ticks: { color: col }, grid: { display: false } } }, plugins: { legend: { labels: { color: col } } } }
    });
}

// ==========================================
// 5. Auth & Persistence
// ==========================================

async function refreshAllPrices() {
    const valid = holdings.filter(h => h.ticker && h.ticker.trim() !== '' && !['CASH', 'USD', 'KRW', '현금'].includes(h.ticker.toUpperCase()));
    if (valid.length === 0) return;
    refreshPricesBtn.disabled = true; refreshPricesBtn.innerText = "⏳...";
    for (const item of valid) {
        try {
            const data = await fetchInternalAPI('price', { ticker: item.ticker });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) { item.price = meta.regularMarketPrice || meta.chartPreviousClose || 0; item.name = meta.symbol; }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 100));
    }
    refreshPricesBtn.disabled = false; refreshPricesBtn.innerText = "🔄 시세 새로고침";
    renderAssetList();
}

async function performSearch(query) {
    const container = document.getElementById('searchResultsContainer');
    const list = document.getElementById('searchResults');
    if(!container || !list) return;
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
                tickerSearchInput.value = ''; container.classList.add('hidden'); renderAssetList();
            };
            list.appendChild(li);
        });
    } catch (e) { list.innerHTML = `<li class="text-center py-4 text-red-400 text-sm">오류</li>`; }
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('loginBtn')?.classList.add('hidden');
        document.getElementById('userProfile')?.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        document.getElementById('loginAlert')?.classList.add('hidden');
        document.getElementById('appContent')?.classList.remove('hidden');
        document.getElementById('appContent')?.classList.add('grid');
        
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists()) {
                const data = migrateData(docSnap.data());
                if (data.holdings) holdings = data.holdings;
                if (data.sectorTargets) sectorTargets = data.sectorTargets;
                if (data.targetCapital && targetCapitalInput) { targetCapital = data.targetCapital; targetCapitalInput.value = targetCapital; }
            }
        } catch (e) { console.error("Firestore load error:", e); }
        updateSectorUI(); renderAssetList();
    }
});

// Initialization & Events
if (document.getElementById('saveBtn')) {
    document.getElementById('saveBtn').addEventListener('click', async () => {
        if (!currentUser) return;
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, "users", currentUser.uid), { uid: currentUser.uid, holdings, sectorTargets, targetCapital, lastUpdated: new Date() }, { merge: true });
            await batch.commit(); alert("저장 성공! 💾");
        } catch (e) { alert("저장 실패"); }
    });
}

document.getElementById('addAssetBtn')?.addEventListener('click', () => { holdings.push({ ticker: "NEW", name: "", qty: 0, price: 0, targetPercent: 0, sector: "시장지수 (Equity)", locked: false }); renderAssetList(); });
if (refreshPricesBtn) refreshPricesBtn.addEventListener('click', refreshAllPrices);
if (targetCapitalInput) targetCapitalInput.addEventListener('input', (e) => { targetCapital = parseFloat(e.target.value) || 0; updateCalculation(); });
if (tickerSearchInput) {
    let timer = null;
    tickerSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (timer) clearTimeout(timer);
        if (q.length < 2) { document.getElementById('searchResultsContainer')?.classList.add('hidden'); return; }
        timer = setTimeout(() => performSearch(q), 500);
    });
}
if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const rows = event.target.result.split('\n').slice(1);
            rows.forEach(row => {
                const [t, q] = row.split(',').map(s => s?.trim());
                if (t && q) holdings.push({ ticker: t.toUpperCase(), name: t, qty: parseFloat(q), price: 0, targetPercent: 0, sector: "시장지수 (Equity)", locked: false });
            });
            renderAssetList(); alert("CSV 로드 완료!");
        };
        reader.readAsText(file);
    });
}

window.selectDochi = (type) => {
    currentDochiStyle = type;
    const p = { aggressive: [70, 10, 5, 10, 5], balanced: [40, 40, 5, 5, 10], defensive: [20, 50, 10, 0, 20] }[type];
    const sNames = ["시장지수 (Equity)", "채권 (Bonds)", "원자재 (Commodity)", "가상자산 (Crypto)", "현금 (Cash)"];
    sNames.forEach((s, i) => sectorTargets[s] = p[i]);
    updateSectorUI(); updateCalculation();
    alert(`[${type.toUpperCase()}] 가이드가 적용되었습니다.`);
};

// Initial Run
updateSectorUI();
renderAssetList();