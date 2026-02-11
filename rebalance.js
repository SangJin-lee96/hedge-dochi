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
let holdings = []; 
const PRIMARY_SECTORS = ["주식 (Equity)", "채권 (Fixed Income)", "귀금속 (Precious Metals)", "원자재 (Commodity)", "가상자산 (Digital Asset)", "현금 (Liquidity)"];
let sectorTargets = { "주식 (Equity)": 40, "채권 (Fixed Income)": 30, "귀금속 (Precious Metals)": 10, "원자재 (Commodity)": 5, "가상자산 (Digital Asset)": 5, "현금 (Liquidity)": 10 };
let targetCapital = 0;
let chartInstance = null, tickerChartInstance = null, simulationChartInstance = null;
let currentDochiStyle = null, isIntegerMode = false;

// DOM
const assetListBody = document.getElementById('assetListBody');
const totalValueDisplay = document.getElementById('totalValueDisplay');
const totalPercentDisplay = document.getElementById('totalPercentDisplay');
const actionPlanList = document.getElementById('actionPlanList');
const targetCapitalInput = document.getElementById('targetCapitalInput');

// ==========================================
// 2. Logic & Mapping
// ==========================================

function getMappedSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (t === 'GLD' || t === 'IAU' || t === 'SLV' || t === '금' || t === '은') return "귀금속 (Precious Metals)";
    if (t === 'BTC-USD' || t === 'ETH-USD' || t === 'BTC' || t === 'ETH' || quoteType === 'CRYPTOCURRENCY') return "가상자산 (Digital Asset)";
    if (t === 'USD' || t === 'KRW' || t === 'CASH' || t === 'BIL' || t === 'SGOV' || t === '현금') return "현금 (Liquidity)";
    if (t === 'TLT' || t === 'IEF' || t === 'SHY' || t === 'BND' || t === 'AGG' || yahooSector.includes("Bonds") || yahooSector.includes("Treasury")) return "채권 (Fixed Income)";
    if (t === 'USO' || t === 'DBC' || t === 'GSG' || t === 'CPER' || yahooSector.includes("Commodit")) return "원자재 (Commodity)";
    return "주식 (Equity)";
}

function migrateData(data) {
    if (data.holdings) {
        data.holdings.forEach(h => {
            if (h.sector === "시장지수 (Equity)") h.sector = "주식 (Equity)";
            if (h.sector === "채권 (Bonds)" || h.sector === "안전자산 (Bonds/Cash)") h.sector = "채권 (Fixed Income)";
            if (h.sector === "원자재 (Commodity)" && (h.ticker.includes("GLD") || h.ticker.includes("금"))) h.sector = "귀금속 (Precious Metals)";
            if (h.sector === "가상자산 (Crypto)") h.sector = "가상자산 (Digital Asset)";
            if (h.sector === "현금 (Cash)") h.sector = "현금 (Liquidity)";
            if (!h.sector || !PRIMARY_SECTORS.includes(h.sector)) h.sector = getMappedSector(h.ticker);
            if (h.locked === undefined) h.locked = false;
            if (h.price === undefined) h.price = 0;
            if (h.qty === undefined) h.qty = 0;
            if (h.targetPercent === undefined) h.targetPercent = 0;
        });
    }
    return data;
}

// ==========================================
// 3. Precision Engine & UI Actions
// ==========================================

window.toggleLock = (index) => { holdings[index].locked = !holdings[index].locked; renderAssetList(); };

