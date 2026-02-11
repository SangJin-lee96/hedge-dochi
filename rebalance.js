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
// 1. STRATEGY CONFIGuration (Financial APS)
// ==========================================
const STRATEGY_CONFIG = {
    aggressive: {
        name: "공격도치",
        description: "베타(β) 가속 및 수익률 극대화형",
        weights: {
            "주식 (Equity)": 75,
            "가상자산 (Digital Asset)": 15,
            "원자재 (Commodity)": 5,
            "현금 (Liquidity)": 5,
            "채권 (Fixed Income)": 0,
            "귀금속 (Precious Metals)": 0
        }
    },
    balanced: {
        name: "중도도치",
        description: "샤프 지수 최적화 및 위험 분산형",
        weights: {
            "주식 (Equity)": 50,
            "채권 (Fixed Income)": 30,
            "귀금속 (Precious Metals)": 10,
            "원자재 (Commodity)": 5,
            "현금 (Liquidity)": 5,
            "가상자산 (Digital Asset)": 0
        }
    },
    defensive: {
        name: "수비도치",
        description: "변동성(σ) 제어 및 자산 방어형",
        weights: {
            "채권 (Fixed Income)": 60,
            "현금 (Liquidity)": 20,
            "귀금속 (Precious Metals)": 15,
            "주식 (Equity)": 5,
            "원자재 (Commodity)": 0,
            "가상자산 (Digital Asset)": 0
        }
    }
};

let currentUser = null;
let holdings = []; 
let selectedStrategyId = null; // 현재 선택된 전략 ID 저장
const PRIMARY_SECTORS = ["주식 (Equity)", "채권 (Fixed Income)", "귀금속 (Precious Metals)", "원자재 (Commodity)", "가상자산 (Digital Asset)", "현금 (Liquidity)"];
let sectorTargets = { ...STRATEGY_CONFIG.balanced.weights };
let targetCapital = 0;
let chartInstance = null, tickerChartInstance = null, simulationChartInstance = null;

// DOM
const assetListBody = document.getElementById('assetListBody');
const totalValueDisplay = document.getElementById('totalValueDisplay');
const totalPercentDisplay = document.getElementById('totalPercentDisplay');
const actionPlanList = document.getElementById('actionPlanList');
const targetCapitalInput = document.getElementById('targetCapitalInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfile = document.getElementById('userProfile');
const loginAlert = document.getElementById('loginAlert');
const appContent = document.getElementById('appContent');
const refreshPricesBtn = document.getElementById('refreshPricesBtn');

// ==========================================
// 2. Logic & Precision Engine
// ==========================================

function getMappedSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (t === 'GLD' || t === 'IAU' || t === 'SLV' || t === 'SIL' || t === '금' || t === '은') return "귀금속 (Precious Metals)";
    if (t === 'BTC-USD' || t === 'ETH-USD' || t === 'BTC' || t === 'ETH' || quoteType === 'CRYPTOCURRENCY') return "가상자산 (Digital Asset)";
    if (t === 'USD' || t === 'KRW' || t === 'CASH' || t === 'BIL' || t === 'SGOV' || t === '현금') return "현금 (Liquidity)";
    if (t === 'TLT' || t === 'IEF' || t === 'SHY' || t === 'BND' || t === 'AGG' || yahooSector.includes("Bonds") || yahooSector.includes("Treasury")) return "채권 (Fixed Income)";
    if (t === 'USO' || t === 'DBC' || t === 'GSG' || t === 'CPER' || yahooSector.includes("Commodit")) return "원자재 (Commodity)";
    return "주식 (Equity)";
}

window.updateTargetFromProfile = (profileId) => {
    const strategy = STRATEGY_CONFIG[profileId];
    if (!strategy) return;
    sectorTargets = { ...strategy.weights };
    updateSectorUI();
    PRIMARY_SECTORS.forEach(sectorName => {
        const sectorHoldings = holdings.filter(h => h.sector === sectorName);
        if (sectorHoldings.length === 0) return;
        const sectorTargetWeight = strategy.weights[sectorName] || 0;
        const lockedAssets = sectorHoldings.filter(h => h.locked);
        const unlockedAssets = sectorHoldings.filter(h => !h.locked);
        const lockedSum = lockedAssets.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
        let availableForUnlocked = Math.max(0, sectorTargetWeight - lockedSum);
        if (unlockedAssets.length > 0) {
            const share = parseFloat((availableForUnlocked / unlockedAssets.length).toFixed(2));
            let distributed = 0;
            unlockedAssets.forEach((h, idx) => {
                if (idx === unlockedAssets.length - 1) {
                    h.targetPercent = parseFloat((availableForUnlocked - distributed).toFixed(2));
                } else {
                    h.targetPercent = share;
                    distributed += share;
                }
            });
        }
    });
    renderAssetList();
};

