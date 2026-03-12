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
    if (step === 2 || step === 4) {
        try {
            const res = await fetch('/api/price?ticker=USDKRW=X');
            const data = await res.json();
            const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (rate) exchangeRate = rate;
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

// --- Currency Management ---
window.setCurrency = function(code) {
    baseCurrency = code;
    const isUSD = code === 'USD';
    
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-currency-usd');
    const btnKrw = document.getElementById('btn-currency-krw');
    const symbolWizard = document.getElementById('currency-symbol-wizard');
    const labels = document.querySelectorAll('.currency-label');

    if (isUSD) {
        if (glider) glider.style.left = '4px';
        btnUsd?.classList.add('text-blue-600');
        btnKrw?.classList.add('text-slate-400');
        btnUsd?.classList.remove('text-slate-400');
        btnKrw?.classList.remove('text-blue-600');
        if (symbolWizard) symbolWizard.innerText = '$';
        labels.forEach(l => l.innerText = 'USD');
    } else {
        if (glider) glider.style.left = '50%';
        btnKrw?.classList.add('text-blue-600');
        btnUsd?.classList.add('text-slate-400');
        btnKrw?.classList.remove('text-slate-400');
        btnUsd?.classList.remove('text-blue-600');
        if (symbolWizard) symbolWizard.innerText = '₩';
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

// --- Final Calculation & Show Result ---
window.calculateAndShowResult = function() {
    updateCalculation();
    goToStep(4);
    saveDataToFirebase(); // 결과 볼 때 자동 저장 시도
};

window.showToast = function(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
};

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
            baseCurrency,
            lastUpdated: new Date()
        }, { merge: true });
        showToast("데이터가 안전하게 저장되었습니다. ☁️");
    } catch (e) { console.error("Save Error:", e); }
}

function updateCalculation() {
    const annualSalary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const initialSeed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const monthlyExpense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const salaryGrowth = (parseFloat(document.getElementById('salaryGrowth').value) || 0) / 100;
    const investmentReturn = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflationRate = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = initialSeed;
    let currentAnnualSalary = annualSalary;
    let currentMonthlyExpense = monthlyExpense;
    
    const yearlyData = [initialSeed];
    const realYearlyData = [initialSeed];
    const tableData = [];

    for (let year = 1; year <= 10; year++) {
        const annualSurplus = currentAnnualSalary - (currentMonthlyExpense * 12);
        const profit = (currentWealth + (annualSurplus / 2)) * investmentReturn;
        currentWealth = currentWealth + annualSurplus + profit;
        
        tableData.push({ year, salary: currentAnnualSalary, profit: profit, total: currentWealth });

        currentAnnualSalary *= (1 + salaryGrowth);
        currentMonthlyExpense *= (1 + inflationRate);
        
        yearlyData.push(Math.round(currentWealth));
        const realValue = currentWealth / Math.pow(1 + (baseCurrency === 'KRW' ? inflationRate : 0.03), year);
        realYearlyData.push(Math.round(realValue));
    }

    document.getElementById('finalWealthText').innerText = formatValue(yearlyData[10]);
    document.getElementById('realValueText').innerText = formatValue(realYearlyData[10]);
    const avgNetSavings = Math.round((annualSalary - (monthlyExpense * 12)) / 12);
    document.getElementById('netSavingsText').innerText = formatValue(avgNetSavings).replace('$', '');

    renderYearlyTable(tableData);
    updateWealthTier(realYearlyData[10]);
    renderChart(yearlyData, realYearlyData);
}

function renderYearlyTable(data) {
    const tbody = document.getElementById('yearlyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        tr.innerHTML = `
            <td class="py-4 px-2 text-slate-400">${row.year}년차</td>
            <td class="py-4 px-2 text-blue-500">${formatValue(row.salary)}</td>
            <td class="py-4 px-2 text-emerald-500">+${formatValue(row.profit)}</td>
            <td class="py-4 px-2 text-right text-slate-800 dark:text-slate-200">${formatValue(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateWealthTier(realWealth) {
    let tier = "브론즈", icon = "🥉", color = "from-slate-400 to-slate-600";
    let desc = "기초를 다지는 단계입니다. 저축액을 늘려 시드를 모으는 데 집중하세요.";
    const threshold = baseCurrency === 'KRW' ? 1 : (1/exchangeRate * 10000); 
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

function renderChart(nominalData, realData) {
    const ctx = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const col = isDark ? '#94a3b8' : '#64748b';
    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                { label: '명목 자산', data: nominalData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4, pointRadius: 4 },
                { label: '실질 가치', data: realData, borderColor: '#10b981', borderDash: [5, 5], fill: false, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: col, font: { weight: 'bold' } } } }, scales: { y: { grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }, ticks: { color: col, callback: v => formatValue(v) } }, x: { ticks: { color: col } } } }
    });
}