window.normalizeWeights = () => {
    const locked = holdings.filter(h => h.locked);
    const unlocked = holdings.filter(h => !h.locked);
    if (unlocked.length === 0) return;
    const lockedSum = locked.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    const rem = Math.max(0, 100 - lockedSum);
    const curUnlockedSum = unlocked.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    if (curUnlockedSum === 0) {
        const share = parseFloat((rem / unlocked.length).toFixed(2));
        unlocked.forEach((h, i) => h.targetPercent = (i === unlocked.length - 1) ? parseFloat((rem - share * (unlocked.length - 1)).toFixed(2)) : share);
    } else {
        let dist = 0;
        unlocked.forEach((h, i) => {
            if (i === unlocked.length - 1) h.targetPercent = parseFloat((rem - dist).toFixed(2));
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
    ts.forEach((h, idx) => h.targetPercent = (idx === ts.length - 1) ? parseFloat((goal - share * (ts.length - 1)).toFixed(2)) : share);
    renderAssetList();
};

window.updateSectorTarget = (sector, val) => { sectorTargets[sector] = parseFloat(val) || 0; updateSectorUI(); updateCalculation(); };

// ==========================================
// 4. Main Rendering & Calculation
// ==========================================

function renderAssetList() {
    if (!assetListBody) return;
    
    // 전체 자산 합계 먼저 계산 (Actual % 표시용)
    const totalActualValue = holdings.reduce((sum, h) => sum + (parseFloat(h.qty || 0) * parseFloat(h.price || 0)), 0);

    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const actualVal = (parseFloat(item.qty || 0) * parseFloat(item.price || 0));
        const actualPct = totalActualValue > 0 ? (actualVal / totalActualValue * 100) : 0;
        const deviation = actualPct - (parseFloat(item.targetPercent) || 0);
        
        // 괴리율에 따른 색상 강조
        const actualColorClass = Math.abs(deviation) > 5 ? (deviation > 0 ? 'text-red-500' : 'text-blue-500') : 'text-slate-600 dark:text-slate-300';

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
            <td class="py-3 px-2 text-right font-black ${actualColorClass}">${actualPct.toFixed(1)}%</td>
            <td class="py-3 px-2"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right focus:outline-none font-bold text-blue-600" onchange="updateHolding(${index}, 'targetPercent', this.value)" ${item.locked ? 'readonly' : ''}></td>
            <td class="py-3 px-2 text-center"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500">✕</button></td>`;
        assetListBody.appendChild(tr);
    });
    updateCalculation();
}

window.updateHolding = (idx, field, val) => {
    holdings[idx][field] = (['qty', 'price', 'targetPercent'].includes(field)) ? parseFloat(val) || 0 : val;
    if (field === 'ticker') holdings[idx].sector = getMappedSector(val);
    if (!['targetPercent'].includes(field)) {
        renderAssetList(); // 실제 비중 재계산을 위해 리스트 갱신
    } else {
        updateCalculation();
    }
};

window.removeAsset = (idx) => { if(confirm('삭제하시겠습니까?')) { holdings.splice(idx, 1); renderAssetList(); } };

function updateCalculation() {
    let currentTotal = 0;
    const stats = PRIMARY_SECTORS.reduce((acc, s) => {
        const idMap = { "주식 (Equity)": "equity", "채권 (Fixed Income)": "bonds", "귀금속 (Precious Metals)": "gold", "원자재 (Commodity)": "commodity", "가상자산 (Digital Asset)": "crypto", "현금 (Liquidity)": "cash" };
        acc[s] = { current: 0, assigned: 0, goal: sectorTargets[s] || 0, key: idMap[s] };
        return acc;
    }, {});

    holdings.forEach(h => {
        const v = (parseFloat(h.qty) || 0) * (parseFloat(h.price) || 0); currentTotal += v;
        if (stats[h.sector]) { stats[h.sector].current += v; stats[h.sector].assigned += (parseFloat(h.targetPercent) || 0); }
    });

    if (totalValueDisplay) totalValueDisplay.innerText = `$${currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    const totTarg = holdings.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    if (totalPercentDisplay) totalPercentDisplay.innerHTML = `<span class="${Math.abs(totTarg - 100) < 0.1 ? 'text-emerald-500' : 'text-blue-500'} font-bold">목표 비중 합계: ${totTarg.toFixed(2)}%</span>`;

    // 섹터 대시보드 업데이트
    Object.keys(stats).forEach(n => {
        const s = stats[n]; const curP = currentTotal > 0 ? (s.current / currentTotal) * 100 : 0;
        const cp = document.getElementById(`current_${s.key}_pct`); if(cp) cp.innerText = `${curP.toFixed(1)}%`;
        const tp = document.getElementById(`target_${s.key}_pct_val`); if(tp) tp.innerText = `${s.goal}%`;
        const pr = document.getElementById(`progress_${s.key}_current`); if(pr) pr.style.width = `${Math.min(curP, s.goal)}%`;
        const gp = document.getElementById(`progress_${s.key}_gap`); if(gp) gp.style.width = `${Math.max(0, s.goal - curP)}%`;
    });

    // 리밸런싱 가이드 (현재 총 자산 vs 사용자가 입력한 목표 비중)
    const base = targetCapital > 0 ? targetCapital : currentTotal;
    if (actionPlanList) {
        actionPlanList.innerHTML = '';
        let bal = true;
        holdings.forEach(h => {
            const targetVal = base * ((parseFloat(h.targetPercent) || 0) / 100);
            const currentVal = (parseFloat(h.qty) || 0) * (parseFloat(h.price) || 0);
            const diff = targetVal - currentVal;
            if (Math.abs(diff) > Math.max(10, base * 0.01)) {
                bal = false;
                const d = document.createElement('div');
                d.className = `p-3 rounded-xl border flex justify-between items-center ${diff > 0 ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`;
                const shares = h.price > 0 ? Math.floor(Math.abs(diff) / h.price) : 0;
                d.innerHTML = `<div class="flex flex-col"><span class="font-bold">${h.ticker}</span><span class="text-[10px] opacity-60">${shares > 0 ? shares + '주' : '금액'} ${diff > 0 ? '매수' : '매도'}</span></div><span class="${diff > 0 ? 'text-red-600' : 'text-blue-600'} font-black">$${Math.abs(diff).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>`;
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
        data: { 
            labels: Object.keys(stats).map(s => s.split(' ')[0]), 
            datasets: [
                { label: '현재 비중 (Actual)', data: Object.values(stats).map(s => total > 0 ? (s.current / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 4 }, 
                { label: '목표 가이드 (Target)', data: Object.values(stats).map(s => s.goal), backgroundColor: 'rgba(16, 185, 129, 0.4)', borderRadius: 4 }
            ] 
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: col } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col } } } }
    });

    tickerChartInstance = new Chart(ctxT, {
        type: 'bar',
        data: { 
            labels: holdings.map(h => h.ticker), 
            datasets: [
                { label: '현재 (Actual)', data: holdings.map(h => total > 0 ? ((parseFloat(h.qty)*parseFloat(h.price)) / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(244, 63, 94, 0.8)', borderRadius: 4 }, 
                { label: '목표 (Target)', data: holdings.map(h => h.targetPercent), backgroundColor: 'rgba(16, 185, 129, 0.4)', borderRadius: 4 }
            ] 
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: col } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col } } } }
    });

    const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const presets = { aggressive: 0.12, balanced: 0.07, defensive: 0.04 };
    const rate = currentDochiStyle ? presets[currentDochiStyle] : 0.07;
    const startVal = total || 10000;
    simulationChartInstance = new Chart(ctxSim, {
        type: 'line',
        data: { labels: years.map(y => y + 'y'), datasets: [{ label: '자산 성장 예측', data: years.map(y => Math.round(startVal * Math.pow(1 + rate, y))), borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: col, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col } } } }
    });
}

// ==========================================
// 5. Auth & Persistence
// ==========================================

async function refreshAllPrices() {
    const valid = holdings.filter(h => h.ticker && h.ticker.trim() !== '' && !['CASH', 'USD', 'KRW', '현금'].includes(h.ticker.toUpperCase()));
    if (valid.length === 0) return;
    const btn = document.getElementById('refreshPricesBtn');
    if (btn) { btn.disabled = true; btn.innerText = "⏳..."; }
    for (const item of valid) {
        try {
            const data = await fetchInternalAPI('price', { ticker: item.ticker });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) { item.price = meta.regularMarketPrice || meta.chartPreviousClose || 0; item.name = meta.symbol; }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 100));
    }
    if (btn) { btn.disabled = false; btn.innerText = "🔄 시세 새로고침"; }
    renderAssetList();
}

async function performSearch(query) {
    const container = document.getElementById('searchResultsContainer');
    const list = document.getElementById('searchResults');
    if (!container || !list) return;
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

// ==========================================
// 6. Events & Init
// ==========================================

window.selectDochi = (type) => {
    currentDochiStyle = type;
    const p = { aggressive: [70, 10, 5, 5, 5, 5], balanced: [40, 40, 5, 5, 5, 5], defensive: [20, 50, 10, 0, 0, 20] }[type];
    const sNames = ["주식 (Equity)", "채권 (Fixed Income)", "귀금속 (Precious Metals)", "원자재 (Commodity)", "가상자산 (Digital Asset)", "현금 (Liquidity)"];
    sNames.forEach((s, i) => sectorTargets[s] = p[i]);
    updateSectorUI(); updateCalculation();
    alert(`[${type.toUpperCase()}] 가이드가 적용되었습니다.`);
};

document.getElementById('saveBtn')?.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
        const batch = writeBatch(db);
        batch.set(doc(db, "users", currentUser.uid), { uid: currentUser.uid, holdings, sectorTargets, targetCapital, lastUpdated: new Date() }, { merge: true });
        await batch.commit(); alert("저장 성공! 💾");
    } catch (e) { alert("저장 실패"); }
});

document.getElementById('addAssetBtn')?.addEventListener('click', () => { holdings.push({ ticker: "NEW", name: "", qty: 0, price: 0, targetPercent: 0, sector: "주식 (Equity)", locked: false }); renderAssetList(); });
if (document.getElementById('refreshPricesBtn')) document.getElementById('refreshPricesBtn').addEventListener('click', refreshAllPrices);
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
if (document.getElementById('csvFileInput')) {
    document.getElementById('csvFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const rows = event.target.result.split('\n').slice(1);
            rows.forEach(row => {
                const [t, q] = row.split(',').map(s => s?.trim());
                if (t && q) holdings.push({ ticker: t.toUpperCase(), name: t, qty: parseFloat(q), price: 0, targetPercent: 0, sector: getMappedSector(t), locked: false });
            });
            renderAssetList(); alert("CSV 로드 완료!");
        };
        reader.readAsText(file);
    });
}

// Initial Run
updateSectorUI();
renderAssetList();