window.selectDochi = (type, skipAlert = false) => {
    selectedStrategyId = type; // 상태 업데이트
    const cards = document.querySelectorAll('.strategy-card');
    const ringColors = { aggressive: 'ring-rose-500', balanced: 'ring-blue-500', defensive: 'ring-emerald-500' };
    
    cards.forEach(card => {
        card.classList.remove('ring-4', 'ring-rose-500', 'ring-blue-500', 'ring-emerald-500', 'opacity-100', 'scale-105');
        card.classList.add('opacity-60', 'scale-100');
    });
    
    const selectedCard = document.getElementById(`card-${type}`);
    if (selectedCard) {
        selectedCard.classList.remove('opacity-60', 'scale-100');
        selectedCard.classList.add('opacity-100', 'ring-4', ringColors[type], 'scale-105');
    }
    
    // 비중 업데이트 로직 실행
    updateTargetFromProfile(type);
    
    if (!skipAlert) {
        const strategy = STRATEGY_CONFIG[type];
        // alert(`[${strategy.name}] 전략이 적용되었습니다.\n${strategy.description}`);
    }
};

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
// 3. UI Actions
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

async function refreshAllPrices() {
    const valid = holdings.filter(h => h.ticker && h.ticker.trim() !== '' && !['CASH', 'USD', 'KRW', '현금'].includes(h.ticker.toUpperCase()));
    if (valid.length === 0) return;
    
    if (refreshPricesBtn) {
        refreshPricesBtn.disabled = true;
        refreshPricesBtn.innerText = "⏳ 갱신 중...";
    }

    for (const item of valid) {
        try {
            const data = await fetchInternalAPI('price', { ticker: item.ticker.toUpperCase() });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
                item.price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
                if (!item.name || item.name === "") item.name = meta.shortName || meta.symbol;
            }
        } catch (e) { console.error(`Refresh error for ${item.ticker}:`, e); }
        await new Promise(r => setTimeout(r, 100)); // Rate limiting
    }

    if (refreshPricesBtn) {
        refreshPricesBtn.disabled = false;
        refreshPricesBtn.innerText = "🔄 시세 새로고침";
    }
    renderAssetList();
}

// ==========================================
// 4. Main Rendering & Calculation
// ==========================================

function updateSectorUI() {
    const idMap = { 
        "주식 (Equity)": "target_equity", 
        "채권 (Fixed Income)": "target_bonds", 
        "귀금속 (Precious Metals)": "target_gold",
        "원자재 (Commodity)": "target_commodity", 
        "가상자산 (Digital Asset)": "target_crypto", 
        "현금 (Liquidity)": "target_cash" 
    };
    Object.keys(idMap).forEach(s => {
        const el = document.getElementById(idMap[s]);
        if (el) el.value = sectorTargets[s] || 0;
    });
    const totalGoal = Object.values(sectorTargets).reduce((a, b) => a + b, 0);
    const status = document.getElementById('sectorTotalStatus');
    if (status) {
        status.innerText = `Goal: ${totalGoal.toFixed(1)}%`;
        status.className = `text-sm font-bold px-3 py-1 rounded-full ${Math.abs(totalGoal - 100) < 0.1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`;
    }
}

