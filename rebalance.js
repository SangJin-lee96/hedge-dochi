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

const EXCHANGE_PRESETS = {
    KR: { name: "한국", fee: 0.00015, tax: 0.0015 },
    US: { name: "미국", fee: 0.001, tax: 0.0000229 },
    CRYPTO: { name: "가상자산", fee: 0.0005, tax: 0.22 }
};

const STRATEGY_CONFIG = {
    aggressive: {
        name: "공격도치",
        weights: { "주식 (Equity)": 75, "가상자산 (Digital Asset)": 15, "원자재 (Commodity)": 5, "현금 (Liquidity)": 5, "채권 (Fixed Income)": 0, "귀금속 (Precious Metals)": 0 }
    },
    balanced: {
        name: "중도도치",
        weights: { "주식 (Equity)": 50, "채권 (Fixed Income)": 30, "귀금속 (Precious Metals)": 10, "원자재 (Commodity)": 5, "현금 (Liquidity)": 5, "가상자산 (Digital Asset)": 0 }
    },
    defensive: {
        name: "수비도치",
        weights: { "채권 (Fixed Income)": 60, "현금 (Liquidity)": 20, "귀금속 (Precious Metals)": 15, "주식 (Equity)": 5, "원자재 (Commodity)": 0, "가상자산 (Digital Asset)": 0 }
    }
};

const PRIMARY_SECTORS = ["주식 (Equity)", "채권 (Fixed Income)", "귀금속 (Precious Metals)", "원자재 (Commodity)", "가상자산 (Digital Asset)", "현금 (Liquidity)"];

// --- State ---
let holdings = [];
let sectorTargets = { ...STRATEGY_CONFIG.balanced.weights };
let selectedStrategyId = null;
let currentStep = 1;
let currentUser = null;
let chartInstance = null, simulationChartInstance = null;

// --- DOM Elements ---
const assetListBody = document.getElementById('assetListBody');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const appContent = document.getElementById('appContent');
const loginAlert = document.getElementById('loginAlert');

// --- Wizard Navigation ---
window.goToStep = function(step) {
    if (step === 2 && !selectedStrategyId) {
        alert("먼저 투자 성향을 선택해주세요!");
        return;
    }

    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    const targetSection = document.getElementById(`step-${step}`);
    if (targetSection) targetSection.classList.remove('hidden');

    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        if (idx + 1 <= step) {
            dot.classList.remove('bg-slate-200');
            dot.classList.add('bg-blue-600');
        } else {
            dot.classList.remove('bg-blue-600');
            dot.classList.add('bg-slate-200');
        }
    });

    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Step 1: Strategy Selection ---
window.selectDochi = function(type, skipTransition = false) {
    selectedStrategyId = type;
    
    document.querySelectorAll('.strategy-card').forEach(card => {
        card.classList.remove('border-rose-500', 'border-blue-500', 'border-emerald-500', 'ring-4', 'ring-opacity-20');
        card.classList.add('border-transparent');
    });

    const selectedCard = document.getElementById(`card-${type}`);
    const colorClass = type === 'aggressive' ? 'border-rose-500' : type === 'balanced' ? 'border-blue-500' : 'border-emerald-500';
    const ringClass = type === 'aggressive' ? 'ring-rose-500' : type === 'balanced' ? 'ring-blue-500' : 'ring-emerald-500';
    
    if (selectedCard) {
        selectedCard.classList.remove('border-transparent');
        selectedCard.classList.add(colorClass, 'ring-4', ringClass, 'ring-opacity-20');
    }

    sectorTargets = { ...STRATEGY_CONFIG[type].weights };
    
    const badge = document.getElementById('finalPropensityBadge');
    if (badge) {
        const icons = { aggressive: "🦔🔥", balanced: "🦔⚖️", defensive: "🦔🛡️" };
        badge.innerText = `${icons[type]} ${STRATEGY_CONFIG[type].name}`;
    }

    document.getElementById('nextToStep2')?.classList.remove('hidden');
    if (!skipTransition) {
        // Optional: auto-scroll to button
    }
};

// --- Step 4: Show Result ---
window.calculateAndShowResult = function() {
    updateCalculation();
    goToStep(4);
};