// --- Auth & Init ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const authContainerMobile = document.getElementById('authContainerMobile');
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');

    if (user) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userProfile) userProfile.classList.remove('hidden');
        if (document.getElementById('userPhoto')) document.getElementById('userPhoto').src = user.photoURL;
        
        if (authContainerMobile) {
            authContainerMobile.innerHTML = `<div class="flex items-center justify-between"><div class="flex items-center gap-3"><img src="${user.photoURL}" class="w-10 h-10 rounded-full border border-slate-200"><span class="font-bold text-slate-800 dark:text-white">${user.displayName}</span></div><button id="logoutBtnMobile" class="text-sm text-red-500 font-bold">로그아웃</button></div>`;
            document.getElementById('logoutBtnMobile').addEventListener('click', () => signOut(auth).then(() => location.reload()));
        }

        // 데이터 불러오기
        try {
            const docSnap = await getDoc(doc(db, "simulations", user.uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('annualSalary').value = data.annualSalary;
                document.getElementById('initialSeed').value = data.initialSeed;
                document.getElementById('monthlyExpense').value = data.monthlyExpense;
                document.getElementById('salaryGrowth').value = data.salaryGrowth;
                document.getElementById('investmentReturn').value = data.investmentReturn;
                document.getElementById('inflationRate').value = data.inflationRate;
                if (data.baseCurrency) setCurrency(data.baseCurrency);
                
                if (confirm("이전에 시뮬레이션한 데이터가 있습니다. 결과를 바로 확인하시겠습니까?")) {
                    calculateAndShowResult();
                }
            }
        } catch (e) { console.error("Load Error:", e); }
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userProfile) userProfile.classList.add('hidden');
        if (authContainerMobile) authContainerMobile.innerHTML = `<button onclick="document.getElementById('loginBtn').click()" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">구글 로그인</button>`;
    }
});

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

if (loginBtn) loginBtn.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => location.reload()));

window.copySimulationResult = function() {
    const tier = document.getElementById('gradeTitle').innerText;
    const nominal = document.getElementById('finalWealthText').innerText;
    const real = document.getElementById('realValueText').innerText;
    const savings = document.getElementById('netSavingsText').innerText;
    const currency = baseCurrency === 'KRW' ? '원화' : '달러';

    const text = `💎 Hedge Dochi 자산 등급 리포트 💎\n\n` +
                 `나의 10년 후 예상 등급: [ ${tier} ]\n` +
                 `--------------------------\n` +
                 `💰 10년 후 명목 자산: ${nominal}\n` +
                 `📉 실질 가치(물가반영): ${real}\n` +
                 `🏦 월 평균 저축액: ${savings}${baseCurrency === 'KRW' ? '만' : ''}\n` +
                 `🌍 기준 통화: ${currency}\n\n` +
                 `📍 당신의 미래 자산 등급을 지금 확인해보세요!\n` +
                 `👉 https://hedge-dochi-live.pages.dev/`;

    navigator.clipboard.writeText(text).then(() => {
        alert("결과 리포트가 클립보드에 복사되었습니다! 🚀\n커뮤니티나 SNS에 공유해보세요.");
    }).catch(err => {
        console.error('복사 실패:', err);
    });
};

window.toggleStrategyModal = function(show) {
    const modal = document.getElementById('strategyModal'), container = document.getElementById('modalContainer');
    if (!modal || !container) return;
    if (show) {
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => container.classList.remove('scale-95', 'opacity-0'), 10);
    } else {
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
    }
};

window.toggleYearlyTable = function() {
    const container = document.getElementById('yearly-table-container'), arrow = document.getElementById('table-arrow');
    container.classList.toggle('hidden');
    arrow.style.transform = container.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('showStrategyBtn')?.addEventListener('click', () => toggleStrategyModal(true));
    document.getElementById('closeModal')?.addEventListener('click', () => toggleStrategyModal(false));
    const observer = new MutationObserver(() => { if (currentStep === 4) updateCalculation(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