function renderAssetList() {
    if (!assetListBody) return;
    const totalActualValue = holdings.reduce((sum, h) => sum + (parseFloat(h.qty || 0) * parseFloat(h.price || 0)), 0);
    assetListBody.innerHTML = '';
    holdings.forEach((item, index) => {
        const actualVal = (parseFloat(item.qty || 0) * parseFloat(item.price || 0));
        const actualPct = totalActualValue > 0 ? (actualVal / totalActualValue * 100) : 0;
        const targetPct = parseFloat(item.targetPercent) || 0;
        const diff = actualPct - targetPct;
        
        const threshold = 1.0;
        let colorClass = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
        if (diff > threshold) colorClass = 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20';
        else if (diff < -threshold) colorClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';

        const tr = document.createElement('tr');
        tr.className = `border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${item.locked ? 'bg-indigo-50/10' : ''}`;
        tr.innerHTML = `
            <td class="py-3 px-2 text-center align-middle"><button onclick="toggleLock(${index})" class="text-lg">${item.locked ? '🔒' : '🔓'}</button></td>
            <td class="py-3 px-2">
                <div class="flex flex-col min-w-0">
                    <span class="font-bold text-slate-800 dark:text-white truncate text-sm" title="${item.name || item.ticker}">${item.name || item.ticker}</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <input type="text" value="${item.ticker}" class="text-[10px] bg-transparent text-slate-400 font-semibold uppercase focus:outline-none w-14 hover:text-blue-500 transition-colors" onchange="updateHolding(${index}, 'ticker', this.value)">
                        <span class="text-[10px] text-slate-300">|</span>
                        <select class="text-[10px] bg-transparent text-indigo-500 font-bold outline-none border-none p-0 cursor-pointer" onchange="updateHolding(${index}, 'sector', this.value)">
                            ${PRIMARY_SECTORS.map(s => `<option value="${s}" ${item.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </td>
            <td class="py-3 px-2"><input type="number" value="${item.qty}" class="w-full bg-transparent text-right focus:outline-none font-medium" onchange="updateHolding(${index}, 'qty', this.value)"></td>
            <td class="py-3 px-2"><input type="number" value="${item.price}" class="w-full bg-transparent text-right focus:outline-none font-medium" onchange="updateHolding(${index}, 'price', this.value)"></td>
            <td class="py-3 px-2 text-right"><div class="inline-block px-2 py-1 rounded-lg font-black ${colorClass}">${actualPct.toFixed(1)}%</div></td>
            <td class="py-3 px-2"><input type="number" value="${item.targetPercent}" class="w-full bg-transparent text-right focus:outline-none font-bold text-blue-600" onchange="updateHolding(${index}, 'targetPercent', this.value)" ${item.locked ? 'readonly' : ''}></td>
            <td class="py-3 px-2 text-center"><button onclick="removeAsset(${index})" class="text-slate-300 hover:text-red-500">✕</button></td>`;
        assetListBody.appendChild(tr);
    });
    updateCalculation();
}

window.updateHolding = async (idx, field, val) => {
    holdings[idx][field] = (['qty', 'price', 'targetPercent'].includes(field)) ? parseFloat(val) || 0 : val;
    if (field === 'ticker' && val.length >= 1) {
        try {
            const data = await fetchInternalAPI('price', { ticker: val.toUpperCase() });
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
                holdings[idx].name = meta.shortName || meta.symbol;
                holdings[idx].price = meta.regularMarketPrice || meta.chartPreviousClose || 0;
                holdings[idx].sector = getMappedSector(val);
            }
        } catch (e) { holdings[idx].sector = getMappedSector(val); }
    }
    if (!['targetPercent'].includes(field)) renderAssetList(); else updateCalculation();
};

window.removeAsset = (idx) => { if(confirm('삭제하시겠습니까?')) { holdings.splice(idx, 1); renderAssetList(); } };

function updateCalculation() {
    let currentTotal = 0;
    holdings.forEach(h => { currentTotal += (parseFloat(h.qty) || 0) * (parseFloat(h.price) || 0); });

    const stats = PRIMARY_SECTORS.reduce((acc, s) => {
        const idMap = { "주식 (Equity)": "equity", "채권 (Fixed Income)": "bonds", "귀금속 (Precious Metals)": "gold", "원자재 (Commodity)": "commodity", "가상자산 (Digital Asset)": "crypto", "현금 (Liquidity)": "cash" };
        acc[s] = { current: 0, assigned: 0, goal: sectorTargets[s] || 0, key: idMap[s] };
        return acc;
    }, {});

    holdings.forEach(h => {
        const v = (parseFloat(h.qty) || 0) * (parseFloat(h.price) || 0);
        if (stats[h.sector]) { stats[h.sector].current += v; stats[h.sector].assigned += (parseFloat(h.targetPercent) || 0); }
    });

    if (totalValueDisplay) totalValueDisplay.innerText = `$${currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    const totTarg = holdings.reduce((s, h) => s + (parseFloat(h.targetPercent) || 0), 0);
    if (totalPercentDisplay) totalPercentDisplay.innerHTML = `<span class="${Math.abs(totTarg - 100) < 0.1 ? 'text-emerald-500' : 'text-blue-500'} font-bold">목표 비중 합계: ${totTarg.toFixed(2)}%</span>`;

    Object.keys(stats).forEach(n => {
        const s = stats[n]; const curP = currentTotal > 0 ? (s.current / currentTotal) * 100 : 0;
        const cp = document.getElementById(`current_${s.key}_pct`); if(cp) cp.innerText = `${curP.toFixed(1)}%`;
        const tp = document.getElementById(`target_${s.key}_pct_val`); if(tp) tp.innerText = `${s.goal}%`;
        const pr = document.getElementById(`progress_${s.key}_current`); 
        if(pr) {
            pr.style.width = `${Math.min(curP, s.goal)}%`;
            pr.className = `h-full transition-all duration-500 ${curP > s.goal + 1 ? 'bg-rose-500' : (curP < s.goal - 1 ? 'bg-blue-500' : 'bg-emerald-500')}`;
        }
        const gp = document.getElementById(`progress_${s.key}_gap`); if(gp) gp.style.width = `${Math.max(0, s.goal - curP)}%`;
    });

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
                const isBuy = diff > 0;
                const actionText = isBuy ? "매수" : "매도";
                const badgeColor = isBuy ? "bg-rose-600" : "bg-blue-600";
                const cardBg = isBuy ? "bg-rose-50 dark:bg-rose-900/10" : "bg-blue-50 dark:bg-blue-900/10";
                const cardBorder = isBuy ? "border-rose-100 dark:border-rose-800" : "border-blue-100 dark:border-blue-800";
                const textColor = isBuy ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400";
                const d = document.createElement('div');
                d.className = `p-4 rounded-2xl border ${cardBg} ${cardBorder} flex justify-between items-center gap-2 transition-all hover:scale-[1.02] shadow-sm`;
                const shares = h.price > 0 ? Math.floor(Math.abs(diff) / h.price) : 0;
                d.innerHTML = `
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="${badgeColor} text-white text-[10px] font-black px-2 py-1 rounded-md shadow-md flex-shrink-0">${actionText}</div>
                        <div class="flex flex-col min-w-0">
                            <span class="font-bold text-slate-800 dark:text-white text-sm md:text-base truncate" title="${h.name || h.ticker}">${h.name || h.ticker}</span>
                            <span class="text-[10px] md:text-xs font-bold opacity-70 ${textColor} truncate">${shares > 0 ? '약 ' + shares + '주 ' + actionText : actionText + ' 필요'}</span>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-0.5">필요 금액</p>
                        <span class="${textColor} font-black text-lg md:text-xl">$${Math.abs(diff).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>`;
                actionPlanList.appendChild(d);
            }
        });
        if (bal) actionPlanList.innerHTML = '<div class="text-center py-12 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-800/30"><span class="text-4xl mb-4 block">🏆</span><p class="text-emerald-700 dark:text-emerald-400 font-bold">포트폴리오가 완벽하게 정렬되었습니다!</p></div>';
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
        data: { labels: Object.keys(stats).map(s => s.split(' ')[0]), datasets: [{ label: 'Actual', data: Object.values(stats).map(s => total > 0 ? (s.current / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 8 }, { label: 'Target', data: Object.values(stats).map(s => s.goal), backgroundColor: 'rgba(16, 185, 129, 0.4)', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: col } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col, font: { weight: 'bold' } } } } }
    });
    tickerChartInstance = new Chart(ctxT, {
        type: 'bar',
        data: { labels: holdings.map(h => h.ticker), datasets: [{ label: 'Actual', data: holdings.map(h => total > 0 ? ((parseFloat(h.qty)*parseFloat(h.price)) / total * 100).toFixed(1) : 0), backgroundColor: 'rgba(244, 63, 94, 0.8)', borderRadius: 8 }, { label: 'Target', data: holdings.map(h => h.targetPercent), backgroundColor: 'rgba(16, 185, 129, 0.4)', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { color: col } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col, font: { weight: 'bold' } } } } }
    });
    const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rate = 0.07; const startVal = total || 10000;
    simulationChartInstance = new Chart(ctxSim, {
        type: 'line',
        data: { labels: years.map(y => y + 'y'), datasets: [{ label: '성장 예측', data: years.map(y => Math.round(startVal * Math.pow(1 + rate, y))), borderColor: '#10b981', borderWidth: 3, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: col, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } }, x: { ticks: { color: col } } }, plugins: { legend: { labels: { color: col, font: { weight: 'bold' } } } } }
    });
}