// --- Core Logic ---
function updateCalculation() {
    const currentTotal = holdings.reduce((sum, h) => sum + (parseFloat(h.qty) * parseFloat(h.price) || 0), 0);
    const targetCapital = parseFloat(document.getElementById('targetCapitalInputWizard').value) || currentTotal;

    // UI Summary
    document.getElementById('totalValueDisplay').innerText = `$${currentTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('targetCapitalDisplay').innerText = `$${targetCapital.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    renderSectorDashboard(currentTotal, targetCapital);
    renderActionPlan(currentTotal, targetCapital);
    updateCharts(currentTotal, targetCapital);
}

function renderAssetList() {
    if (!assetListBody) return;
    assetListBody.innerHTML = '';
    const emptyMsg = document.getElementById('emptyAssetMsg');
    
    if (holdings.length === 0) {
        emptyMsg?.classList.remove('hidden');
    } else {
        emptyMsg?.classList.add('hidden');
    }

    holdings.forEach((h, idx) => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";
        tr.innerHTML = `
            <td class="py-4 px-2">
                <div class="font-bold text-slate-800 dark:text-white">${h.ticker}</div>
                <div class="text-[10px] text-slate-400 uppercase">${h.sector}</div>
            </td>
            <td class="py-4 px-2 text-right">
                <input type="number" value="${h.qty}" class="w-20 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-right font-mono font-bold" onchange="updateHolding(${idx}, 'qty', this.value)">
            </td>
            <td class="py-4 px-2 text-right font-mono text-slate-500">$${parseFloat(h.price).toLocaleString()}</td>
            <td class="py-4 px-2 text-center">
                <button onclick="removeAsset(${idx})" class="text-slate-300 hover:text-red-500 transition-colors text-lg">✕</button>
            </td>
        `;
        assetListBody.appendChild(tr);
    });
}

window.updateHolding = function(idx, field, val) {
    holdings[idx][field] = parseFloat(val) || 0;
    renderAssetList();
};

window.removeAsset = function(idx) {
    holdings.splice(idx, 1);
    renderAssetList();
};

function renderSectorDashboard(currentTotal, targetCapital) {
    const dashboard = document.getElementById('sectorDashboard');
    if (!dashboard) return;
    dashboard.innerHTML = '';

    const stats = PRIMARY_SECTORS.map(sector => {
        const actualVal = holdings.filter(h => h.sector === sector).reduce((s, h) => s + (h.qty * h.price || 0), 0);
        const actualPct = currentTotal > 0 ? (actualVal / currentTotal * 100) : 0;
        const targetPct = sectorTargets[sector] || 0;
        return { sector, actualPct, targetPct };
    });

    stats.forEach(s => {
        const div = document.createElement('div');
        div.className = "space-y-2";
        const color = s.actualPct > s.targetPct + 1 ? 'bg-rose-500' : (s.actualPct < s.targetPct - 1 ? 'bg-blue-500' : 'bg-emerald-500');
        div.innerHTML = `
            <div class="flex justify-between items-end">
                <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${s.sector.split(' ')[0]}</span>
                <span class="text-[10px] font-mono font-bold text-slate-400">Tgt: ${s.targetPct}%</span>
            </div>
            <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div class="h-full ${color} transition-all duration-700" style="width: ${s.actualPct}%"></div>
            </div>
            <div class="flex justify-between text-[10px] font-bold">
                <span class="text-slate-400">Act: ${s.actualPct.toFixed(1)}%</span>
                <span class="${s.actualPct < s.targetPct ? 'text-blue-500' : 'text-rose-500'}">${(s.actualPct - s.targetPct).toFixed(1)}%</span>
            </div>
        `;
        dashboard.appendChild(div);
    });
}

