// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgGZuf6q4rxNWmR7SOOLtRu-KPfwJJ9tQ",
    authDomain: "hedge-dochi.firebaseapp.com",
    projectId: "hedge-dochi",
    storageBucket: "hedge-dochi.firebasestorage.app",
    messagingSenderId: "157519209721",
    appId: "1:157519209721:web:d1f196e41dcd579a286e28",
    measurementId: "G-7Y0G1CVXBR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State Management ---
let currentStep = 1;
let wealthChart = null;
let baseCurrency = 'KRW';
let exchangeRate = 1350;
let currentUser = null;

// --- Wizard Navigation ---
window.goToStep = async function(step) {
    if (step === 3 || step === 4) {
        try {
            const res = await fetch('/api/price?ticker=USDKRW=X');
            const data = await res.json();
            const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (rate) {
                const input = document.getElementById('manualExchangeRate');
                if (input && step === 3 && !input.value) input.value = Math.round(rate);
                exchangeRate = rate;
            }
        } catch (e) { console.error("환율 로드 실패", e); }
    }

    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
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

window.resetToLiveExchangeRate = function() {
    const input = document.getElementById('manualExchangeRate');
    if (input) {
        input.value = Math.round(exchangeRate);
        showToast("실시간 환율이 적용되었습니다. 🔄");
        updateCalculation();
    }
};

// --- Currency Management ---
window.setCurrency = function(code) {
    baseCurrency = code;
    const isUSD = code === 'USD';
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-currency-usd');
    const btnKrw = document.getElementById('btn-currency-krw');
    const labels = document.querySelectorAll('.currency-label');

    if (isUSD) {
        if (glider) glider.style.left = '4px';
        btnUsd?.classList.add('text-blue-600');
        btnKrw?.classList.add('text-slate-400');
        labels.forEach(l => l.innerText = 'USD');
    } else {
        if (glider) glider.style.left = '50%';
        btnKrw?.classList.add('text-blue-600');
        btnUsd?.classList.add('text-slate-400');
        labels.forEach(l => l.innerText = '만원');
    }
};

function formatValue(val) {
    if (baseCurrency === 'KRW') {
        if (val >= 10000) return (val / 10000).toFixed(1) + '억';
        return Math.round(val).toLocaleString() + '만';
    } else {
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
        if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'K';
        return '$' + Math.round(val).toLocaleString();
    }
}

// --- Final Calculation ---
window.calculateAndShowResult = function() {
    updateCalculation();
    goToStep(4);
    saveDataToFirebase();
};

function updateCalculation() {
    const manualRate = parseFloat(document.getElementById('manualExchangeRate')?.value) || exchangeRate;
    const rateForCalc = manualRate; 

    const annualSalary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const initialSeed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const monthlyExpense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const salaryGrowth = (parseFloat(document.getElementById('salaryGrowth').value) || 0) / 100;
    const investmentReturn = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflationRate = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = initialSeed;
    let currentWealthCons = initialSeed;
    let currentWealthOpt = initialSeed;
    
    let curSalary = annualSalary;
    let curExpense = monthlyExpense;
    
    const yearlyData = [initialSeed];
    const yearlyDataCons = [initialSeed];
    const yearlyDataOpt = [initialSeed];
    const realYearlyData = [initialSeed];
    const tableData = [];

    for (let year = 1; year <= 10; year++) {
        const surplus = curSalary - (curExpense * 12);
        
        const profit = (currentWealth + surplus / 2) * investmentReturn;
        currentWealth = currentWealth + surplus + profit;
        
        currentWealthCons = currentWealthCons + surplus + ((currentWealthCons + surplus / 2) * Math.max(0, investmentReturn - 0.02));
        currentWealthOpt = currentWealthOpt + surplus + ((currentWealthOpt + surplus / 2) * (investmentReturn + 0.02));
        
        tableData.push({ year, salary: curSalary, profit: profit, total: currentWealth });

        curSalary *= (1 + salaryGrowth);
        curExpense *= (1 + inflationRate);
        
        yearlyData.push(Math.round(currentWealth));
        yearlyDataCons.push(Math.round(currentWealthCons));
        yearlyDataOpt.push(Math.round(currentWealthOpt));
        
        const realVal = currentWealth / Math.pow(1 + (baseCurrency === 'KRW' ? inflationRate : 0.03), year);
        realYearlyData.push(Math.round(realVal));
    }

    document.getElementById('finalWealthText').innerText = formatValue(yearlyData[10]);
    document.getElementById('realValueText').innerText = formatValue(realYearlyData[10]);
    document.getElementById('netSavingsText').innerText = formatValue(Math.round((annualSalary - (monthlyExpense * 12)) / 12)).replace('$', '');

    renderYearlyTable(tableData);
    updateWealthTier(realYearlyData[10], rateForCalc);
    renderChart(yearlyData, realYearlyData, yearlyDataCons, yearlyDataOpt);
}

function renderYearlyTable(data) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `<td class="py-4 px-2 text-slate-400">${row.year}년차</td><td class="py-4 px-2 text-blue-500">${formatValue(row.salary)}</td><td class="py-4 px-2 text-emerald-500">+${formatValue(row.profit)}</td><td class="py-4 px-2 text-right text-slate-800 dark:text-slate-200">${formatValue(row.total)}</td>`;
        tbody.appendChild(tr);
    });
}