// ==========================================
// 5. Auth & API
// ==========================================

async function fetchInternalAPI(endpoint, params) {
    const response = await fetch(`/api/${endpoint}?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error("API Error");
    return await response.json();
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const authContainerMobile = document.getElementById('authContainerMobile');
    
    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userProfile) userProfile.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        if (loginAlert) loginAlert.classList.add('hidden');
        if (appContent) { appContent.classList.remove('hidden'); appContent.classList.add('grid'); }
        
        // Handle Mobile Auth UI
        if (authContainerMobile) {
            authContainerMobile.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${user.photoURL}" class="w-10 h-10 rounded-full border border-slate-200">
                        <span class="font-bold text-slate-800 dark:text-white">${user.displayName || '사용자'}</span>
                    </div>
                    <button id="logoutBtnMobile" class="text-sm text-red-500 font-bold">로그아웃</button>
                </div>
            `;
            document.getElementById('logoutBtnMobile').addEventListener('click', () => signOut(auth).then(() => location.reload()));
        }

        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists()) {
                const data = migrateData(docSnap.data());
                if (data.holdings) holdings = data.holdings;
                if (data.sectorTargets) sectorTargets = data.sectorTargets;
                if (data.targetCapital && targetCapitalInput) { targetCapital = parseFloat(data.targetCapital) || 0; targetCapitalInput.value = targetCapital; }
                if (data.selectedStrategyId) { 
                    selectedStrategyId = data.selectedStrategyId; 
                    // 로드 완료 후 카드 UI 복구 (비중 업데이트는 제외하고 UI만)
                    setTimeout(() => selectDochi(selectedStrategyId, true), 100); 
                }
            }
        } catch (e) { console.error("Load Error:", e); }
        updateSectorUI(); renderAssetList();
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userProfile) userProfile.classList.add('hidden');
        if (loginAlert) loginAlert.classList.remove('hidden');
        if (appContent) appContent.classList.add('hidden');
        
        if (authContainerMobile) {
            authContainerMobile.innerHTML = `
                <button onclick="document.getElementById('loginBtn').click()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">구글 로그인</button>
            `;
        }
    }
});

