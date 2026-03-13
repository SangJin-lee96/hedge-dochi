import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, currentUser, goToNextStep, saveProgress, showToast, getStepData } from './core.js';

let currentStep = 1;
let wealthChart = null;
let baseCurrency = 'KRW';
let exchangeRate = 1350;

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
    autoSaveData();
};

async function autoSaveData() {
    const simulationData = {
        annualSalary: document.getElementById('annualSalary').value,
        initialSeed: document.getElementById('initialSeed').value,
        monthlyExpense: document.getElementById('monthlyExpense').value,
        salaryGrowth: document.getElementById('salaryGrowth').value,
        investmentReturn: document.getElementById('investmentReturn').value,
        inflationRate: document.getElementById('inflationRate').value,
        baseCurrency: baseCurrency
    };
    await saveProgress(1, simulationData);
}

window.calculateAndShowResult = async function() {
    updateCalculation();
    const simulationData = {
        annualSalary: document.getElementById('annualSalary').value,
        initialSeed: document.getElementById('initialSeed').value,
        monthlyExpense: document.getElementById('monthlyExpense').value,
        salaryGrowth: document.getElementById('salaryGrowth').value,
        investmentReturn: document.getElementById('investmentReturn').value,
        inflationRate: document.getElementById('inflationRate').value,
        baseCurrency: baseCurrency
    };
    await saveProgress(1, simulationData);
    goToStep(4);
};

function updateCalculation() {
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
    const realYearlyData = [initialSeed];
    const yearlyDataCons = [initialSeed];
    const yearlyDataOpt = [initialSeed];

    for (let year = 1; year <= 10; year++) {
        const surplus = curSalary - (curExpense * 12);
        const profit = (currentWealth + surplus / 2) * investmentReturn;
        currentWealth = currentWealth + surplus + profit;
        
        currentWealthCons = currentWealthCons + surplus + ((currentWealthCons + surplus / 2) * Math.max(0, investmentReturn - 0.02));
        currentWealthOpt = currentWealthOpt + surplus + ((currentWealthOpt + surplus / 2) * (investmentReturn + 0.02));
        
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
    updateWealthTier(realYearlyData[10]);
    renderChart(yearlyData, realYearlyData, yearlyDataCons, yearlyDataOpt);
}

function updateWealthTier(realWealth) {
    let tier = "브론즈", icon = "🥉", color = "from-slate-400 to-slate-600";
    const val = realWealth / (baseCurrency === 'KRW' ? 1 : (1/1350 * 10000));

    if (val >= 200000) { tier = "다이아몬드"; icon = "💎"; color = "from-indigo-500 via-purple-500 to-pink-500"; }
    else if (val >= 100000) { tier = "플래티넘"; icon = "💍"; color = "from-blue-400 to-indigo-600"; }
    else if (val >= 50000) { tier = "골드"; icon = "🥇"; color = "from-amber-400 to-orange-600"; }
    else if (val >= 20000) { tier = "실버"; icon = "🥈"; color = "from-slate-300 to-slate-500"; }

    document.getElementById('gradeTitle').innerText = tier;
    document.getElementById('gradeBadgeIcon').innerText = icon;
    document.getElementById('gradeSection').className = `capture-area bg-gradient-to-br ${color} p-10 md:p-16 rounded-[3rem] shadow-2xl text-center text-white relative overflow-hidden`;
    
    const container = document.getElementById('step1-actions');
    if (container) {
        container.innerHTML = `
            <button onclick="goToNextStep(1)" class="w-full py-5 bg-white text-indigo-600 font-black rounded-2xl shadow-xl hover:scale-105 transition-all text-lg mb-4">2단계 은퇴 목표 설정하기 ➔</button>
            <button onclick="goToStep(1)" class="w-full py-4 bg-white/20 text-white font-bold rounded-2xl hover:bg-white/30 transition-all text-sm">데이터 다시 수정하기</button>
        `;
    }
}

function renderChart(nominalData, realData, consData, optData) {
    const ctx = document.getElementById('wealthChart').getContext('2d');
    if (wealthChart) wealthChart.destroy();
    wealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => `${i}년`),
            datasets: [
                { label: '목표', data: nominalData, borderColor: '#fff', borderWidth: 3, pointRadius: 4, fill: false },
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

document.addEventListener('coreDataReady', async () => {
    const data = await getStepData(1);
    if (data) {
        document.getElementById('annualSalary').value = data.annualSalary || '';
        document.getElementById('initialSeed').value = data.initialSeed || '';
        document.getElementById('monthlyExpense').value = data.monthlyExpense || '';
        document.getElementById('salaryGrowth').value = data.salaryGrowth || '';
        document.getElementById('investmentReturn').value = data.investmentReturn || '';
        document.getElementById('inflationRate').value = data.inflationRate || '';
        if (data.baseCurrency) setCurrency(data.baseCurrency);
        
        // 데이터가 충분히 있다면 결과 화면 즉시 표시
        if (data.annualSalary && data.initialSeed) {
            updateCalculation();
            goToStep(4);
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input').forEach(i => i.addEventListener('change', autoSaveData));
});