function updateWealthTier(realWealth, rate) {
    let tier = "브론즈", icon = "🥉", color = "from-slate-400 to-slate-600";
    let desc = "기초를 다지는 단계입니다. 저축액을 늘려 시드를 모으는 데 집중하세요.";
    const threshold = baseCurrency === 'KRW' ? 1 : (1/rate * 10000); 
    const val = realWealth / threshold;

    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; color = "from-indigo-500 via-purple-500 to-pink-500"; desc = "경제적 자유 달성! 당신은 상위 1%의 자산가입니다."; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; color = "from-blue-400 to-indigo-600"; desc = "안정적인 자산가! 품격 있는 삶이 기다리고 있습니다."; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; color = "from-amber-400 to-orange-600"; desc = "풍요로운 중산층! 복리의 힘을 믿고 나아가세요."; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; color = "from-slate-300 to-slate-500"; desc = "안정적인 시작! 자산 배분을 통해 리스크를 관리하세요."; }

    document.getElementById('gradeTitle').innerText = tier;
    document.getElementById('gradeBadgeIcon').innerText = icon;
    document.getElementById('gradeDesc').innerText = desc;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${color} p-10 md:p-16 rounded-[3rem] shadow-2xl text-center text-white relative overflow-hidden`;
}

function renderChart(nominalData, realData, consData, optData) {
    const ctx = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const col = isDark ? '#94a3b8' : '#64748b';
    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                { label: '낙관적 (+2%)', data: optData, borderColor: 'transparent', backgroundColor: 'rgba(59, 130, 246, 0.05)', fill: '+1', tension: 0.4, pointRadius: 0 },
                { label: '보수적 (-2%)', data: consData, borderColor: 'transparent', backgroundColor: 'rgba(59, 130, 246, 0.05)', fill: false, tension: 0.4, pointRadius: 0 },
                { label: '기본 목표', data: nominalData, borderColor: '#3b82f6', borderWidth: 3, backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: false, tension: 0.4, pointRadius: 4 },
                { label: '실질 가치', data: realData, borderColor: '#10b981', borderDash: [5, 5], fill: false, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: col, boxWidth: 12, font: { weight: 'bold', size: 10 } } } }, scales: { y: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, ticks: { color: col, callback: v => formatValue(v) } }, x: { grid: { display: false }, ticks: { color: col } } } }
    });
}

// --- Market Pulse ---
const MARKET_TICKERS = [
    { symbol: '^GSPC', label: 'S&P 500' },
    { symbol: '^IXIC', label: 'NASDAQ' },
    { symbol: '^KS11', label: 'KOSPI' },
    { symbol: 'BTC-USD', label: 'Bitcoin' },
    { symbol: 'GC=F', label: 'Gold' },
    { symbol: 'USDKRW=X', label: 'USD/KRW' }
];

async function fetchMarketData() {
    const container = document.getElementById('marketPulse');
    if (!container) return;
    const items = await Promise.all(MARKET_TICKERS.map(async (t) => {
        try {
            const res = await fetch(`/api/price?ticker=${t.symbol}`);
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice;
            const prevClose = meta?.chartPreviousClose;
            const changePercent = ((price - prevClose) / prevClose * 100).toFixed(2);
            const color = price >= prevClose ? 'text-red-500' : 'text-blue-500';
            return `<div class="flex items-center gap-2 group cursor-default"><span class="text-xs font-black text-slate-400 group-hover:text-blue-500 transition-colors uppercase tracking-tighter">${t.label}</span><span class="text-sm font-black text-slate-800 dark:text-slate-200">${price.toLocaleString(undefined, { minimumFractionDigits: t.symbol.includes('USD') ? 0 : 2 })}</span><span class="text-[10px] font-bold ${color} bg-${price >= prevClose ? 'red' : 'blue'}-50 dark:bg-${price >= prevClose ? 'red' : 'blue'}-900/20 px-1.5 py-0.5 rounded">${price >= prevClose ? '+' : ''}${changePercent}%</span></div>`;
        } catch (e) { return ''; }
    }));
    container.innerHTML = items.filter(Boolean).join('<div class="w-px h-3 bg-slate-200 dark:bg-slate-800"></div>');
    const now = new Date();
    const timeEl = document.getElementById('lastUpdateTime');
    if (timeEl) timeEl.innerText = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');
}

// --- Auth & Init ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const loginBtn = document.getElementById('loginBtn'), userProfile = document.getElementById('userProfile'), authMobile = document.getElementById('authContainerMobile');
    if (user) {
        loginBtn?.classList.add('hidden'); userProfile?.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        if (authMobile) authMobile.innerHTML = `<div class="flex items-center justify-between"><div class="flex items-center gap-3"><img src="${user.photoURL}" class="w-10 h-10 rounded-full"><span class="font-bold text-slate-800 dark:text-white">${user.displayName}</span></div><button id="logoutBtnMobile" class="text-sm text-red-500 font-bold">로그아웃</button></div>`;
        document.getElementById('logoutBtnMobile')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
        try {
            const snap = await getDoc(doc(db, "simulations", user.uid));
            if (snap.exists()) {
                const d = snap.data();
                if (d.annualSalary) document.getElementById('annualSalary').value = d.annualSalary;
                if (d.initialSeed) document.getElementById('initialSeed').value = d.initialSeed;
                if (d.monthlyExpense) document.getElementById('monthlyExpense').value = d.monthlyExpense;
                if (d.salaryGrowth) document.getElementById('salaryGrowth').value = d.salaryGrowth;
                if (d.investmentReturn) document.getElementById('investmentReturn').value = d.investmentReturn;
                if (d.inflationRate) document.getElementById('inflationRate').value = d.inflationRate;
                if (d.baseCurrency) setCurrency(d.baseCurrency);
                if (confirm("이전에 시뮬레이션한 데이터가 있습니다. 결과를 바로 확인하시겠습니까?")) calculateAndShowResult();
            }
        } catch (e) {}
    } else {
        loginBtn?.classList.remove('hidden'); userProfile?.classList.add('hidden');
        if (authMobile) authMobile.innerHTML = `<button onclick="document.getElementById('loginBtn').click()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">구글 로그인</button>`;
    }
});

async function saveDataToFirebase() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "simulations", currentUser.uid), {
            annualSalary: document.getElementById('annualSalary').value,
            initialSeed: document.getElementById('initialSeed').value,
            monthlyExpense: document.getElementById('monthlyExpense').value,
            salaryGrowth: document.getElementById('salaryGrowth').value,
            investmentReturn: document.getElementById('investmentReturn').value,
            inflationRate: document.getElementById('inflationRate').value,
            baseCurrency, lastUpdated: new Date()
        }, { merge: true });
        showToast("데이터가 안전하게 저장되었습니다. ☁️");
    } catch (e) {}
}

window.showToast = function(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
};

window.downloadResultImage = function() {
    const area = document.querySelector('.capture-area');
    if (!area) return;
    showToast("리포트 이미지를 생성하고 있습니다... 🖼️");
    html2canvas(area, { useCORS: true, backgroundColor: null, scale: 2, logging: false }).then(canvas => {
        const link = document.createElement('a');
        const tier = document.getElementById('gradeTitle').innerText;
        link.download = `HedgeDochi_Report_${tier}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast("이미지 저장이 완료되었습니다! ✨");
    }).catch(() => showToast("이미지 생성 중 오류가 발생했습니다."));
};