// ==========================================
// 6. Events & Init
// ==========================================

if (loginBtn) { loginBtn.addEventListener('click', async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error("Login Error:", e); } }); }
if (logoutBtn) { logoutBtn.addEventListener('click', async () => { try { await signOut(auth); location.reload(); } catch (e) { console.error("Logout Error:", e); } }); }

document.getElementById('saveBtn')?.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
        const batch = writeBatch(db);
        batch.set(doc(db, "users", currentUser.uid), { 
            uid: currentUser.uid, 
            holdings, 
            sectorTargets, 
            targetCapital, 
            selectedStrategyId, // 현재 전략 ID 추가 저장
            lastUpdated: new Date() 
        }, { merge: true });
        await batch.commit(); alert("저장 성공! 💾");
    } catch (e) { alert("저장 실패"); }
});

document.getElementById('addAssetBtn')?.addEventListener('click', () => { holdings.push({ ticker: "NEW", name: "", qty: 0, price: 0, targetPercent: 0, sector: "주식 (Equity)", locked: false }); renderAssetList(); });
if (refreshPricesBtn) refreshPricesBtn.addEventListener('click', refreshAllPrices);
if (targetCapitalInput) targetCapitalInput.addEventListener('input', (e) => { targetCapital = parseFloat(e.target.value) || 0; updateCalculation(); });
if (document.getElementById('tickerSearchInput')) {
    let timer = null;
    document.getElementById('tickerSearchInput').addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (timer) clearTimeout(timer);
        if (q.length < 2) { document.getElementById('searchResultsContainer')?.classList.add('hidden'); return; }
        timer = setTimeout(() => performSearch(q), 500);
    });
}

// Initial Run
updateSectorUI();
renderAssetList();
