import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep, saveProgress, showToast, getStepData } from './core.js';

let wealthChart = null;
let baseCurrency = 'KRW';
let exchangeRate = 1350;

// 환율 먼저 로드 후 초기화
async function initExchangeRate() {
    try {
        const res = await fetch('/api/price?ticker=USDKRW=X');
        const data = await res.json();
        const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (rate) {
            exchangeRate = rate;
            console.log("실시간 환율 적용 완료:", exchangeRate);
        }
    } catch (e) { console.error("환율 로드 실패, 기본값 사용"); }
    restoreData();
}

window.setCurrency = function(code) {
    baseCurrency = code;
    const glider = document.getElementById('currency-glider');
    if (glider) glider.style.left = (code === 'USD') ? '4px' : '50%';
    autoSaveData();
};

async function autoSaveData() {
    const salary = parseFloat(document.getElementById('annualSalary')?.value) || 0;
    const expense = parseFloat(document.getElementById('monthlyExpense')?.value) || 0;
    const monthlySavings = Math.max(0, Math.round((salary / 12) - expense));

    const data = {
        annualSalary: salary,
        initialSeed: parseFloat(document.getElementById('initialSeed')?.value) || 0,
        monthlyExpense: expense,
        monthlySavings: monthlySavings, // 월 저축액 계산하여 저장
        salaryGrowth: parseFloat(document.getElementById('salaryGrowth')?.value) || 0,
        investmentReturn: parseFloat(document.getElementById('investmentReturn')?.value) || 0,
        inflationRate: parseFloat(document.getElementById('inflationRate')?.value) || 0,
        baseCurrency: baseCurrency,
        liveExchangeRate: exchangeRate
    };
    
    if (salary > 0 || data.initialSeed > 0) {
        await saveProgress(1, data);
    }
}

window.calculateAndShowResult = async function() {
    await autoSaveData();
    updateCalculation();
    window.goToStep(4);
};

window.goToStep = function(step) {
    document.querySelectorAll('.step-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`step-${step}`)?.classList.remove('hidden');
    document.querySelectorAll('.step-dot').forEach((dot, idx) => {
        dot.className = `step-dot w-3 h-3 rounded-full transition-all ${idx + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function updateCalculation() {
    const salary = parseFloat(document.getElementById('annualSalary').value) || 0;
    const seed = parseFloat(document.getElementById('initialSeed').value) || 0;
    const expense = parseFloat(document.getElementById('monthlyExpense').value) || 0;
    const returns = (parseFloat(document.getElementById('investmentReturn').value) || 0) / 100;
    const inflation = (parseFloat(document.getElementById('inflationRate').value) || 0) / 100;

    let currentWealth = seed;
    const yearlyData = [seed];
    const realYearlyData = [seed];

    for (let year = 1; year <= 10; year++) {
        const annualSavings = (salary - (expense * 12)) * Math.pow(1 + inflation, year - 1);
        const profit = currentWealth * returns;
        currentWealth = currentWealth + annualSavings + profit;
        yearlyData.push(Math.round(currentWealth));
        realYearlyData.push(Math.round(currentWealth / Math.pow(1 + 0.03, year))); // 실질가치 3% 가정
    }

    document.getElementById('finalWealthText').innerText = formatValue(yearlyData[10]);
    document.getElementById('realValueText').innerText = formatValue(realYearlyData[10]);
    updateWealthTier(realYearlyData[10]);
    renderChart(yearlyData, realYearlyData);
}

function updateWealthTier(realWealth) {
    let tier = "브론즈", icon = "🥉", color = "from-slate-400 to-slate-600";
    const val = realWealth / (baseCurrency === 'KRW' ? 1 : (1/exchangeRate * 10000));

    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; color = "from-indigo-500 via-purple-500 to-pink-500"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; color = "from-blue-400 to-indigo-600"; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; color = "from-amber-400 to-orange-600"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; color = "from-slate-300 to-slate-500"; }

    document.getElementById('gradeTitle').innerText = tier;
    document.getElementById('gradeBadgeIcon').innerText = icon;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${color} p-10 md:p-16 rounded-[3rem] shadow-2xl text-center text-white relative overflow-hidden`;
    
    const actionContainer = document.getElementById('step1-actions');
    if (actionContainer) {
        actionContainer.innerHTML = `
            <button onclick="goToNextStep(1)" class="w-full py-5 bg-white text-indigo-600 font-black rounded-2xl shadow-xl hover:scale-105 transition-all text-lg mb-4">2단계 은퇴 목표 설정하기 ➔</button>
            <button onclick="goToStep(1)" class="w-full py-4 bg-white/20 text-white font-bold rounded-2xl hover:bg-white/30 transition-all text-sm">데이터 다시 수정하기</button>
        `;
    }
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
                { label: '명목 목표', data: nominalData, borderColor: '#fff', borderWidth: 3, pointRadius: 4, fill: false },
                { label: '실질 가치', data: realData, borderColor: 'rgba(255,255,255,0.5)', borderDash: [5, 5], pointRadius: 0, fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#fff' } } } }
    });
}

function formatValue(val) {
    if (baseCurrency === 'KRW') return (val >= 10000 ? (val / 10000).toFixed(1) + '억' : Math.round(val).toLocaleString() + '만');
    return '$' + Math.round(val).toLocaleString();
}

async function restoreData() {
    const data = await getStepData(1);
    if (data) {
        const fields = ['annualSalary', 'initialSeed', 'monthlyExpense', 'salaryGrowth', 'investmentReturn', 'inflationRate'];
        fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = data[f] || '';
        });
        if (data.baseCurrency) {
            baseCurrency = data.baseCurrency;
            const glider = document.getElementById('currency-glider');
            if (glider) glider.style.left = (baseCurrency === 'USD') ? '4px' : '50%';
        }
        if (data.annualSalary && data.initialSeed) {
            updateCalculation();
            goToStep(4);
        }
    }
}

document.addEventListener('coreDataReady', initExchangeRate);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(i => i.addEventListener('input', autoSaveData));
});