function renderActionPlan(currentTotal, targetCapital) {
    const list = document.getElementById('actionPlanList');
    if (!list) return;
    list.innerHTML = '';

    let hasAction = false;
    const isIntegerMode = document.getElementById('integerModeToggle').checked;

    holdings.forEach(h => {
        // 간단 리밸런싱 로직: 섹터 타겟 내에서 종목별 균등 배분 가정 (고도화 가능)
        const sectorHoldings = holdings.filter(item => item.sector === h.sector);
        const sectorTargetPct = sectorTargets[h.sector] || 0;
        const targetPctPerAsset = sectorTargetPct / sectorHoldings.length;
        
        const targetVal = targetCapital * (targetPctPerAsset / 100);
        const currentVal = h.qty * h.price;
        const diffVal = targetVal - currentVal;

        if (Math.abs(diffVal) > (targetCapital * 0.01) || Math.abs(diffVal) > 10) {
            hasAction = true;
            const isBuy = diffVal > 0;
            const qtyDiff = h.price > 0 ? (isBuy ? Math.floor(diffVal / h.price) : Math.ceil(Math.abs(diffVal) / h.price)) : 0;
            
            if (qtyDiff === 0) return;

            const div = document.createElement('div');
            div.className = `p-4 rounded-2xl border ${isBuy ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800'} flex justify-between items-center`;
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="${isBuy ? 'bg-rose-600' : 'bg-blue-600'} text-white text-[10px] font-black px-2 py-1 rounded-lg">${isBuy ? '매수' : '매도'}</div>
                    <div>
                        <div class="font-bold text-sm">${h.name || h.ticker}</div>
                        <div class="text-xs ${isBuy ? 'text-rose-600' : 'text-blue-600'} font-bold">${qtyDiff}주 ${isBuy ? '추가 매수' : '처분'}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] text-slate-400 font-bold uppercase">예상 금액</div>
                    <div class="font-mono font-black text-lg">$${Math.abs(diffVal).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                </div>
            `;
            list.appendChild(div);
        }
    });

    if (!hasAction) {
        list.innerHTML = '<div class="text-center py-10 text-slate-400 font-bold">이미 최적의 비중을 유지하고 있습니다! 🏆</div>';
    }
}

function updateCharts(currentTotal, targetCapital) {
    const ctxP = document.getElementById('portfolioChart')?.getContext('2d');
    const ctxS = document.getElementById('simulationChart')?.getContext('2d');
    
    if (chartInstance) chartInstance.destroy();
    if (simulationChartInstance) simulationChartInstance.destroy();

    const sectorData = PRIMARY_SECTORS.map(s => {
        return holdings.filter(h => h.sector === s).reduce((sum, h) => sum + (h.qty * h.price || 0), 0);
    });

    chartInstance = new Chart(ctxP, {
        type: 'doughnut',
        data: {
            labels: PRIMARY_SECTORS.map(s => s.split(' ')[0]),
            datasets: [{
                data: sectorData,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#64748b'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } } } }
    });

    const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rate = 0.08; 
    simulationChartInstance = new Chart(ctxS, {
        type: 'line',
        data: {
            labels: years.map(y => y + 'y'),
            datasets: [{
                label: '예상 성장',
                data: years.map(y => targetCapital * Math.pow(1 + rate, y)),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { display: false }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

// --- Search Implementation ---
async function performSearch(query) {
    const container = document.getElementById('searchResultsContainer');
    const list = document.getElementById('searchResults');
    if (!container || !list) return;
    
    container.classList.remove('hidden');
    list.innerHTML = '<li class="text-center py-4 text-slate-400 text-sm">검색 중...</li>';
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        const quotes = data.quotes || [];
        
        list.innerHTML = quotes.length ? '' : '<li class="text-center py-4 text-slate-400 text-sm">결과 없음</li>';
        
        quotes.forEach(quote => {
            if (!quote.symbol) return;
            const li = document.createElement('li');
            li.className = "p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-200 flex justify-between items-center";
            li.innerHTML = `
                <div class="min-w-0 pr-4">
                    <div class="font-bold text-blue-600 dark:text-blue-400 truncate">${quote.symbol}</div>
                    <div class="text-xs text-slate-500 truncate">${quote.shortname || quote.symbol}</div>
                </div>
                <button class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">추가</button>
            `;
            li.onclick = async () => {
                const priceRes = await fetch(`/api/price?ticker=${quote.symbol}`);
                const priceData = await priceRes.json();
                const price = priceData?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
                
                holdings.push({
                    ticker: quote.symbol,
                    name: quote.shortname || quote.symbol,
                    qty: 0,
                    price: price,
                    sector: getMappedSector(quote.symbol, quote.quoteType, quote.sector)
                });
                
                document.getElementById('tickerSearchInput').value = '';
                container.classList.add('hidden');
                renderAssetList();
            };
            list.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

function getMappedSector(ticker, quoteType = "", yahooSector = "") {
    const t = ticker.toUpperCase();
    if (['GLD', 'IAU', 'SLV', '금', '은'].includes(t)) return "귀금속 (Precious Metals)";
    if (quoteType === 'CRYPTOCURRENCY') return "가상자산 (Digital Asset)";
    if (['TLT', 'IEF', 'SHY', 'BND', 'AGG'].includes(t) || yahooSector.includes("Bonds")) return "채권 (Fixed Income)";
    if (['USO', 'DBC', 'GSG'].includes(t)) return "원자재 (Commodity)";
    if (['CASH', 'USD', 'KRW', 'BIL', 'SGOV'].includes(t)) return "현금 (Liquidity)";
    return "주식 (Equity)";
}

// --- Auth & Init ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        loginAlert.classList.add('hidden');
        appContent.classList.remove('hidden');
        // Load data from DB if needed
        renderAssetList();
    } else {
        loginAlert.classList.remove('hidden');
        appContent.classList.add('hidden');
    }
});

loginBtn.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
logoutBtn.addEventListener('click', () => signOut(auth).then(() => location.reload()));

document.getElementById('tickerSearchInput')?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length >= 2) performSearch(q);
});

// Start at step 1
goToStep(1);
