import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep, saveProgress, showToast, getStepData, exchangeRate as coreExchangeRate } from './core.js';

let wealthChart = null;
let baseCurrency = 'KRW';
let exchangeRate = 1350;
let liveExchangeRate = 1350;

// --- Wizard Logic ---
window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Action Functions ---
async function autoSaveData(immediate = false, extraData = {}) {
    const salary = parseFloat(document.getElementById('annualSalary')?.value) || 0;
    const seed = parseFloat(document.getElementById('initialSeed')?.value) || 0;
    const expense = parseFloat(document.getElementById('monthlyExpense')?.value) || 0;
    const salaryGrowth = parseFloat(document.getElementById('salaryGrowth')?.value) || 0;
    const returns = parseFloat(document.getElementById('investmentReturn')?.value) || 5;
    const inflation = parseFloat(document.getElementById('inflationRate')?.value) || 2.5;

    const data = {
        annualSalary: salary,
        initialSeed: seed,
        monthlyExpense: expense,
        monthlySavings: Math.max(0, Math.round((salary / 12) - expense)),
        salaryGrowth: salaryGrowth,
        investmentReturn: returns,
        inflationRate: inflation,
        baseCurrency: baseCurrency,
        manualExchangeRate: parseFloat(document.getElementById('manualExchangeRate')?.value) || exchangeRate,
        ...extraData
    };
    
    // 유의미한 데이터가 있을 때만 저장
    if (salary > 0 || seed > 0) {
        await saveProgress(1, data, immediate);
    }
    return data;
}

async function calculateAndShowResult() {
    await updateCalculation(); // Await storage sync
    window.goToStep(4);
}