window.copySimulationResult = function() {
    const tier = document.getElementById('gradeTitle').innerText;
    const nominal = document.getElementById('finalWealthText').innerText;
    const real = document.getElementById('realValueText').innerText;
    const text = `💎 Hedge Dochi 자산 등급 리포트 💎\n\n나의 10년 후 예상 등급: [ ${tier} ]\n💰 10년 후 명목 자산: ${nominal}\n📉 실질 가치(물가반영): ${real}\n\n📍 당신의 미래 등급을 확인해보세요!\n👉 https://hedge-dochi-live.pages.dev/`;
    navigator.clipboard.writeText(text).then(() => alert("결과 리포트가 클립보드에 복사되었습니다! 🚀"));
};

window.toggleStrategyModal = function(show) {
    const m = document.getElementById('strategyModal'), c = document.getElementById('modalContainer');
    if (show) {
        m.classList.remove('hidden'); m.classList.add('flex');
        setTimeout(() => c.classList.remove('scale-95', 'opacity-0'), 10);
    } else {
        c.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
    }
};

window.toggleYearlyTable = function() {
    const c = document.getElementById('yearly-table-container'), a = document.getElementById('table-arrow');
    c.classList.toggle('hidden');
    a.style.transform = c.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
};

document.addEventListener('DOMContentLoaded', () => {
    fetchMarketData();
    document.getElementById('showStrategyBtn')?.addEventListener('click', () => toggleStrategyModal(true));
    document.getElementById('closeModal')?.addEventListener('click', () => toggleStrategyModal(false));
    document.getElementById('loginBtn')?.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
    document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
    const obs = new MutationObserver(() => { if (currentStep === 4) updateCalculation(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