async function updateCalculation() {
    const salary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const seed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const expense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const salaryGrowth = (parseFloat(document.getElementById('salaryGrowth').value) || 0) / 100;
    const returns = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflation = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = seed;
    let currentSalary = salary;
    let currentExpense = expense;
    const yearlyData = [seed];
    const realYearlyData = [seed];
    const tableBody = document.getElementById('yearlyTableBody');
    if (tableBody) tableBody.innerHTML = '';

    for (let year = 1; year <= 10; year++) {
        currentSalary *= (1 + salaryGrowth);
        currentExpense *= (1 + inflation);
        const annualSavings = (currentSalary - (currentExpense * 12));
        const profit = currentWealth * returns;
        currentWealth = currentWealth + annualSavings + profit;
        yearlyData.push(Math.round(currentWealth));
        realYearlyData.push(Math.round(currentWealth / Math.pow(1 + inflation, year)));

        if (tableBody) {
            const tr = document.createElement('tr');
            tr.className = "border-b dark:border-slate-800";
            tr.innerHTML = `
                <td class="py-4 px-2">${year}년차</td>
                <td class="py-4 px-2 font-bold">${formatValue(currentSalary)}</td>
                <td class="py-4 px-2 text-emerald-500">+${formatValue(profit)}</td>
                <td class="py-4 px-2 text-right font-black text-blue-600">${formatValue(currentWealth)}</td>
            `;
            tableBody.appendChild(tr);
        }
    }

    const finalRealWealth = realYearlyData[10];
    const tierResult = getTierInfo(finalRealWealth);
    
    // UI 반영
    document.getElementById('gradeTitle').innerText = tierResult.tier;
    document.getElementById('gradeBadgeIcon').innerText = tierResult.icon;
    document.getElementById('gradeDesc').innerText = tierResult.desc;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${tierResult.color} p-10 md:p-16 rounded-[2.5rem] shadow-2xl text-center text-white relative overflow-hidden`;

    document.getElementById('finalWealthText').innerText = formatValue(yearlyData[10]);
    document.getElementById('realValueText').innerText = formatValue(realYearlyData[10]);
    document.getElementById('netSavingsText').innerText = formatValue(Math.max(0, Math.round((salary/12) - expense)));
    
    renderChart(yearlyData, realYearlyData);
    generateAIInsight(yearlyData[10], finalRealWealth);
    
    // 최종 결과 클라우드 강제 동기화 (등급 정보 포함)
    console.log("[Step 1] Force Cloud Sync with Tier:", tierResult.tier);
    await autoSaveData(true, {
        tier: tierResult.tier,
        finalRealWealth: finalRealWealth
    });
}

function getTierInfo(realWealth) {
    const val = realWealth / (baseCurrency === 'KRW' ? 1 : (1/exchangeRate * 10000));
    if (val >= 200000) return { tier: "다이아몬드", icon: "💎", color: "from-slate-900 to-slate-800 dark:from-blue-950 dark:to-slate-900", desc: "상위 0.1%의 압도적인 자산가입니다." };
    if (val >= 100000) return { tier: "플래티넘", icon: "💍", color: "from-blue-600 to-indigo-800", desc: "경제적 자유를 목전에 둔 자산가입니다." };
    if (val >= 50000) return { tier: "골드", icon: "🥇", color: "from-amber-500 to-orange-700", desc: "탄탄한 중산층 이상의 자산을 구축했습니다." };
    if (val >= 20000) return { tier: "실버", icon: "🥈", color: "from-slate-400 to-slate-600", desc: "기초 자산 형성을 완료했습니다." };
    return { tier: "브론즈", icon: "🥉", color: "from-slate-400 to-slate-600", desc: "자산 형성의 초기 단계입니다." };
}

function renderChart(nominalData, realData) {
    const ctxEl = document.getElementById('wealthChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    if (wealthChart) wealthChart.destroy();
    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                { label: '명목 목표', data: nominalData, borderColor: '#3b82f6', borderWidth: 4, pointRadius: 6, pointBackgroundColor: '#3b82f6', fill: false, tension: 0.3 },
                { label: '실질 가치', data: realData, borderColor: '#94a3b8', borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' } } }
    });
}

function formatValue(val) {
    if (baseCurrency === 'KRW') return (val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만');
    return '$' + Math.round(val).toLocaleString();
}

function generateAIInsight(nominal, real) {
    const el = document.getElementById('aiInsight');
    if (el) el.innerHTML = `10년 후 당신의 자산은 <b>${formatValue(nominal)}</b>에 도달하지만, 실제 구매력은 <b>${formatValue(real)}</b> 수준입니다.`;
}

function setCurrency(code) {
    baseCurrency = code;
    const glider = document.getElementById('currency-glider');
    const btnUsd = document.getElementById('btn-set-usd');
    const btnKrw = document.getElementById('btn-set-krw');
    if (glider) glider.style.left = (code === 'USD') ? '4px' : 'calc(50% - 4px)';
    if (btnUsd && btnKrw) {
        if (code === 'USD') { btnUsd.classList.replace('text-slate-400', 'text-blue-600'); btnUsd.classList.add('dark:text-blue-400'); btnKrw.classList.replace('text-blue-600', 'text-slate-400'); btnKrw.classList.remove('dark:text-blue-400'); }
        else { btnKrw.classList.replace('text-slate-400', 'text-blue-600'); btnKrw.classList.add('dark:text-blue-400'); btnUsd.classList.replace('text-blue-600', 'text-slate-400'); btnUsd.classList.remove('dark:text-blue-400'); }
    }
    const labels = document.querySelectorAll('.currency-label');
    labels.forEach(l => l.innerText = (code === 'KRW' ? '만원' : '달러'));
    autoSaveData(false);
}

function resetToLiveExchangeRate() {
    const input = document.getElementById('manualExchangeRate');
    if (input) {
        input.value = Math.round(liveExchangeRate);
        exchangeRate = liveExchangeRate;
        showToast("실시간 환율이 적용되었습니다.", "success");
        autoSaveData(true);
    }
}

document.addEventListener('coreDataReady', (e) => {
    liveExchangeRate = e.detail.exchangeRate || coreExchangeRate;
    exchangeRate = liveExchangeRate;
    restoreData();
});

async function restoreData() {
    const data = await getStepData(1);
    if (data) {
        const fields = ['annualSalary', 'initialSeed', 'monthlyExpense', 'salaryGrowth', 'investmentReturn', 'inflationRate', 'manualExchangeRate'];
        fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = data[f] || el.value;
        });
        if (data.baseCurrency) setCurrency(data.baseCurrency);
        updateCalculation();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-set-usd')?.addEventListener('click', () => setCurrency('USD'));
    document.getElementById('btn-set-krw')?.addEventListener('click', () => setCurrency('KRW'));
    document.getElementById('btn-step1-next')?.addEventListener('click', () => window.goToStep(2));
    document.getElementById('btn-step2-prev')?.addEventListener('click', () => window.goToStep(1));
    document.getElementById('btn-step2-next')?.addEventListener('click', () => window.goToStep(3));
    document.getElementById('btn-step3-prev')?.addEventListener('click', () => window.goToStep(2));
    document.getElementById('btn-step3-calculate')?.addEventListener('click', calculateAndShowResult);
    document.getElementById('btn-step3-reset-rate')?.addEventListener('click', resetToLiveExchangeRate);
    document.getElementById('btn-step4-copy')?.addEventListener('click', () => {
        const tier = document.getElementById('gradeTitle').innerText;
        const wealth = document.getElementById('finalWealthText').innerText;
        const text = `📊 Hedge Dochi 자산 시뮬레이션 결과\n📍 등급: ${tier}\n📍 자산: ${wealth}\nhttps://sangjin-lee96.github.io/hedge-dochi/`;
        navigator.clipboard.writeText(text).then(() => showToast("복사되었습니다!", "success"));
    });
    document.getElementById('btn-step4-download')?.addEventListener('click', () => {
        const area = document.querySelector('.capture-area');
        if (!area) return;
        html2canvas(area, { useCORS: true, scale: 2 }).then(canvas => {
            const link = document.createElement('a'); link.download = `Report.png`; link.href = canvas.toDataURL(); link.click();
        });
    });
    document.getElementById('btn-step4-retry')?.addEventListener('click', () => window.goToStep(1));
    document.getElementById('btn-step4-toggle-table')?.addEventListener('click', () => {
        const container = document.getElementById('yearly-table-container');
        if (container.classList.contains('hidden')) container.classList.remove('hidden');
        else container.classList.add('hidden');
    });
    document.getElementById('btn-step1-to-step2')?.addEventListener('click', () => goToNextStep(1));
    document.querySelectorAll('input').forEach(i => i.addEventListener('input', () => autoSaveData(false)));
});
